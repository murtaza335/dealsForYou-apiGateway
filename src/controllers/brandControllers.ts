import { RequestHandler } from "express";
import { dealsService } from "../services/dealsService.js";

// make the controller for the following api 
// get brand info 

export const getBrandsInfo: RequestHandler = async (req, res, next) => {
    try {
        console.log("[Gateway] GET /api/deals/brands");
        
        const brands = await dealsService.getBrandsInfo();
        console.log("[Gateway] Brands fetched:", brands.length);
        
        res.status(200).json({
            success: true,
            data: brands,
            message: "Brands fetched successfully",
        });
    }
    catch (error) {
        console.error("[Gateway] getBrands failed:", error);
        next(error);
    }
};