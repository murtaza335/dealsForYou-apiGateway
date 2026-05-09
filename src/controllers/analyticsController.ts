import type { RequestHandler } from "express";
import { analyticsService } from "../services/analyticsService.js";
import { getAuthContext } from "../utils/auth.js";


export const getTrendingDeals: RequestHandler = async (_req, res, next) => {
  try {
    const deals = await analyticsService.getTrendingDeals();

    res.status(200).json({
      success: true,
      data: deals,
      message: "Trending deals fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getTrendingBrands: RequestHandler = async (_req, res, next) => {
  try {
    const brands = await analyticsService.getTrendingBrands();

    res.status(200).json({
      success: true,
      data: brands,
      message: "Trending brands fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const trackEvent: RequestHandler = async (req, res, next) => {
  //get the session id from the request header
  const { sessionId } = getAuthContext(req);

  // adding session id to the request body
  const payload = { ...req.body, sessionId: sessionId ?? null };
  try {
    await analyticsService.trackEvent(payload);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

export const getFavourites: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuthContext(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const favourites = await analyticsService.getFavourites(userId);

    res.status(200).json({
      success: true,
      data: favourites,
      message: "Favourites fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getFavouritesDetails: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuthContext(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const details = await analyticsService.getFavouritesDetails(userId);

    res.status(200).json({
      success: true,
      data: details,
      message: "Favourites details fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const addFavourite: RequestHandler = async (req, res, next) => {
  console.log(`[Gateway] addFavourite request body:`, req.body);
  try {
    const { userId } = getAuthContext(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const payload = { ...req.body, userId };
    await analyticsService.addFavourite(payload);

    res.status(201).json({
      success: true,
      message: "Favourite added successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const removeFavourite: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = getAuthContext(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const payload = { ...req.body, userId };
    await analyticsService.removeFavourite(payload);

    res.status(200).json({
      success: true,
      message: "Favourite removed successfully",
    });
  } catch (error) {
    next(error);
  }
};
