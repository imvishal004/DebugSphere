const IORedis = require("ioredis");

let connection = null;

function getRedisConnection() {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,

      tls: {},   // ⭐ REQUIRED for Upstash
    });

    connection.on("connect", () =>
      console.log("🔴 Redis connected")
    );

    connection.on("error", (err) =>
      console.error("Redis error:", err.message)
    );
  }

  return connection;
}

module.exports = { getRedisConnection };