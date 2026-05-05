import { getRedisClient, getRedisConfig } from "../config/redis.js";

type MemoryCacheEntry = {
  payload: string;
  expiresAt: number | null;
};

export type CacheReadSource = "redis" | "memory" | "none";

const MEMORY_CACHE_MAX_ENTRIES = 2000;

class CacheService {
  private readonly memoryCache = new Map<string, MemoryCacheEntry>();

  private ns(key: string) {
    return `${getRedisConfig().prefix}:${key}`;
  }

  private readFromMemory<T>(namespacedKey: string): T | null {
    const entry = this.memoryCache.get(namespacedKey);
    if (!entry) return null;

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.memoryCache.delete(namespacedKey);
      return null;
    }

    try {
      return JSON.parse(entry.payload) as T;
    } catch {
      return entry.payload as T;
    }
  }

  private writeToMemory<T>(namespacedKey: string, value: T, ttlSeconds?: number): void {
    const { defaultTtlSeconds } = getRedisConfig();
    const ttl =
      typeof ttlSeconds === "number" && ttlSeconds > 0
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

  private isTransientRedisError(err: unknown) {
    if (!err || typeof err !== "object") {
      return false;
    }

    const code = "code" in err && typeof err.code === "string" ? err.code : "";
    return ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"].includes(code);
  }

  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (!this.isTransientRedisError(err)) {
        console.error("[Cache] Redis operation failed:", err);
      }

      return fallback;
    }
  }

  private async client() {
    const c = await getRedisClient();
    return c?.isReady ? c : null;
  }

  async getWithSource<T>(key: string): Promise<{ value: T | null; source: CacheReadSource }> {
    const namespacedKey = this.ns(key);
    const client = await this.client();

    if (!client) {
      const memoryValue = this.readFromMemory<T>(namespacedKey);
      return {
        value: memoryValue,
        source: memoryValue === null ? "none" : "memory",
      };
    }

    try {
      const raw = await client.get(namespacedKey);
      if (raw) {
        try {
          return { value: JSON.parse(raw) as T, source: "redis" };
        } catch {
          return { value: raw as T, source: "redis" };
        }
      }

      const memoryValue = this.readFromMemory<T>(namespacedKey);
      return {
        value: memoryValue,
        source: memoryValue === null ? "none" : "memory",
      };
    } catch (err) {
      if (!this.isTransientRedisError(err)) {
        console.error("[Cache] Redis operation failed:", err);
      }

      const memoryValue = this.readFromMemory<T>(namespacedKey);
      return {
        value: memoryValue,
        source: memoryValue === null ? "none" : "memory",
      };
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const result = await this.getWithSource<T>(key);
    return result.value;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const namespacedKey = this.ns(key);
    this.writeToMemory(namespacedKey, value, ttlSeconds);

    const client = await this.client();
    if (!client) return;

    const { defaultTtlSeconds } = getRedisConfig();

    const ttl =
      typeof ttlSeconds === "number" && ttlSeconds > 0
        ? Math.floor(ttlSeconds)
        : defaultTtlSeconds;
    const payload = JSON.stringify(value);

    await this.safe(async () => {
      if (ttl > 0) {
        await client.set(namespacedKey, payload, { EX: ttl });
      } else {
        await client.set(namespacedKey, payload);
      }
    }, undefined);
  }

  async del(key: string): Promise<void> {
    const namespacedKey = this.ns(key);
    this.memoryCache.delete(namespacedKey);

    const client = await this.client();
    if (!client) return;

    await this.safe(async () => {
      await client.del(namespacedKey);
    }, undefined);
  }
}

export const cacheService = new CacheService();