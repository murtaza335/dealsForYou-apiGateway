import { Router } from "express";
import { createMyDeal, deleteMyDeal, getMyBrand, getMyDeals, } from "../controllers/brandAdminController.js";
import { cacheService } from "../services/cacheService.js";
const router = Router();
const createRouteCache = (options) => {
    return async (req, res, next) => {
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
const cacheMyBrand = createRouteCache({
    ttlSeconds: 300,
    keyPrefix: "brand-admin:my-brand",
    includeAuthContext: true,
});
const cacheMyDeals = createRouteCache({
    ttlSeconds: 120,
    keyPrefix: "brand-admin:my-deals",
    includeAuthContext: true,
});
router.get("/brand", cacheMyBrand, getMyBrand);
router.get("/deals", cacheMyDeals, getMyDeals);
router.post("/deals", createMyDeal);
router.delete("/deals/:dealId", deleteMyDeal);
export default router;
