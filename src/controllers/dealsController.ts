import { RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  dealsService,
  type CurrentMoodDealsQuery,
  type RecommendedDealsQuery,
} from "../services/dealsService.js";

// export const getBrands: RequestHandler = async (req, res, next) => {
//   try {
//     console.log("[Gateway] GET /api/deals/brands");

//     const brands = await dealsService.getBrands();

//     console.log("[Gateway] Brands fetched:", brands.length);

//     res.status(200).json({
//       success: true,
//       data: brands,
//       message: "Brands fetched successfully",
//     });
//   } catch (error) {
//     console.error("[Gateway] getBrands failed:", error);
//     next(error);
//   }
// };

export const getFilteredDeals: RequestHandler = async (req, res, next) => {
  try {
    const query = req.query;

    console.log("[Gateway] GET /api/deals/filtered query:", query);

    const deals = await dealsService.getFilteredDeals(query);

    console.log("[Gateway] Filtered deals fetched:", Array.isArray(deals) ? deals.length : 0);

    res.status(200).json({
      success: true,
      data: deals,
      message: "Filtered deals fetched successfully",
    });
  } catch (error) {
    console.error("[Gateway] getFilteredDeals failed:", error);
    next(error);
  }
};

export const getDealFilterOptions: RequestHandler = async (_req, res, next) => {
  try {
    const options = await dealsService.getDealFilterOptions();

    res.status(200).json({
      success: true,
      data: options,
      message: "Deal filter options fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getDealFilterBrands: RequestHandler = async (_req, res, next) => {
  try {
    const brands = await dealsService.getDealFilterBrands();

    res.status(200).json({
      success: true,
      data: brands,
      message: "Deal filter brands fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getDealFilterCuisineTags: RequestHandler = async (_req, res, next) => {
  try {
    const tags = await dealsService.getDealFilterCuisineTags();

    res.status(200).json({
      success: true,
      data: tags,
      message: "Deal filter cuisine tags fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getDealFilterMealTypes: RequestHandler = async (_req, res, next) => {
  try {
    const mealTypes = await dealsService.getDealFilterMealTypes();

    res.status(200).json({
      success: true,
      data: mealTypes,
      message: "Deal filter meal types fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getDealFilterPriceRange: RequestHandler = async (_req, res, next) => {
  try {
    const range = await dealsService.getDealFilterPriceRange();

    res.status(200).json({
      success: true,
      data: range,
      message: "Deal filter price range fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getDealById: RequestHandler = async (req, res, next) => {
  try {
    const dealId = typeof req.params.dealId === "string" ? req.params.dealId.trim() : "";

    if (!dealId) {
      return res.status(400).json({
        success: false,
        message: "dealId is required.",
      });
    }

    const deal = await dealsService.getDealById(dealId);


    res.status(200).json({
      success: true,
      data: deal,
      message: "Deal fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getRecommendedDeals: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const query: RecommendedDealsQuery = {
      userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
      limit:
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    };

    const deals = await dealsService.getRecommendedDeals(query);

    res.status(200).json({
      success: true,
      data: deals,
      message: "Recommended deals fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getCurrentMoodDeals: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    const query: CurrentMoodDealsQuery = {
      userId: typeof req.query.userId === "string" ? req.query.userId : undefined,
      sessionId: auth.sessionId ?? undefined,
      limit:
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
    };

    if (!query.userId || !query.sessionId) {
      return res.status(400).json({
        success: false,
        message: "userId and sessionId are required.",
      });
    }

    const deals = await dealsService.getCurrentMoodDeals(query);

    return res.status(200).json({
      success: true,
      data: deals,
      message: "Current mood deals fetched successfully",
    });
  } catch (error) {
    return next(error);
  }
};

export const getTopDeals: RequestHandler = async (req, res, next) => {
  try {
    const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

    const deals = await dealsService.getTopDeals(limit);

    res.status(200).json({
      success: true,
      data: deals,
      message: "Top deals fetched successfully",
    });
  } catch (error) {
    next(error);
  }
};
