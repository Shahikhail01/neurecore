/**
 * Agents API Route
 * GET /api/v1/agents - List agents
 * POST /api/v1/agents - Create agent
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
import type { Agent, CreateAgentInput } from "@/lib/api/types";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, "ADMIN")) {
      return unauthorized("Admin access required");
    }

    const { searchParams } = new URL(request.url);
    const query = new URLSearchParams(searchParams);
    if (!query.has("page")) query.set("page", "1");
    if (!query.has("limit")) query.set("limit", "10");

    const result = await apiRequest<{ data: Agent[]; total: number }>(
      `/api/v1/agents?${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } },
    );

    return successResponse(result);
  } catch (error) {
    console.error("List agents error:", error);
    return serverError("Failed to fetch agents");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, "ADMIN")) {
      return unauthorized("Admin access required");
    }

    const body = await request.json();
    const { name, description, tenantId, departmentId, templateId } = body;

    if (!name || !tenantId) {
      return badRequest("Missing required fields: name, tenantId");
    }

    const input: CreateAgentInput = {
      name,
      description,
      tenantId,
      departmentId,
      templateId,
    };

    const result = await apiRequest<Agent>("/agents", {
      method: "POST",
      body: input,
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error("Create agent error:", error);
    return serverError("Failed to create agent");
  }
}
