import { Router } from "express";
import {
  approveBrand,
  deleteBrandAdmin,
  deleteEndUser,
  getAppAdminOverview,
  getBrandDealsForAdmin,
  getBrandForAdmin,
  listBrandAdmins,
  listAllBrandsForAdmin,
  listEndUsers,
  listPendingBrands,
  rejectBrand,
  suspendBrandAdmin,
} from "../controllers/brandAdminController.js";
import { cacheService } from "../services/cacheService.js";

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
  return async (req: Parameters<typeof router.get>[1] extends (...args: infer Args) => unknown ? Args[0] : never, res: Parameters<typeof router.get>[1] extends (...args: infer Args) => unknown ? Args[1] : never, next: Parameters<typeof router.get>[1] extends (...args: infer Args) => unknown ? Args[2] : never) => {
    if (req.method !== "GET") {
      return next();
    }

    const keyParts = [options.keyPrefix, req.method, req.originalUrl];

    if (options.includeAuthContext) {
      const { getAuth } = await import("@clerk/express");
      const auth = getAuth(req);

      if (auth.userId) {
        keyParts.push(`user:${auth.userId}`);
      }

      if (auth.sessionId) {
        keyParts.push(`session:${auth.sessionId}`);
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

router.get("/overview", cacheAdminOverview, getAppAdminOverview);
router.get("/brands", cacheAllBrands, listAllBrandsForAdmin);
router.get("/brands/pending", cachePendingBrands, listPendingBrands);
router.get("/brands/:brandId", cacheBrandForAdmin, getBrandForAdmin);
router.get("/brands/:brandId/deals", cacheBrandDealsForAdmin, getBrandDealsForAdmin);
router.patch("/brands/:brandId/approve", approveBrand);
router.patch("/brands/:brandId/reject", rejectBrand);
router.get("/brand-admins", cacheBrandAdmins, listBrandAdmins);
router.patch("/brand-admins/:userId/suspend", suspendBrandAdmin);
router.delete("/brand-admins/:userId", deleteBrandAdmin);
router.get("/end-users", cacheEndUsers, listEndUsers);
router.delete("/end-users/:userId", deleteEndUser);

export default router;
