import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const message = err instanceof Error ? err.message : "Internal server error";
  const statusCode =
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err &&
    typeof err.statusCode === "number"
      ? err.statusCode
      : 500;

  console.error(`[Gateway] ${req.method} ${req.originalUrl} failed:`, err);

  res.status(statusCode).json({
    success: false,
    message,
  });
};
