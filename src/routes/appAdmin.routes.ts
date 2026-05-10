import { Router, RequestHandler } from "express";
import {
  approveBrand,
  deleteBrandAdmin,
  deleteEndUser,
  getAppAdminOverview,
  getBrandDealsForAdmin,
  getBrandForAdmin,
  listBrandAdmins,
  listAllBrandsForAdmin,
  listApprovedBrands,
  listEndUsers,
  listPendingBrands,
  listRejectedBrands,
  rejectBrand,
  suspendBrandAdmin,
} from "../controllers/brandAdminController.js";
import { cacheService } from "../services/cacheService.js";
import { getAuthContext } from "../utils/auth.js";

const router = Router();

type RouteCacheOptions = {
  ttlSeconds: number;
  keyPrefix: string;
  includeAuthContext?: boolean;
};

type CachedResponsePayload = {
  statusCode: number;
  body: unknown;
};

const createRouteCache = (options: RouteCacheOptions) => {
  return async (req: any, res: any, next: any): Promise<any> => {
    if (req.method !== "GET") {
      return next();
    }

    const keyParts = [options.keyPrefix, req.method, req.originalUrl];

    if (options.includeAuthContext) {
      const { userId, sessionId } = getAuthContext(req);

      if (userId) {
        keyParts.push(`user:${userId}`);
      }

      if (sessionId) {
        keyParts.push(`session:${sessionId}`);
      }
    }

    const cacheKey = keyParts.join("|");
    const { value: cachedResponse, source } = await cacheService.getWithSource<CachedResponsePayload>(cacheKey);

    if (cachedResponse) {
      console.log(`[Gateway][Cache] HIT ${req.method} ${req.originalUrl} (${source})`);
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Backend", source);
      return res.status(cachedResponse.statusCode).json(cachedResponse.body);
    }

    console.log(`[Gateway][Cache] MISS ${req.method} ${req.originalUrl}`);

    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      const statusCode = res.statusCode >= 200 && res.statusCode < 300 ? res.statusCode : 200;

      if (statusCode >= 200 && statusCode < 300) {
        void cacheService.set<CachedResponsePayload>(
          cacheKey,
          {
            statusCode,
            body,
          },
          options.ttlSeconds
        );
      }

      res.setHeader("X-Cache", "MISS");
      res.setHeader("X-Cache-Backend", "none");
      return originalJson(body);
    }) as typeof res.json;

    return next();
  };
};

const cacheAdminOverview = createRouteCache({
  ttlSeconds: 120,
  keyPrefix: "admin:overview",
});

const cacheAllBrands = createRouteCache({
  ttlSeconds: 300,
  keyPrefix: "admin:all-brands",
});

const cachePendingBrands = createRouteCache({
  ttlSeconds: 120,
  keyPrefix: "admin:pending-brands",
});

const cacheBrandForAdmin = createRouteCache({
  ttlSeconds: 300,
  keyPrefix: "admin:brand-detail",
});

const cacheBrandDealsForAdmin = createRouteCache({
  ttlSeconds: 300,
  keyPrefix: "admin:brand-deals",
});

const cacheBrandAdmins = createRouteCache({
  ttlSeconds: 600,
  keyPrefix: "admin:brand-admins",
});

const cacheEndUsers = createRouteCache({
  ttlSeconds: 600,
  keyPrefix: "admin:end-users",
});

const invalidateCachePrefixes = async (prefixes: string[]) => {
  await Promise.all(prefixes.map((prefix) => cacheService.delByPrefix(prefix)));
};

const withCacheInvalidation = (
  handler: RequestHandler,
  prefixes: string[]
) => {
  return async (req: any, res: any, next: any): Promise<any> => {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void invalidateCachePrefixes(prefixes);
      }
    });

    return handler(req, res, next);
  };
};

const adminWriteInvalidations = [
  "admin:",
  "brand:brands-info",
  "brand-admin:",
  "deals:filter-brands",
  "deals:",
];

router.get("/overview", cacheAdminOverview, getAppAdminOverview);
router.get("/brands", cacheAllBrands, listAllBrandsForAdmin);
router.get("/brands/pending", cachePendingBrands, listPendingBrands);
router.get("/brands/approved", cacheAllBrands, listApprovedBrands);
router.get("/brands/rejected", cacheAllBrands, listRejectedBrands);
router.get("/brands/:brandId", cacheBrandForAdmin, getBrandForAdmin);
router.get("/brands/:brandId/deals", cacheBrandDealsForAdmin, getBrandDealsForAdmin);
router.patch("/brands/:brandId/approve", withCacheInvalidation(approveBrand, adminWriteInvalidations));
router.patch("/brands/:brandId/reject", withCacheInvalidation(rejectBrand, adminWriteInvalidations));
router.get("/brand-admins", cacheBrandAdmins, listBrandAdmins);
router.patch("/brand-admins/:userId/suspend", withCacheInvalidation(suspendBrandAdmin, adminWriteInvalidations));
router.delete("/brand-admins/:userId", withCacheInvalidation(deleteBrandAdmin, adminWriteInvalidations));
router.get("/end-users", cacheEndUsers, listEndUsers);
router.delete("/end-users/:userId", withCacheInvalidation(deleteEndUser, ["admin:", "user:profile"]));

export default router;
