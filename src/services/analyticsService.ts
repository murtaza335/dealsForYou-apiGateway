class AnalyticsService {
  private getAnalyticsServiceBaseUrl() {
    return process.env.ANALYTICS_URL ?? "http://localhost:5000";
  }

  private buildQueryString(query: Record<string, unknown>) {
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

  private async fetchFromAnalyticsService(pathname: string, query?: Record<string, unknown>) {
    const analyticsServiceBaseUrl = this.getAnalyticsServiceBaseUrl();
    const queryString = query ? this.buildQueryString(query) : "";
    const url = `${analyticsServiceBaseUrl.replace(/\/$/, "")}${pathname}${queryString ? `?${queryString}` : ""
      }`;

    console.log("[Gateway] Forwarding analytics request to:", url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch from analytics service (${response.status}).`);
    }

    return response.json() as Promise<{ data?: unknown[] | unknown }>;
  }

  async getTrendingDeals() {
    const payload = await this.fetchFromAnalyticsService("/api/analytics/trending/deals");
    return payload.data ?? [];
  }

  async getTrendingBrands() {
    const payload = await this.fetchFromAnalyticsService("/api/analytics/trending/brands");
    return payload.data ?? [];
  }

  private async postToAnalyticsService(pathname: string, body: unknown) {
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

  async trackEvent(payload: unknown) {
    return this.postToAnalyticsService("/api/analytics/event", payload);
  }
}

export const analyticsService = new AnalyticsService();
