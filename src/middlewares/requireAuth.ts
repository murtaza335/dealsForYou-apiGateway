import type { RequestHandler } from "express";
import { getAuthContext } from "../utils/auth.js";

export const requireAuth: RequestHandler = (req, res, next) => {
  const { isAuthenticated } = getAuthContext(req);

  if (!isAuthenticated) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Valid Clerk token is required.",
    });
  }

  return next();
};
