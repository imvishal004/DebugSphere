// backend/src/config/redis.js
// Updated to use REDIS_URL (Upstash) instead of REDIS_HOST + REDIS_PORT

const IORedis = require("ioredis");

let redisClient = null;

function getRedisConnection() {
  if (redisClient) return redisClient;

  // Use REDIS_URL if available (Upstash / cloud)
  // Fall back to host + port for local development
  if (process.env.REDIS_URL) {
    redisClient = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,   // required by BullMQ
      enableReadyCheck:     false,  // required for Upstash
      tls:                  {},     // required for Upstash TLS
    });
  } else {
    redisClient = new IORedis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck:     false,
    });
  }

  redisClient.on("connect", () => console.log("🔴  Redis connected"));
  redisClient.on("error",   (err) => console.error("❌  Redis error:", err.message));

  return redisClient;
}

module.exports = { getRedisConnection };