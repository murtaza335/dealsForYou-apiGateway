import { clerkClient } from "@clerk/express";

const isNotFoundError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as {
    status?: number;
    statusCode?: number;
    errors?: Array<{ code?: string; message?: string }>;
  };

  return (
    candidate.status === 404 ||
    candidate.statusCode === 404 ||
    Boolean(candidate.errors?.some((entry) => entry.code?.includes("not_found")))
  );
};

class ClerkAdminService {
  async deleteUser(clerkUserId: string) {
    try {
      return await clerkClient.users.deleteUser(clerkUserId);
    } catch (error) {
      if (isNotFoundError(error)) {
        return null;
      }

      throw error;
    }
  }
}

export const clerkAdminService = new ClerkAdminService();
