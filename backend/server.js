require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const connectDB       = require("./src/config/database");
const errorHandler    = require("./src/middleware/errorHandler");
const authRoutes      = require("./src/routes/authRoutes");
const codeRoutes      = require("./src/routes/codeRoutes");
const executionRoutes = require("./src/routes/executionRoutes");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Trust Proxy ────────────────────────────────────────────
// MUST be set before any middleware that reads IP addresses.
// Render (and most cloud platforms) sit behind a load balancer
// that adds X-Forwarded-For headers.
// Without this setting express-rate-limit throws:
//   ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
// Value of 1 means trust one level of proxy (Render's LB).
app.set("trust proxy", 1);

// ── CORS ───────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫  CORS blocked: ${origin}`);
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

// ── Health check ───────────────────────────────────────────
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
    console.log(`✅  API server running on port ${PORT}`);
    console.log(`    NODE_ENV:     ${process.env.NODE_ENV   || "development"}`);
    console.log(`    FRONTEND_URL: ${process.env.FRONTEND_URL || "not set"}`);
    console.log(`    MONGODB:      ${process.env.MONGODB_URI  ? "configured" : "NOT SET"}`);
    console.log(`    REDIS:        ${process.env.REDIS_URL    ? "configured" : "NOT SET (local)"}`);
    console.log(`    AI:           ${process.env.AI_ENABLED === "false" ? "disabled" : "enabled"}`);
  });
})();

module.exports = app;