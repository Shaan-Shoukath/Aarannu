/**
 * Community ID Platform — Express Server
 * ═══════════════════════════════════════
 *
 * Entry point for the backend API.
 *
 * Boot sequence:
 *   1. Load environment variables (dotenv).
 *   2. Create Express app.
 *   3. Apply global middleware (helmet, cors, rate-limiter, JSON parser).
 *   4. Mount route groups.
 *   5. Apply centralized error handler.
 *   6. Start listening.
 *
 * Security layers applied (in order):
 *   ┌─────────────────────────────────┐
 *   │  helmet        (HTTP headers)   │
 *   │  cors          (origin control) │
 *   │  rate limiter  (abuse guard)    │
 *   │  JSON parser   (body parsing)   │
 *   │  verifyToken   (JWT gate)       │
 *   │  checkApproval (business rule)  │
 *   │  controller    (logic)          │
 *   │  errorHandler  (catch-all)      │
 *   └─────────────────────────────────┘
 */

// ── 1. Environment ──────────────────────────────────────────
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

// ── 2. Create app ───────────────────────────────────────────
const app = express();

// ── 3. Global middleware ────────────────────────────────────

// Secure HTTP headers
app.use(helmet());

// CORS — allow the frontend origin in production, everything in dev
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Parse JSON bodies (with 10 MB limit to support PDF base64 email attachments)
app.use(express.json({ limit: "10mb" }));

// ── 4. Routes ───────────────────────────────────────────────
const authRoutes = require("./routes/authRoutes");
const idRoutes = require("./routes/idRoutes");
const adminRoutes = require("./routes/adminRoutes");
const proxyRoutes = require("./routes/proxyRoutes");
const emailRoutes = require("./routes/emailRoutes");
const orgRoutes = require("./routes/orgRoutes");
const projectRoutes = require("./routes/projectRoutes");
const projectMemberRoutes = require("./routes/projectMemberRoutes");
const generateRoutes = require("./routes/generateRoutes");
const verifyRoutes = require("./routes/verifyRoutes");
const bulkRoutes = require("./routes/bulkRoutes");
const tokenRoutes = require("./routes/tokenRoutes");
const formFieldRoutes = require("./routes/formFieldRoutes");
const sheetImportRoutes = require("./routes/sheetImportRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const renderRoutes = require("./routes/renderRoutes");

// Health check (no auth required)
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/ids", idRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/proxy", proxyRoutes);
app.use("/api/email", emailRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/members", projectMemberRoutes);
app.use("/api/generate", generateRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/bulk", bulkRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/form-fields", formFieldRoutes);
app.use("/api/sheets", sheetImportRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/render", renderRoutes);

// 404 catch-all for unknown routes
app.use((_req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist.",
  });
});

// ── 5. Centralized error handler ────────────────────────────
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// ── 6. (Auto-cleanup removed — expiry & cleanup is admin-controlled) ──
// Admins can trigger cleanup via POST /api/admin/cleanup

// ── 7. Start server ─────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║  Community ID Backend — Running            ║
  ║  Port : ${String(PORT).padEnd(35)}║
  ║  Env  : ${(process.env.NODE_ENV || "development").padEnd(35)}║
  ║  Time : ${new Date().toLocaleTimeString().padEnd(35)}║
  ╚════════════════════════════════════════════╝
  `);
});

module.exports = app; // export for testing
