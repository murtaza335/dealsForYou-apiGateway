import type { RequestHandler } from "express";
import { getAuth } from "@clerk/express";

export const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized. Valid Clerk token is required.",
    });
  }

  return next();
};
