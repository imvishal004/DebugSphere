const IORedis = require("ioredis");

let connection = null;

function getRedisConnection() {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
    connection.on("connect", () => console.log("🔴  Redis connected"));
    connection.on("error", (err) => console.error("Redis error:", err.message));
  }
  return connection;
}

module.exports = { getRedisConnection };