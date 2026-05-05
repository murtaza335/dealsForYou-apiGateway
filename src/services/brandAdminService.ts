class BrandAdminService {
  private getDealsServiceBaseUrl() {
    return process.env.deals_url ?? process.env.DEALS_URL ?? "http://localhost:5002";
  }

  private async fetchFromDeals(pathname: string, init?: RequestInit) {
    const response = await fetch(`${this.getDealsServiceBaseUrl().replace(/\/$/, "")}${pathname}`, init);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.message ?? `Deals service request failed (${response.status}).`);
    }

    return payload;
  }

  async getBrand(brandId: string) {
    const payload = await this.fetchFromDeals(`/api/brands/by-brand-id/${encodeURIComponent(brandId)}`);
    return payload.data ?? null;
  }

  async listBrands() {
    const payload = await this.fetchFromDeals("/api/brands");
    return payload.data ?? [];
  }

  async listDeals(brandId: string) {
    const payload = await this.fetchFromDeals(`/api/brands/${encodeURIComponent(brandId)}/deals`);
    return payload.data ?? [];
  }

  async createDeal(brandId: string, payload: unknown) {
    const response = await this.fetchFromDeals(`/api/brands/${encodeURIComponent(brandId)}/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.data;
  }

  async deleteDeal(brandId: string, dealId: string) {
    const response = await this.fetchFromDeals(
      `/api/brands/${encodeURIComponent(brandId)}/deals/${encodeURIComponent(dealId)}`,
      { method: "DELETE" }
    );
    return response.data;
  }

  async listPendingBrands() {
    const payload = await this.fetchFromDeals("/api/brands/pending");
    return payload.data ?? [];
  }

  async approveBrand(brandId: string) {
    const payload = await this.fetchFromDeals(`/api/brands/${encodeURIComponent(brandId)}/approve`, {
      method: "PATCH",
    });
    return payload.data;
  }

  async rejectBrand(brandId: string, reason?: string) {
    const payload = await this.fetchFromDeals(`/api/brands/${encodeURIComponent(brandId)}/reject`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    return payload.data;
  }

  async suspendBrand(brandId: string) {
    const payload = await this.fetchFromDeals(`/api/brands/${encodeURIComponent(brandId)}/suspend`, {
      method: "PATCH",
    });
    return payload.data;
  }

  async deleteBrand(brandId: string) {
    const payload = await this.fetchFromDeals(`/api/brands/${encodeURIComponent(brandId)}`, {
      method: "DELETE",
    });
    return payload.data;
  }
}

export const brandAdminService = new BrandAdminService();
