import { Router } from "express";
import { uploadToCloudinary } from "../controllers/uploadController.js";

const router = Router();

router.post("/cloudinary", uploadToCloudinary);

export default router;
