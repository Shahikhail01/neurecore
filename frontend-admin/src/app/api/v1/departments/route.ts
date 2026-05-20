/**
 * Departments API Route
 * GET /api/v1/departments - List departments
 * POST /api/v1/departments - Create department
 */

import { NextRequest } from "next/server";
import {
  successResponse,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/api/response";
import { apiRequest, getAuthToken } from "@/lib/api/database";
import { authenticate, hasRole } from "@/lib/api/auth";
import type { Department } from "@/lib/api/types";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId");
    const scope = searchParams.get("scope");

    if (!tenantId && scope !== "platform" && user.role !== "SUPER_ADMIN") {
      return badRequest("tenantId is required");
    }

    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    const result = await apiRequest<{ data: Department[] }>(
      `/api/v1/departments${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } },
    );

    return successResponse(result);
  } catch (error) {
    console.error("List departments error:", error);
    return serverError("Failed to fetch departments");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, "ADMIN")) {
      return unauthorized("Admin access required");
    }

    const body = await request.json();
    const { name, tenantId, parentId } = body;

    if (!name || !tenantId) {
      return badRequest("Missing required fields: name, tenantId");
    }

    const result = await apiRequest<Department>("/departments", {
      method: "POST",
      body: { name, tenantId, parentId },
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error("Create department error:", error);
    return serverError("Failed to create department");
  }
}
