require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");
const path    = require("path");

// ── Force Java PATH (CRITICAL FIX) ─────────────────────────

// This ensures Java installed during build is visible at runtime
const javaDir = path.join(process.cwd(), "java");

process.env.JAVA_HOME =
  process.env.JAVA_HOME || javaDir;

process.env.PATH =
  process.env.PATH + ":" +
  path.join(process.env.JAVA_HOME, "bin");

console.log("☕ JAVA_HOME:", process.env.JAVA_HOME);
console.log("☕ PATH includes Java:", process.env.PATH.includes("java"));

const connectDB       = require("./src/config/database");
const errorHandler    = require("./src/middleware/errorHandler");
const authRoutes      = require("./src/routes/authRoutes");
const codeRoutes      = require("./src/routes/codeRoutes");
const executionRoutes = require("./src/routes/executionRoutes");

const app  = express();

// ── PORT ───────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

// ── CORS ───────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://debug-sphere.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {

    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫  CORS blocked request from: ${origin}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials:          true,
  methods:              ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders:       ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

// ── Middleware ─────────────────────────────────────────────

app.use(helmet());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Health Check ───────────────────────────────────────────

app.get("/api/health", (_req, res) =>
  res.json({
    status:  "ok",
    service: "debugsphere-api",
    time:    new Date(),
    node:    process.version,
    env:     process.env.NODE_ENV || "development",
  })
);

// ── Routes ─────────────────────────────────────────────────

app.use("/api/auth",       authRoutes);
app.use("/api/code",       codeRoutes);
app.use("/api/executions", executionRoutes);

// ── Error handler ──────────────────────────────────────────

app.use(errorHandler);

// ── Start server ───────────────────────────────────────────

(async () => {

  await connectDB();

  app.listen(PORT, "0.0.0.0", () => {

    console.log(`✅ API server running on port ${PORT}`);

    console.log(
      `    NODE_ENV: ${process.env.NODE_ENV || "development"}`
    );

    console.log(
      `    FRONTEND_URL: ${
        process.env.FRONTEND_URL || "not set"
      }`
    );

    console.log(
      `    MONGODB: ${
        process.env.MONGODB_URI
          ? "configured"
          : "NOT SET"
      }`
    );

    console.log(
      `    REDIS: ${
        process.env.REDIS_URL
          ? "configured"
          : "NOT SET"
      }`
    );

  });

  // Start worker in same service
  require("./worker");

})();

module.exports = app;