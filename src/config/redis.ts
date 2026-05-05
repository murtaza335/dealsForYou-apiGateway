// config/redis.ts
import { createClient, type RedisClientType, type RedisClientOptions } from "redis";

export type RedisConfig = {
  url: string;
  prefix: string;
  defaultTtlSeconds: number;
};

const DEFAULTS = {
  url: "redis://localhost:6379",
  prefix: "api-gateway",
  ttl: 300,
};

let client: RedisClientType | null = null;
let connecting: Promise<RedisClientType> | null = null;
let isShuttingDown = false;
let redisDisabledUntil = 0;
let lastReconnectLogAt = 0;
let lastTransientLogAt = 0;

const REDIS_RETRY_COOLDOWN_MS = 5000;
const REDIS_FATAL_DISABLE_MS = 60_000;
const REDIS_MAX_RECONNECT_RETRIES = 8;
const REDIS_CONNECT_TIMEOUT_MS = 5000;

function isTransientRedisError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const code = "code" in err && typeof err.code === "string" ? err.code : "";

  return [
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EPIPE",
    "ECONNABORTED",
  ].includes(code);
}

function isTlsConfigError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const code = "code" in err && typeof err.code === "string" ? err.code : "";
  const message = "message" in err && typeof err.message === "string" ? err.message : "";

  if (["ERR_SSL_PACKET_LENGTH_TOO_LONG", "EPROTO"].includes(code)) return true;

  return /ssl|tls|handshake/i.test(message);
}

function redisTargetLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "<invalid-redis-url>";
  }
}

export function getRedisConfig(): RedisConfig {
  return {
    url: process.env.REDIS_URL?.trim() || DEFAULTS.url,
    prefix: process.env.REDIS_PREFIX?.trim() || DEFAULTS.prefix,
    defaultTtlSeconds: Number(process.env.REDIS_DEFAULT_TTL_SECONDS || DEFAULTS.ttl),
  };
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (isShuttingDown) return null;

  if (Date.now() < redisDisabledUntil) return null;

  if (client?.isReady) return client;

  if (client?.isOpen && !client.isReady) return null;

  if (connecting) return connecting;

  const config = getRedisConfig();

  const isTls = config.url.startsWith("rediss://");

  if (!client) {
    const socketBase = {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: (retries: number) => {
        if (isShuttingDown) return false;

        if (Date.now() < redisDisabledUntil) return false;

        if (retries >= REDIS_MAX_RECONNECT_RETRIES) {
          redisDisabledUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
          console.warn("[Redis] reconnect retry limit reached; cache disabled briefly");
          return false;
        }

        return Math.min((retries + 1) * 200, 2000);
      },
    };

    const socketOptions = isTls
      ? { ...socketBase, tls: true as const }
      : socketBase;

    const clientOptions: RedisClientOptions = {
      url: config.url,
      socket: socketOptions,
    };

    const newClient = createClient(clientOptions) as RedisClientType;
    client = newClient;

    newClient.on("error", (err) => {
      if (isTlsConfigError(err)) {
        redisDisabledUntil = Date.now() + REDIS_FATAL_DISABLE_MS;
        console.error(
          `[Redis] TLS/config error for ${redisTargetLabel(config.url)}; check REDIS_URL scheme/protocol and endpoint`
        );
        return;
      }

      if (isTransientRedisError(err)) {
        redisDisabledUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
        if (Date.now() - lastTransientLogAt > 2000) {
          lastTransientLogAt = Date.now();
          console.warn("[Redis] temporarily unavailable; cache disabled briefly");
        }
        return;
      }

      console.error("[Redis] error:", err);
    });

    newClient.on("end", () => {
      if (!isShuttingDown) {
        console.warn("[Redis] connection closed");
      }
    });

    newClient.on("reconnecting", () => {
      if (Date.now() - lastReconnectLogAt > 1500) {
        lastReconnectLogAt = Date.now();
        console.warn("[Redis] reconnecting...");
      }
    });
  }

  const activeClient = client;
  if (!activeClient) return null;

  connecting = activeClient
    .connect()
    .then(() => {
      console.log(`[Redis] connected (${redisTargetLabel(config.url)})`);
      return activeClient;
    })
    .catch((err) => {
      if (isTlsConfigError(err)) {
        redisDisabledUntil = Date.now() + REDIS_FATAL_DISABLE_MS;
        console.error(
          `[Redis] connect failed (TLS/config) for ${redisTargetLabel(config.url)}; check REDIS_URL`
        );
      } else if (isTransientRedisError(err)) {
        redisDisabledUntil = Date.now() + REDIS_RETRY_COOLDOWN_MS;
        console.warn("[Redis] connect failed; cache disabled briefly");
      } else {
        console.error("[Redis] connect failed:", err);
      }
      throw err;
    })
    .finally(() => {
      connecting = null;
    });

  try {
    return await connecting;
  } catch {
    return null;
  }
}

export async function closeRedisClient(): Promise<void> {
  isShuttingDown = true;

  try {
    if (client?.isOpen) {
      await client.quit();
    }
  } catch (err) {
    console.error("[Redis] shutdown error:", err);
  }

  client = null;
  connecting = null;
}