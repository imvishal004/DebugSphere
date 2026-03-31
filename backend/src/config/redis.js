// ─────────────────────────────────────────────────────────────
// redis.js
//
// Supports two connection modes:
//   1. REDIS_URL  (Upstash cloud — uses rediss:// TLS URL)
//   2. REDIS_HOST + REDIS_PORT  (local Redis)
//
// BullMQ requires specific ioredis options:
//   maxRetriesPerRequest: null   (mandatory for BullMQ)
//   enableReadyCheck: false      (mandatory for Upstash)
// ─────────────────────────────────────────────────────────────

const IORedis = require("ioredis");

let redisClient = null;

function getRedisConnection() {
  if (redisClient) return redisClient;

  if (process.env.REDIS_URL) {
    // ── Upstash / Cloud Redis (TLS) ────────────────────
    // REDIS_URL format: rediss://default:TOKEN@host:port
    // "rediss://" (double-s) means TLS is required.
    // Upstash uses self-signed certs so rejectUnauthorized: false
    console.log("🔴  Connecting to Redis via REDIS_URL (Upstash)...");

    redisClient = new IORedis(process.env.REDIS_URL, {
      // ── Required by BullMQ ─────────────────────────
      maxRetriesPerRequest: null,

      // ── Required for Upstash ───────────────────────
      enableReadyCheck: false,

      // ── TLS for Upstash ────────────────────────────
      tls: {
        rejectUnauthorized: false,
      },

      // ── Reconnect strategy ─────────────────────────
      retryStrategy: (times) => {
        if (times > 5) {
          console.error("❌  Redis: max retries reached");
          return null; // stop retrying
        }
        const delay = Math.min(times * 500, 3000);
        console.log(`🔄  Redis: retry ${times} in ${delay}ms`);
        return delay;
      },

      lazyConnect: false,
    });

  } else {
    // ── Local Redis (no TLS) ───────────────────────────
    console.log(
      `🔴  Connecting to local Redis at ` +
      `${process.env.REDIS_HOST || "localhost"}:` +
      `${process.env.REDIS_PORT || 6379}...`
    );

    redisClient = new IORedis({
      host:                 process.env.REDIS_HOST || "localhost",
      port:                 parseInt(process.env.REDIS_PORT, 10) || 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck:     false,

      retryStrategy: (times) => {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
    });
  }

  // ── Event listeners ──────────────────────────────────
  redisClient.on("connect", () =>
    console.log("🔴  Redis connected")
  );

  redisClient.on("ready", () =>
    console.log("✅  Redis ready")
  );

  redisClient.on("error", (err) =>
    console.error("❌  Redis error:", err.message)
  );

  redisClient.on("close", () =>
    console.warn("⚠️   Redis connection closed")
  );

  redisClient.on("reconnecting", () =>
    console.log("🔄  Redis reconnecting...")
  );

  return redisClient;
}

module.exports = { getRedisConnection };