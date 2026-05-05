class AnalyticsService {
    getAnalyticsServiceBaseUrl() {
        return process.env.ANALYTICS_URL ?? "http://localhost:5000";
    }
    buildQueryString(query) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (typeof value === "string" && value.trim().length > 0) {
                searchParams.append(key, value.trim());
                continue;
            }
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (typeof item === "string" && item.trim().length > 0) {
                        searchParams.append(key, item.trim());
                    }
                }
            }
        }
        return searchParams.toString();
    }
    async fetchFromAnalyticsService(pathname, query) {
        const analyticsServiceBaseUrl = this.getAnalyticsServiceBaseUrl();
        const queryString = query ? this.buildQueryString(query) : "";
        const url = `${analyticsServiceBaseUrl.replace(/\/$/, "")}${pathname}${queryString ? `?${queryString}` : ""}`;
        console.log("[Gateway] Forwarding analytics request to:", url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from analytics service (${response.status}).`);
        }
        return response.json();
    }
    async getTrendingDeals() {
        const payload = await this.fetchFromAnalyticsService("/api/analytics/trending/deals");
        return payload.data ?? [];
    }
    async getTrendingBrands() {
        const payload = await this.fetchFromAnalyticsService("/api/analytics/trending/brands");
        return payload.data ?? [];
    }
    async postToAnalyticsService(pathname, body) {
        const analyticsServiceBaseUrl = this.getAnalyticsServiceBaseUrl();
        const url = `${analyticsServiceBaseUrl.replace(/\/$/, "")}${pathname}`;
        console.log("[Gateway] Forwarding analytics POST request to:", url);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Failed to POST to analytics service (${response.status}).`);
        }
    }
    async trackEvent(payload) {
        return this.postToAnalyticsService("/api/analytics/event", payload);
    }
}
export const analyticsService = new AnalyticsService();
