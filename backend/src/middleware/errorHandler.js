/**
 * Centralized Error Handler
 * ─────────────────────────
 * Express error-handling middleware (4-argument signature).
 *
 * Catches any error thrown or passed via `next(err)` across the
 * entire request lifecycle and returns a consistent JSON response.
 *
 * In production:
 *   - Stack traces are NEVER sent to the client.
 *   - Errors are logged to stdout for observability.
 *
 * In development:
 *   - Stack traces are included in the response for debugging.
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Default to 500 if no status code was set
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  // Always log — even in production (for observability / logging tools)
  console.error(
    `[ERROR] ${req.method} ${req.originalUrl} → ${statusCode}`,
    err.message,
  );
  if (!isProduction) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: err.name || "Internal Server Error",
    message: isProduction
      ? "Something went wrong. Please try again later."
      : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = errorHandler;
