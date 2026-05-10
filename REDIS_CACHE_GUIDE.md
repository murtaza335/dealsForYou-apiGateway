# Redis Cache Implementation Guide

Redis caching is implemented across all GET routes in the API gateway for read-heavy endpoints. The cache stores full JSON responses in Redis and returns them on cache hits before the controller makes a downstream service call.

## Environment Variables

- `REDIS_URL` — Redis connection string, for example `redis://localhost:6379`
- `REDIS_PREFIX` — key namespace used by the gateway, default `api-gateway`
- `REDIS_DEFAULT_TTL_SECONDS` — fallback TTL for generic cache helpers, default `300`

## Routes Cached by Module

### Deals Routes (`/api/deals`)

| Route | TTL | Cache Strategy |
| --- | ---: | --- |
| `GET /api/deals/filtered` | 60 seconds | Query-aware. Uses full request URL including filters |
| `GET /api/deals/filters/options` | 30 minutes | Static filter metadata with moderate refresh |
| `GET /api/deals/filters/brands` | 6 hours | Brand filter list; stable long-term |
| `GET /api/deals/filters/cuisine-tags` | 6 hours | Meal curvature tags; rarely changes |
| `GET /api/deals/filters/meal-types` | 6 hours | Meal type list; rarely changes |
| `GET /api/deals/filters/price-range` | 15 minutes | Price ranges; moderate change frequency |
| `GET /api/deals/:dealId` | 10 minutes | Individual deal details by ID |
| `GET /api/deals/recommended` | 2 minutes | User-specific. Key includes Clerk user + session ID |
| `GET /api/deals/current-mood` | 1 minute | User-specific, frequently updated mood data |
| `GET /api/deals/top` | 5 minutes | Trending top deals; regular refresh |

### Analytics Routes (`/api/analytics`)

| Route | TTL | Cache Strategy |
| --- | ---: | --- |
| `GET /api/analytics/trending/deals` | 5 minutes | Trending deals across platform |
| `GET /api/analytics/trending/brands` | 5 minutes | Popular brands; updates frequently |

### Brand Routes (`/api/brand`)

| Route | TTL | Cache Strategy |
| --- | ---: | --- |
| `GET /api/brand/brands-info` | 30 minutes | Public brand metadata; relatively static |

### Admin Routes (`/api/admin`)

| Route | TTL | Cache Strategy |
| --- | ---: | --- |
| `GET /api/admin/overview` | 2 minutes | Dashboard overview; frequent admin checks |
| `GET /api/admin/brands` | 5 minutes | List all brands in system |
| `GET /api/admin/brands/pending` | 2 minutes | Pending brand approvals; admin needs fresh data |
| `GET /api/admin/brands/:brandId` | 5 minutes | Individual brand details |
| `GET /api/admin/brands/:brandId/deals` | 5 minutes | Deals from specific brand for admin review |
| `GET /api/admin/brand-admins` | 10 minutes | List of brand admin users |
| `GET /api/admin/end-users` | 10 minutes | List of end users; rarely changes |

### Brand Admin Routes (`/api/brand-admin`)

| Route | TTL | Cache Strategy |
| --- | ---: | --- |
| `GET /api/brand-admin/brand` | 5 minutes | Brand owner's brand details; includes auth context |
| `GET /api/brand-admin/deals` | 2 minutes | Brand owner's own deals; includes auth context |

### User Routes (`/api/users`)

| Route | TTL | Cache Strategy |
| --- | ---: | --- |
| `GET /api/users/me` | 1 minute | User profile data; includes auth context |

## Behavior

- **Cache Hits**: Responses returned directly from Redis without calling downstream service
- **Cache Misses**: Gateway fetches fresh data from service and stores it in Redis for future requests
- **Status Codes**: Only successful responses (2xx status codes) are cached
- **Empty/Error Payloads**: Successful responses with no results or `success: false` are not cached
- **Non-GET Routes**: POST, PATCH, DELETE routes bypass cache entirely
- **Write Invalidation**: Successful POST, PATCH, DELETE routes clear related cache prefixes to prevent stale reads
- **Graceful Degradation**: If Redis is unavailable, the gateway continues serving requests normally without failing

## Response Headers

- `X-Cache: HIT` — Response came from Redis cache
- `X-Cache: MISS` — Response fetched fresh from service and stored in cache

## Console Logging

Cache hits and misses are logged to console for monitoring:
```
[Gateway][Cache] HIT GET /api/deals/filtered?search=pizza
[Gateway][Cache] MISS GET /api/deals/filtered?search=tacos
```

This allows visibility into cache performance in development and production logs.

## Cache Key Strategy

Cache keys are constructed as: `{PREFIX}|{METHOD}|{URL}|{AUTH_CONTEXT}`

- **Prefix**: Configured namespace (default: `api-gateway`)
- **Method**: HTTP method (always GET for cached routes)
- **URL**: Full request path and query string
- **Auth Context**: For auth-aware routes, includes Clerk user ID and session ID to prevent cross-user cache pollution

### Example Cache Keys

```
api-gateway|GET|/api/deals/filtered?search=pizza
api-gateway|GET|/api/deals/recommended|user:user_123|session:session_456
api-gateway|GET|/api/users/me|user:user_789|session:session_101
```

## Write-Route Invalidation

Write endpoints (POST, PATCH, DELETE) now invalidate related cached GET responses by prefix. This ensures new data is visible immediately after mutations.

### Prefix Invalidation Helpers

- `cacheService.delByPrefix(prefix)` clears all cache entries starting with the given prefix for both Redis and in-memory cache.
- Prefix values match the route cache `keyPrefix` values (for example `admin:` or `deals:`).

### Invalidation Map (High-Level)

- **Admin writes** (`/api/app-admin/*`): clears `admin:`, `brand:brands-info`, `brand-admin:`, `deals:`, `deals:filter-brands`
- **Brand admin deal writes** (`/api/brand-admin/deals`): clears `brand-admin:`, `admin:brand-deals`, `deals:`, `analytics:trending-deals`
- **User onboarding/upsert** (`/api/users/*` POST): clears `user:profile`, `admin:`, `brand:brands-info`, `deals:filter-brands`
- **Analytics events** (`/api/analytics/event`): clears `analytics:trending-deals`, `analytics:trending-brands`, `deals:top`
- **Favourites writes** (`/api/analytics/favourites`): clears `analytics:favourites`, `deals:recommended`

## TTL Rationale

- **1-2 minutes**: User-specific, frequently changing data (user profile, personalized recommendations, mood)
- **5 minutes**: Real-time trending data (deals, brands, filtered results)
- **10-30 minutes**: Admin dashboards and lists (admins can tolerate slight staleness)
- **6 hours**: Static configuration data (filter options, meal types, cuisines)

## Implementation Details

### Cache Middleware

Each route file implements a `createRouteCache()` middleware factory:

```typescript
const createRouteCache = (options: RouteCacheOptions) => {
  // Returns Express middleware that:
  // 1. Checks Redis cache on GET requests
  // 2. Returns cached response if hit
  // 3. Intercepts res.json() to auto-cache successful responses with data
  // 4. Logs cache hits/misses to console
};
```

### Error Handling

- **Transient Errors**: Connection failures (ECONNRESET, ECONNREFUSED) trigger a 5-second cooldown; cache operations silently fail and requests proceed uncached
- **Persistent Errors**: Real errors are logged at error level for debugging
- **Silent Fallback**: Cache service returns `null` on errors, allowing the request to continue to the underlying controller

### Fallback Behavior

If Redis becomes unavailable:
1. Initial requests complete normally (hit downstream services)
2. Response is sent back to client
3. No value is cached
4. Next request goes to service again
5. Users see no degradation; cache just isn't used temporarily

## Performance Impact

Expected improvements with cache enabled:

- **Response Time**: 5-100ms for cache hits vs 100-500ms+ for service calls
- **Database Load**: Reduced queries on high-traffic endpoints (trending, filters)
- **Throughput**: Higher requests/sec capacity due to instant responses from Redis

## Monitoring

Monitor these metrics in production:

- Cache hit ratio: `cache_hits / (cache_hits + cache_misses)`
- Response time with/without cache
- Redis connection health
- Cache key volume (size of Redis database)

Use the console logs to track hit/miss patterns in development.

## Future Improvements

1. **Cache Invalidation**: Add more granular prefix mapping or entity-specific invalidation to reduce over-invalidation
2. **Compression**: Compress large responses before storing in Redis
3. **Metrics Export**: Send cache metrics to monitoring system (Prometheus, Datadog, etc.)
4. **Granular TTLs**: Make TTLs configurable per route without code changes
5. **Cache Warming**: Pre-populate Redis with popular queries at startup