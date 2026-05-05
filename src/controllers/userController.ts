import type { RequestHandler } from "express";
import { userDomainService } from "../services/userDomainService.js";
import { getAuthContext } from "../utils/auth.js";

export const getMe: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuthContext(req);
    if (!userId?.trim()) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const data = await userDomainService.fetchMe(req.headers.authorization, userId);
    if (data === null) {
      return res.status(404).json({
        success: false,
        message: "User not found in domain DB",
      });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const onboardConsumer: RequestHandler = async (req, res, next) => {
  try {
    const payload = await userDomainService.onboardConsumer(req.body);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
};

export const onboardBrandAdmin: RequestHandler = async (req, res, next) => {
  try {
    const payload = await userDomainService.onboardBrandAdmin(req.body);
    res.status(201).json(payload);
  } catch (error) {
    next(error);
  }
};

export const upsertFromClerk: RequestHandler = async (req, res, next) => {
  try {
    const payload = await userDomainService.upsertFromClerk(req.body);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};
