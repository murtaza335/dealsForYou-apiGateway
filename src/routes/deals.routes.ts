import { getAuth } from "@clerk/express";
import { Router } from "express";
import {
  getDealById,
  getDealFilterBrands,
  getDealFilterCuisineTags,
  getDealFilterMealTypes,
  getDealFilterOptions,
  getDealFilterPriceRange,
  getFilteredDeals,
  getCurrentMoodDeals,
  getRecommendedDeals,
  getTopDeals,
} from "../controllers/dealsController.js";
import { cacheService } from "../services/cacheService.js";
import { requireAuth } from "../middlewares/requireAuth.js";

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

const cacheFilteredDeals = createRouteCache({
  ttlSeconds: 60,
  keyPrefix: "deals:filtered",
});

const cacheDealFilterOptions = createRouteCache({
  ttlSeconds: 1800,
  keyPrefix: "deals:filter-options",
});

const cacheDealFilterBrands = createRouteCache({
  ttlSeconds: 21600,
  keyPrefix: "deals:filter-brands",
});

const cacheDealFilterCuisineTags = createRouteCache({
  ttlSeconds: 21600,
  keyPrefix: "deals:filter-cuisine-tags",
});

const cacheDealFilterMealTypes = createRouteCache({
  ttlSeconds: 21600,
  keyPrefix: "deals:filter-meal-types",
});

const cacheDealFilterPriceRange = createRouteCache({
  ttlSeconds: 900,
  keyPrefix: "deals:filter-price-range",
});

const cacheDealById = createRouteCache({
  ttlSeconds: 600,
  keyPrefix: "deals:by-id",
});

const cacheRecommendedDeals = createRouteCache({
  ttlSeconds: 120,
  keyPrefix: "deals:recommended",
  includeAuthContext: true,
});

const cacheCurrentMoodDeals = createRouteCache({
  ttlSeconds: 60,
  keyPrefix: "deals:current-mood",
  includeAuthContext: true,
});

const cacheTopDeals = createRouteCache({
  ttlSeconds: 300,
  keyPrefix: "deals:top",
});

router.get("/filtered", cacheFilteredDeals, getFilteredDeals);
router.get("/filters/options", cacheDealFilterOptions, getDealFilterOptions);
router.get("/filters/brands", cacheDealFilterBrands, getDealFilterBrands);
router.get("/filters/cuisine-tags", cacheDealFilterCuisineTags, getDealFilterCuisineTags);
router.get("/filters/meal-types", cacheDealFilterMealTypes, getDealFilterMealTypes);
router.get("/filters/price-range", cacheDealFilterPriceRange, getDealFilterPriceRange);
router.get("/current-mood", requireAuth, cacheCurrentMoodDeals, getCurrentMoodDeals);
router.get("/recommended", requireAuth, cacheRecommendedDeals, getRecommendedDeals);
router.get("/top", cacheTopDeals, getTopDeals);
router.get("/:dealId", cacheDealById, getDealById);

export default router;
