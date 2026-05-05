import { Router } from "express";
import { getMe, onboardBrandAdmin, onboardConsumer, upsertFromClerk } from "../controllers/userController.js";
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
  return async (req: Parameters<typeof router.get>[1] extends (...args: infer Args) => unknown ? Args[0] : never, res: Parameters<typeof router.get>[1] extends (...args: infer Args) => unknown ? Args[1] : never, next: Parameters<typeof router.get>[1] extends (...args: infer Args) => unknown ? Args[2] : never) => {
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

const cacheUserProfile = createRouteCache({
  ttlSeconds: 60,
  keyPrefix: "user:profile",
  includeAuthContext: true,
});

router.get("/me", cacheUserProfile, getMe);
router.post("/upsert-from-clerk", upsertFromClerk);
router.post("/onboard/consumer", onboardConsumer);
router.post("/onboard/brand-admin", onboardBrandAdmin);

export default router;
