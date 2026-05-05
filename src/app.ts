import express, { Application, type RequestHandler } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { clerkMiddleware } from "@clerk/express";
import dealsRoutes from "./routes/deals.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import userRoutes from "./routes/user.routes.js";
import brandAdminRoutes from "./routes/brandAdmin.routes.js";
import appAdminRoutes from "./routes/appAdmin.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { notFoundHandler } from "./middlewares/notFoundHandler.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import brandRoutes from "./routes/brand.routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const app: Application = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));
const clerkAuthMiddleware = clerkMiddleware({
  publishableKey:
    process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}) as unknown as RequestHandler;

app.use(clerkAuthMiddleware);

// Routes
app.use("/api/deals", dealsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/brand-admin", brandAdminRoutes);
app.use("/api/app-admin", appAdminRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/brands", brandRoutes);// brand routes added

// Error middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
