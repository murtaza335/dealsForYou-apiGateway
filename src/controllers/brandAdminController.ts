import type { RequestHandler } from "express";
import { brandAdminService } from "../services/brandAdminService.js";
import { clerkAdminService } from "../services/clerkAdminService.js";
import { dealsService } from "../services/dealsService.js";
import { userDomainService } from "../services/userDomainService.js";
import { getAuthContext } from "../utils/auth.js";

type HttpError = Error & { statusCode?: number };

const httpError = (message: string, statusCode: number): HttpError => {
  const error = new Error(message) as HttpError;
  error.statusCode = statusCode;
  return error;
};

async function requireRole(req: Parameters<RequestHandler>[0], roles: string[]) {
  const { userId } = getAuthContext(req);
  if (!userId) {
    throw httpError("Unauthorized. Valid Clerk token is required.", 401);
  }

  const user = await userDomainService.fetchMe(req.headers.authorization, userId);
  if (!user) {
    throw httpError("User not found in domain.", 404);
  }

  if (!user.isActive) {
    throw httpError("Account suspended.", 403);
  }

  if (!roles.includes(user.role)) {
    throw httpError("Forbidden.", 403);
  }
  return user;
}

export const getMyBrand: RequestHandler = async (req, res, next) => {
  try {
    const user = await requireRole(req, ["BRAND_ADMIN"]);
    if (!user.brandId) return res.status(404).json({ success: false, message: "No brand linked." });
    const brand = await brandAdminService.getBrand(user.brandId);
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

export const getMyDeals: RequestHandler = async (req, res, next) => {
  try {
    const user = await requireRole(req, ["BRAND_ADMIN"]);
    if (!user.brandId) return res.status(404).json({ success: false, message: "No brand linked." });
    const deals = await brandAdminService.listDeals(user.brandId);
    res.status(200).json({ success: true, data: deals });
  } catch (error) {
    next(error);
  }
};

export const createMyDeal: RequestHandler = async (req, res, next) => {
  try {
    const user = await requireRole(req, ["BRAND_ADMIN"]);
    if (!user.brandId) return res.status(404).json({ success: false, message: "No brand linked." });
    const deal = await brandAdminService.createDeal(user.brandId, { ...req.body, createdBy: user.clerkUserId });
    res.status(201).json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

export const deleteMyDeal: RequestHandler = async (req, res, next) => {
  try {
    const user = await requireRole(req, ["BRAND_ADMIN"]);
    if (!user.brandId) return res.status(404).json({ success: false, message: "No brand linked." });
    const deal = await brandAdminService.deleteDeal(user.brandId, String(req.params.dealId));
    res.status(200).json({ success: true, data: deal });
  } catch (error) {
    next(error);
  }
};

export const listPendingBrands: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const brands = await brandAdminService.listPendingBrands();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

export const approveBrand: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const brand = await brandAdminService.approveBrand(String(req.params.brandId));
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

export const rejectBrand: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const brand = await brandAdminService.rejectBrand(String(req.params.brandId), req.body?.reason);
    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

const attachBrands = async (users: Array<Record<string, unknown>>) => {
  const brands = await brandAdminService.listBrands();
  const brandById = new Map(
    brands.map((brand: { brandId?: string }) => [brand.brandId, brand])
  );

  return users.map((user) => ({
    ...user,
    brand: typeof user.brandId === "string" ? brandById.get(user.brandId) ?? null : null,
  }));
};

export const listBrandAdmins: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const users = await userDomainService.listUsers("BRAND_ADMIN");
    const data = await attachBrands(users);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const listEndUsers: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const users = await userDomainService.listUsers("END_USER");
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};

export const suspendBrandAdmin: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const userId = String(req.params.userId);
    const user = await userDomainService.getUser(userId);

    if (!user) throw httpError("User not found.", 404);
    if (user.role !== "BRAND_ADMIN") throw httpError("User is not a brand admin.", 400);

    const suspendedUser = await userDomainService.suspendUser(userId);
    const brand = user.brandId ? await brandAdminService.suspendBrand(user.brandId) : null;

    res.status(200).json({ success: true, data: { user: suspendedUser, brand } });
  } catch (error) {
    next(error);
  }
};

export const deleteBrandAdmin: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const userId = String(req.params.userId);
    const user = await userDomainService.getUser(userId);

    if (!user) throw httpError("User not found.", 404);
    if (user.role !== "BRAND_ADMIN") throw httpError("User is not a brand admin.", 400);

    const clerkUser = await clerkAdminService.deleteUser(user.clerkUserId);
    const brand = user.brandId ? await brandAdminService.deleteBrand(user.brandId) : null;
    const deletedUser = await userDomainService.deleteUser(userId);

    res.status(200).json({ success: true, data: { user: deletedUser, brand, clerkUser } });
  } catch (error) {
    next(error);
  }
};

export const deleteEndUser: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const userId = String(req.params.userId);
    const user = await userDomainService.getUser(userId);

    if (!user) throw httpError("User not found.", 404);
    if (user.role !== "END_USER") throw httpError("User is not an end user.", 400);

    const clerkUser = await clerkAdminService.deleteUser(user.clerkUserId);
    const deletedUser = await userDomainService.deleteUser(userId);
    res.status(200).json({ success: true, data: { user: deletedUser, clerkUser } });
  } catch (error) {
    next(error);
  }
};

export const getAppAdminOverview: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);

    const [allUsers, endUsers, brandAdmins, appAdmins, brands, pendingBrands, topDeals] = await Promise.all([
      userDomainService.listUsers(),
      userDomainService.listUsers("END_USER"),
      userDomainService.listUsers("BRAND_ADMIN"),
      userDomainService.listUsers("APP_ADMIN"),
      brandAdminService.listBrands(),
      brandAdminService.listPendingBrands(),
      dealsService.getTopDeals({ limit: 8 }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers: allUsers.length,
        endUsers: endUsers.length,
        brandAdmins: brandAdmins.length,
        appAdmins: appAdmins.length,
        totalBrands: brands.length,
        pendingBrands: pendingBrands.length,
        approvedBrands: brands.filter((brand: { approvalStatus?: string }) => brand.approvalStatus === "APPROVED").length,
        topDeals: topDeals.items,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listAllBrandsForAdmin: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const brands = await brandAdminService.listBrands();
    res.status(200).json({ success: true, data: brands });
  } catch (error) {
    next(error);
  }
};

export const getBrandForAdmin: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const brand = await brandAdminService.getBrand(String(req.params.brandId));

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found." });
    }

    res.status(200).json({ success: true, data: brand });
  } catch (error) {
    next(error);
  }
};

export const getBrandDealsForAdmin: RequestHandler = async (req, res, next) => {
  try {
    await requireRole(req, ["APP_ADMIN"]);
    const deals = await brandAdminService.listDeals(String(req.params.brandId));
    res.status(200).json({ success: true, data: deals });
  } catch (error) {
    next(error);
  }
};
