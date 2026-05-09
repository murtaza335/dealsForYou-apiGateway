import type { Request, RequestHandler } from "express";
import { cacheService } from "../services/cacheService.js";
import { getAuthContext } from "../utils/auth.js";

type RouteCacheOptions = {
  ttlSeconds: number;
  keyPrefix: string;
  includeAuthContext?: boolean;
};

type CachedResponsePayload = {
  statusCode: number;
  body: unknown;
};

function shouldCacheResponse(body: unknown): boolean {
  if (body === null || body === undefined) return false;

  if (Array.isArray(body)) {
    return body.length > 0;
  }

  if (typeof body === "object") {
    const payload = body as Record<string, unknown>;

    if (payload.success === false) {
      return false;
    }

    if ("data" in payload) {
      const data = payload.data;
      if (data === null || data === undefined) return false;
      if (Array.isArray(data)) return data.length > 0;
    }
  }

  return true;
}

function buildCacheKey(req: Request, options: RouteCacheOptions) {
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

export function createRouteCache(options: RouteCacheOptions): RequestHandler {
  return async (req, res, next) => {
    if (req.method !== "GET") {
      return next();
    }

    const cacheKey = buildCacheKey(req, options);
    const { value: cachedResponse, source } = await cacheService.getWithSource<CachedResponsePayload>(cacheKey);

    if (cachedResponse) {
      res.setHeader("X-Cache", "HIT");
      res.setHeader("X-Cache-Backend", source);
      return res.status(cachedResponse.statusCode).json(cachedResponse.body);
    }

    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      const statusCode = res.statusCode >= 200 && res.statusCode < 300 ? res.statusCode : 200;

      if (statusCode >= 200 && statusCode < 300 && shouldCacheResponse(body)) {
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
}