class UserDomainService {
    getBaseUrl() {
        return process.env.USER_DOMAIN_URL ?? "http://localhost:3000";
    }
    getInternalHeaders() {
        const secret = process.env.API_GATEWAY_INTERNAL_SECRET;
        return secret ? { "x-api-gateway-secret": secret } : {};
    }
    /** Returns profile data, or null when the user domain has no row for this Clerk user (HTTP 404). */
    async fetchMe(authorization, clerkUserId) {
        const response = await fetch(`${this.getBaseUrl().replace(/\/$/, "")}/api/users/me`, {
            headers: {
                ...(authorization ? { Authorization: authorization } : {}),
                ...(clerkUserId ? { "user-id": clerkUserId } : {}),
            },
        });
        const payload = (await response.json().catch(() => ({})));
        if (response.status === 404) {
            return null;
        }
        if (!response.ok) {
            throw Object.assign(new Error(payload?.message ?? `Failed to fetch user profile (${response.status}).`), {
                statusCode: response.status,
            });
        }
        return payload.data ?? null;
    }
    async listUsers(role) {
        const url = new URL(`${this.getBaseUrl().replace(/\/$/, "")}/api/users/admin/internal/users`);
        if (role)
            url.searchParams.set("role", role);
        const response = await fetch(url, {
            headers: this.getInternalHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message ?? `Failed to list users (${response.status}).`);
        }
        return payload.data ?? [];
    }
    async getUser(userId) {
        const users = await this.listUsers();
        return users.find((user) => user.id === userId) ?? null;
    }
    async suspendUser(userId) {
        const response = await fetch(`${this.getBaseUrl().replace(/\/$/, "")}/api/users/admin/internal/users/${encodeURIComponent(userId)}/suspend`, {
            method: "PATCH",
            headers: this.getInternalHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message ?? `Failed to suspend user (${response.status}).`);
        }
        return payload.data;
    }
    async deleteUser(userId) {
        const response = await fetch(`${this.getBaseUrl().replace(/\/$/, "")}/api/users/admin/internal/users/${encodeURIComponent(userId)}`, {
            method: "DELETE",
            headers: this.getInternalHeaders(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload?.message ?? `Failed to delete user (${response.status}).`);
        }
        return payload.data;
    }
    async onboardConsumer(payload) {
        return this.forwardOnboarding("/api/users/onboard/consumer", payload);
    }
    async onboardBrandAdmin(payload) {
        return this.forwardOnboarding("/api/users/onboard/brand-admin", payload);
    }
    async upsertFromClerk(payload) {
        return this.forwardOnboarding("/api/users/upsert-from-clerk", payload);
    }
    async forwardOnboarding(pathname, payload) {
        const response = await fetch(`${this.getBaseUrl().replace(/\/$/, "")}${pathname}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body?.message ?? body?.error ?? `Onboarding failed (${response.status}).`);
        }
        return body;
    }
}
export const userDomainService = new UserDomainService();
