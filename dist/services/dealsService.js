const DEFAULT_RECOMMENDATION_LIMIT = 12;
class DealsService {
    getDealsServiceBaseUrl() {
        return process.env.deals_url ?? process.env.DEALS_URL ?? "http://localhost:5002";
    }
    getRecommendationServiceBaseUrl() {
        return process.env.RECOMMENDATION_URL ?? "http://localhost:3005";
    }
    buildQueryString(query) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === "string" && value.trim().length > 0) {
                searchParams.append(key, value.trim());
                continue;
            }
            if (typeof value === "number" && Number.isFinite(value)) {
                searchParams.append(key, String(value));
                continue;
            }
            if (typeof value === "boolean") {
                searchParams.append(key, String(value));
                continue;
            }
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (typeof item === "string" && item.trim().length > 0) {
                        searchParams.append(key, item.trim());
                    }
                    else if (typeof item === "number" && Number.isFinite(item)) {
                        searchParams.append(key, String(item));
                    }
                    else if (typeof item === "boolean") {
                        searchParams.append(key, String(item));
                    }
                }
            }
        }
        return searchParams.toString();
    }
    async fetchFromDealsService(pathname, query) {
        const dealsServiceBaseUrl = this.getDealsServiceBaseUrl();
        const queryString = query ? this.buildQueryString(query) : "";
        const url = `${dealsServiceBaseUrl.replace(/\/$/, "")}${pathname}${queryString ? `?${queryString}` : ""}`;
        console.log("[Gateway] Forwarding deals request to:", url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from deals service (${response.status}).`);
        }
        return response.json();
    }
    async fetchFromRecommendationService(pathname, query) {
        const recommendationServiceBaseUrl = this.getRecommendationServiceBaseUrl();
        const queryString = query ? this.buildQueryString(query) : "";
        const url = `${recommendationServiceBaseUrl.replace(/\/$/, "")}${pathname}${queryString ? `?${queryString}` : ""}`;
        console.log("[Gateway] Forwarding recommendation request to:", url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from recommendation service (${response.status}).`);
        }
        return response.json();
    }
    resolveRecommendationLimit(limit) {
        return Number.isFinite(limit) && limit && limit > 0 ? Math.floor(limit) : DEFAULT_RECOMMENDATION_LIMIT;
    }
    async getFilteredDeals(query) {
        const payload = await this.fetchFromDealsService("/api/deals", query);
        return {
            items: payload.data ?? [],
            pagination: payload.pagination,
        };
    }
    async getDealFilterOptions() {
        const payload = await this.fetchFromDealsService("/api/deals/filters/options");
        return payload.data ?? {};
    }
    async getDealFilterBrands() {
        const payload = await this.fetchFromDealsService("/api/deals/filters/brands");
        return payload.data ?? [];
    }
    async getDealFilterCuisineTags() {
        const payload = await this.fetchFromDealsService("/api/deals/filters/cuisine-tags");
        return payload.data ?? [];
    }
    async getDealFilterMealTypes() {
        const payload = await this.fetchFromDealsService("/api/deals/filters/meal-types");
        return payload.data ?? [];
    }
    async getDealFilterPriceRange() {
        const payload = await this.fetchFromDealsService("/api/deals/filters/price-range");
        return payload.data ?? { min: 0, max: 0 };
    }
    async getDealById(dealId) {
        const payload = await this.fetchFromDealsService(`/api/deals/${dealId}`);
        return payload.data ?? null;
    }
    async getDealsByIds(dealIds) {
        if (!dealIds.length) {
            return [];
        }
        const payload = await this.fetchFromDealsService("/api/deals/bulk", {
            ids: dealIds,
        });
        return payload.data ?? [];
    }
    async getRecommendedDeals(query) {
        if (!query.userId) {
            throw new Error("userId is required.");
        }
        const recommendationServiceBaseUrl = this.getRecommendationServiceBaseUrl();
        const url = `${recommendationServiceBaseUrl.replace(/\/$/, "")}/api/recommendations/refresh/${encodeURIComponent(query.userId)}`;
        console.log("[Gateway] Forwarding recommended deals request to:", url);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                limit: this.resolveRecommendationLimit(query.limit),
            }),
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch recommendations (${response.status}).`);
        }
        const payload = (await response.json());
        const dealIds = payload.recommendedDealIds ?? [];
        return this.getDealsByIds(dealIds);
    }
    async getCurrentMoodDeals(query) {
        if (!query.userId) {
            throw new Error("userId is required.");
        }
        if (!query.sessionId) {
            throw new Error("sessionId is required.");
        }
        const payload = await this.fetchFromRecommendationService(`/api/recommendations/current-mood/${encodeURIComponent(query.userId)}`, {
            sessionId: query.sessionId,
            limit: String(this.resolveRecommendationLimit(query.limit)),
        });
        const dealIds = payload.recommendedDealIds ?? [];
        return this.getDealsByIds(dealIds);
    }
    async getTopDeals({ page, limit: requestedLimit } = {}) {
        const limit = Number.isFinite(requestedLimit) && requestedLimit && requestedLimit > 0
            ? Math.floor(requestedLimit)
            : 8;
        const normalizedPage = Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1;
        const payload = await this.fetchFromDealsService("/api/deals", {
            page: normalizedPage,
            limit,
            sortBy: "viewsCount",
            sortOrder: "desc",
            isActive: true,
            isExpired: false,
        });
        return {
            items: payload.data ?? [],
            pagination: payload.pagination,
        };
    }
    async getBrandsInfo() {
        const dealsServiceBaseUrl = process.env.deals_url ?? process.env.DEALS_URL ?? "http://localhost:5002";
        const url = `${dealsServiceBaseUrl.replace(/\/$/, "")}/api/deals/filters/brands`;
        console.log("[Gateway] Forwarding brands request to:", url);
        const response = await fetch(url);
        console.log("[Gateway] Deals service response status:", response.status);
        if (!response.ok) {
            throw new Error(`Failed to fetch brands from deals service (${response.status}).`);
        }
        const payload = (await response.json());
        return payload.data ?? [];
    }
}
export const dealsService = new DealsService();
