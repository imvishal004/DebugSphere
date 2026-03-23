require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./src/config/database");
const errorHandler = require("./src/middleware/errorHandler");
const authRoutes = require("./src/routes/authRoutes");
const codeRoutes = require("./src/routes/codeRoutes");
const executionRoutes = require("./src/routes/executionRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "*", credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ───────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", service: "cloudexecx-api", time: new Date() })
);
app.use("/api/auth", authRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/executions", executionRoutes);

// ── Error handling ───────────────────────────────────────────
app.use(errorHandler);

// ── Boot ─────────────────────────────────────────────────────
(async () => {
  await connectDB();
  app.listen(PORT, () =>
    console.log(`✅  API server running on port ${PORT}`)
  );
})();

module.exports = app;