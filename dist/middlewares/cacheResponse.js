import { cacheService } from "../services/cacheService.js";
import { getAuthContext } from "../utils/auth.js";
function buildCacheKey(req, options) {
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
    return keyParts.join("|");
}
export function createRouteCache(options) {
    return async (req, res, next) => {
        if (req.method !== "GET") {
            return next();
        }
        const cacheKey = buildCacheKey(req, options);
        const { value: cachedResponse, source } = await cacheService.getWithSource(cacheKey);
        if (cachedResponse) {
            res.setHeader("X-Cache", "HIT");
            res.setHeader("X-Cache-Backend", source);
            return res.status(cachedResponse.statusCode).json(cachedResponse.body);
        }
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
}
