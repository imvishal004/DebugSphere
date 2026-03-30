// backend/server.js
// Replace your current CORS setup with this robust version

require("dotenv").config();
require("./worker");

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const connectDB      = require("./src/config/database");
const errorHandler   = require("./src/middleware/errorHandler");
const authRoutes     = require("./src/routes/authRoutes");
const codeRoutes     = require("./src/routes/codeRoutes");
const executionRoutes = require("./src/routes/executionRoutes");

const app  = express();
const PORT = process.env.PORT || 5000;

// ── CORS ──────────────────────────────────────────────────────
// List every origin that is allowed to call the API.
// Add more entries if you deploy to a domain later.
const ALLOWED_ORIGINS = [
  "http://localhost:5173",   // Vite default
  "http://localhost:5174",   // Vite alternate port
  "http://localhost:3000",   // CRA / fallback
  "http://127.0.0.1:5173",   // some browsers use 127.0.0.1
  "http://127.0.0.1:5174",
  process.env.FRONTEND_URL,  // from .env (production URL)
].filter(Boolean);           // remove undefined if FRONTEND_URL not set

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);

    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫  CORS blocked request from origin: ${origin}`);
      console.warn(`    Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials:         true,   // allow cookies + Authorization header
  methods:             ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders:      ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,   // respond to preflight with 204
};

// ── Middleware ─────────────────────────────────────────────────
app.use(helmet());
app.use(cors(corsOptions));       // ← updated
app.options("*", cors(corsOptions)); // handle ALL preflight requests
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "debugsphere-api", time: new Date() })
);
app.use("/api/auth",       authRoutes);
app.use("/api/code",       codeRoutes);
app.use("/api/executions", executionRoutes);

// ── Error handling ────────────────────────────────────────────
app.use(errorHandler);

// ── Boot ──────────────────────────────────────────────────────
(async () => {
  await connectDB();
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`✅ API server running on port ${PORT}`);
  });
})();

module.exports = app;