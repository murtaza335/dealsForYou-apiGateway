import type { RequestHandler } from "express";

const readJsonResponse = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

export const uploadToCloudinary: RequestHandler = async (req, res, next) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const file = req.body?.file;
    const folder = req.body?.folder ?? "deals4you";

    if (!cloudName || !uploadPreset) {
      return res.status(500).json({
        success: false,
        message: "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.",
      });
    }

    if (typeof file !== "string" || file.length === 0) {
      return res.status(400).json({ success: false, message: "file is required." });
    }

    const formData = new FormData();
    formData.set("file", file);
    formData.set("upload_preset", uploadPreset);
    formData.set("folder", String(folder));

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });

    const payload = await readJsonResponse<{ secure_url?: string; public_id?: string; error?: { message?: string } }>(response);
    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: payload?.error?.message ?? "Upload failed." });
    }

    if (!payload?.secure_url) {
      return res.status(502).json({ success: false, message: "Upload response did not include an image URL." });
    }

    return res.status(201).json({
      success: true,
      data: {
        url: payload.secure_url,
        publicId: payload.public_id,
      },
    });
  } catch (error) {
    next(error);
  }
};
