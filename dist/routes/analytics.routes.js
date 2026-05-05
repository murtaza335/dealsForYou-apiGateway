import { Router } from "express";
import { getTrendingDeals, getTrendingBrands, trackEvent } from "../controllers/analyticsController.js";
import { cacheService } from "../services/cacheService.js";
import { getAuthContext } from "../utils/auth.js";
const router = Router();
const createRouteCache = (options) => {
    return async (req, res, next) => {
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
        const { value: cachedResponse, source } = await cacheService.getWithSource(cacheKey);
        if (cachedResponse) {
            console.log(`[Gateway][Cache] HIT ${req.method} ${req.originalUrl} (${source})`);
            res.setHeader("X-Cache", "HIT");
            res.setHeader("X-Cache-Backend", source);
            return res.status(cachedResponse.statusCode).json(cachedResponse.body);
        }
        console.log(`[Gateway][Cache] MISS ${req.method} ${req.originalUrl}`);
        const originalJson = res.json.bind(res);
        res.json = ((body) => {
            const statusCode = res.statusCode >= 200 && res.statusCode < 300 ? res.statusCode : 200;
            if (statusCode >= 200 && statusCode < 300) {
                void cacheService.set(cacheKey, {
                    statusCode,
                    body,
                }, options.ttlSeconds);
            }
            res.setHeader("X-Cache", "MISS");
            res.setHeader("X-Cache-Backend", "none");
            return originalJson(body);
        });
        return next();
    };
};
const cacheTrendingDeals = createRouteCache({
    ttlSeconds: 300,
    keyPrefix: "analytics:trending-deals",
});
const cacheTrendingBrands = createRouteCache({
    ttlSeconds: 300,
    keyPrefix: "analytics:trending-brands",
});
router.get("/trending/deals", cacheTrendingDeals, getTrendingDeals);
router.get("/trending/brands", cacheTrendingBrands, getTrendingBrands);
router.post("/event", trackEvent);
export default router;
