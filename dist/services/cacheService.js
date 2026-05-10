import { getRedisClient, getRedisConfig } from "../config/redis.js";
const MEMORY_CACHE_MAX_ENTRIES = 2000;
class CacheService {
    constructor() {
        this.memoryCache = new Map();
    }
    ns(key) {
        return `${getRedisConfig().prefix}:${key}`;
    }
    readFromMemory(namespacedKey) {
        const entry = this.memoryCache.get(namespacedKey);
        if (!entry)
            return null;
        if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
            this.memoryCache.delete(namespacedKey);
            return null;
        }
        try {
            return JSON.parse(entry.payload);
        }
        catch {
            return entry.payload;
        }
    }
    writeToMemory(namespacedKey, value, ttlSeconds) {
        const { defaultTtlSeconds } = getRedisConfig();
        const ttl = typeof ttlSeconds === "number" && ttlSeconds > 0
            ? Math.floor(ttlSeconds)
            : defaultTtlSeconds;
        const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
        if (!this.memoryCache.has(namespacedKey) && this.memoryCache.size >= MEMORY_CACHE_MAX_ENTRIES) {
            const oldestKey = this.memoryCache.keys().next().value;
            if (oldestKey) {
                this.memoryCache.delete(oldestKey);
            }
        }
        this.memoryCache.set(namespacedKey, {
            payload: JSON.stringify(value),
            expiresAt,
        });
    }
    isTransientRedisError(err) {
        if (!err || typeof err !== "object") {
            return false;
        }
        const code = "code" in err && typeof err.code === "string" ? err.code : "";
        return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(code);
    }
    async safe(fn, fallback) {
        try {
            return await fn();
        }
        catch (err) {
            if (!this.isTransientRedisError(err)) {
                console.error("[Cache] Redis operation failed:", err);
            }
            return fallback;
        }
    }
    async client() {
        const c = await getRedisClient();
        return c?.isReady ? c : null;
    }
    async getWithSource(key) {
        const namespacedKey = this.ns(key);
        const client = await this.client();
        if (!client) {
            const memoryValue = this.readFromMemory(namespacedKey);
            return {
                value: memoryValue,
                source: memoryValue === null ? "none" : "memory",
            };
        }
        try {
            const raw = await client.get(namespacedKey);
            if (raw) {
                try {
                    return { value: JSON.parse(raw), source: "redis" };
                }
                catch {
                    return { value: raw, source: "redis" };
                }
            }
            const memoryValue = this.readFromMemory(namespacedKey);
            return {
                value: memoryValue,
                source: memoryValue === null ? "none" : "memory",
            };
        }
        catch (err) {
            if (!this.isTransientRedisError(err)) {
                console.error("[Cache] Redis operation failed:", err);
            }
            const memoryValue = this.readFromMemory(namespacedKey);
            return {
                value: memoryValue,
                source: memoryValue === null ? "none" : "memory",
            };
        }
    }
    async get(key) {
        const result = await this.getWithSource(key);
        return result.value;
    }
    async set(key, value, ttlSeconds) {
        const namespacedKey = this.ns(key);
        this.writeToMemory(namespacedKey, value, ttlSeconds);
        const client = await this.client();
        if (!client)
            return;
        const { defaultTtlSeconds } = getRedisConfig();
        const ttl = typeof ttlSeconds === "number" && ttlSeconds > 0
            ? Math.floor(ttlSeconds)
            : defaultTtlSeconds;
        const payload = JSON.stringify(value);
        await this.safe(async () => {
            if (ttl > 0) {
                await client.set(namespacedKey, payload, { EX: ttl });
            }
            else {
                await client.set(namespacedKey, payload);
            }
        }, undefined);
    }
    async del(key) {
        const namespacedKey = this.ns(key);
        this.memoryCache.delete(namespacedKey);
        const client = await this.client();
        if (!client)
            return;
        await this.safe(async () => {
            await client.del(namespacedKey);
        }, undefined);
    }
    async delByPrefix(prefix) {
        const namespacedPrefix = this.ns(prefix);
        for (const key of this.memoryCache.keys()) {
            if (key.startsWith(namespacedPrefix)) {
                this.memoryCache.delete(key);
            }
        }
        const client = await this.client();
        if (!client)
            return;
        const pattern = `${namespacedPrefix}*`;
        await this.safe(async () => {
            if ("scanIterator" in client) {
                for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
                    const normalizedKey = typeof key === "string" ? key : String(key);
                    await client.del(normalizedKey);
                }
                return;
            }
            let cursor = "0";
            do {
                const [nextCursor, keys] = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
                if (keys.length > 0) {
                    await client.del(...keys);
                }
                cursor = nextCursor;
            } while (cursor !== "0");
        }, undefined);
    }
}
export const cacheService = new CacheService();
