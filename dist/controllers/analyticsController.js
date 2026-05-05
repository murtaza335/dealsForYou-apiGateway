import { getAuth } from "@clerk/express";
import { analyticsService } from "../services/analyticsService.js";
export const getTrendingDeals = async (_req, res, next) => {
    try {
        const deals = await analyticsService.getTrendingDeals();
        res.status(200).json({
            success: true,
            data: deals,
            message: "Trending deals fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getTrendingBrands = async (_req, res, next) => {
    try {
        const brands = await analyticsService.getTrendingBrands();
        res.status(200).json({
            success: true,
            data: brands,
            message: "Trending brands fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const trackEvent = async (req, res, next) => {
    //get the session id from the request header
    const sessionId = getAuth(req)?.sessionId ?? null;
    // adding session id to the request body
    const payload = { ...req.body,
        sessionId: sessionId
    };
    try {
        await analyticsService.trackEvent(payload);
        res.status(204).end();
    }
    catch (error) {
        next(error);
    }
};
