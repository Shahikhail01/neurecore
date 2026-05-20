/**
 * Finance API Route
 * GET /api/v1/finance - Get finance data (invoices, expenses)
 */

import { NextRequest } from "next/server";
import { successResponse, unauthorized, serverError } from "@/lib/api/response";
import { apiRequest, getAuthToken } from "@/lib/api/database";
import { authenticate, hasRole } from "@/lib/api/auth";
import type { Invoice, Expense } from "@/lib/api/types";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, "ADMIN")) {
      return unauthorized("Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "invoices"; // invoices | expenses
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const tenantId = searchParams.get("tenantId") || user.tenantId;
    const scope = searchParams.get("scope");

    const query = new URLSearchParams({
      type,
      page: page.toString(),
      limit: limit.toString(),
    });
    if (tenantId) query.set("tenantId", tenantId);
    if (!tenantId && scope) query.set("scope", scope);
    if (!tenantId && !scope && !user.tenantId && type === "invoices") {
      query.set("scope", "platform");
    }

    const endpoint =
      type === "expenses" ? "/finance/expenses" : "/finance/invoices";
    const result = await apiRequest<{
      data: Invoice[] | Expense[];
      total: number;
    }>(`${endpoint}?${query}`, {
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result);
  } catch (error) {
    console.error("Finance error:", error);
    return serverError("Failed to fetch finance data");
  }
}
