/**
 * Analytics API Route
 * GET /api/v1/analytics - Get analytics data
 */

import { NextRequest } from "next/server";
import { successResponse, badRequest, serverError } from "@/lib/api/response";
import { apiRequest, getAuthToken } from "@/lib/api/database";
import { authenticate } from "@/lib/api/auth";
import type { AnalyticsData, ForecastData } from "@/lib/api/types";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    const { searchParams } = new URL(request.url);

    const type = searchParams.get("type") || "overview";
    const period = searchParams.get("period") || "7d";
    const tenantId = searchParams.get("tenantId") || user.tenantId;
    const scope = searchParams.get("scope");

    if (!tenantId && !scope) {
      if (user.tenantId) {
        // tenant-scoped caller falls back to authenticated tenant below
      } else {
        searchParams.set("scope", "platform");
      }
    }

    const query = new URLSearchParams({ type, period });
    const resolvedScope = searchParams.get("scope");
    if (tenantId) query.set("tenantId", tenantId);
    if (resolvedScope) query.set("scope", resolvedScope);

    const result = await apiRequest<AnalyticsData | ForecastData>(
      `/api/v1/analytics?${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } },
    );

    return successResponse(result);
  } catch (error) {
    console.error("Analytics error:", error);
    return serverError("Failed to fetch analytics");
  }
}
