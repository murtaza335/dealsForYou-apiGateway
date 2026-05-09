import { getAuthContext } from "../utils/auth.js";
import { dealsService, } from "../services/dealsService.js";
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
export const getFilteredDeals = async (req, res, next) => {
    try {
        const query = req.query;
        console.log("[Gateway] GET /api/deals/filtered query:", query);
        const { items, pagination } = await dealsService.getFilteredDeals(query);
        console.log("[Gateway] Filtered deals fetched:", Array.isArray(items) ? items.length : 0);
        res.status(200).json({
            success: true,
            data: items,
            pagination,
            message: "Filtered deals fetched successfully",
        });
    }
    catch (error) {
        console.error("[Gateway] getFilteredDeals failed:", error);
        next(error);
    }
};
export const getDealFilterOptions = async (_req, res, next) => {
    try {
        const options = await dealsService.getDealFilterOptions();
        res.status(200).json({
            success: true,
            data: options,
            message: "Deal filter options fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getDealFilterBrands = async (_req, res, next) => {
    try {
        const brands = await dealsService.getDealFilterBrands();
        res.status(200).json({
            success: true,
            data: brands,
            message: "Deal filter brands fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getDealFilterCuisineTags = async (_req, res, next) => {
    try {
        const tags = await dealsService.getDealFilterCuisineTags();
        res.status(200).json({
            success: true,
            data: tags,
            message: "Deal filter cuisine tags fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getDealFilterMealTypes = async (_req, res, next) => {
    try {
        const mealTypes = await dealsService.getDealFilterMealTypes();
        res.status(200).json({
            success: true,
            data: mealTypes,
            message: "Deal filter meal types fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getDealFilterPriceRange = async (_req, res, next) => {
    try {
        const range = await dealsService.getDealFilterPriceRange();
        res.status(200).json({
            success: true,
            data: range,
            message: "Deal filter price range fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getDealById = async (req, res, next) => {
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
    }
    catch (error) {
        next(error);
    }
};
export const getRecommendedDeals = async (req, res, next) => {
    try {
        const { userId } = getAuthContext(req);
        const query = {
            userId: typeof req.query.userId === "string" ? req.query.userId : userId,
            limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
        };
        const deals = await dealsService.getRecommendedDeals(query);
        res.status(200).json({
            success: true,
            data: deals,
            message: "Recommended deals fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
export const getCurrentMoodDeals = async (req, res, next) => {
    try {
        const { userId, sessionId } = getAuthContext(req);
        const query = {
            userId: typeof req.query.userId === "string" ? req.query.userId : userId,
            sessionId: sessionId ?? undefined,
            limit: typeof req.query.limit === "string" ? Number(req.query.limit) : undefined,
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
    }
    catch (error) {
        return next(error);
    }
};
export const getTopDeals = async (req, res, next) => {
    try {
        const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
        const page = typeof req.query.page === "string" ? Number(req.query.page) : undefined;
        const { items, pagination } = await dealsService.getTopDeals({ page, limit });
        res.status(200).json({
            success: true,
            data: items,
            pagination,
            message: "Top deals fetched successfully",
        });
    }
    catch (error) {
        next(error);
    }
};
