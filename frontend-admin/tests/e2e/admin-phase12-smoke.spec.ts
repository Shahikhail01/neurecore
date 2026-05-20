import { expect, test, type Page, type Route } from "@playwright/test";

const adminUser = {
  id: "admin-1",
  email: "noreply@neurecore.ai",
  role: "SUPER_ADMIN",
  tenantId: "platform",
};

const tiers = [
  {
    id: "tier-starter",
    name: "Starter",
    slug: "starter",
    description: "Starter tier",
    isActive: true,
    isDefault: true,
    sortOrder: 1,
    monthlyPrice: 29,
    yearlyPrice: 290,
    currency: "USD",
    maxUsers: 5,
    maxAgents: 3,
    maxStorageGB: 10,
    maxApiCalls: 10000,
    maxConversationMessages: 5000,
    maxFileSizeMB: 50,
    allowCustomBranding: false,
    allowApiAccess: false,
    allowSso: false,
    allowAuditExport: false,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  {
    id: "tier-growth",
    name: "Growth",
    slug: "growth",
    description: "Growth tier",
    isActive: true,
    isDefault: false,
    sortOrder: 2,
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: "USD",
    maxUsers: 25,
    maxAgents: 10,
    maxStorageGB: 100,
    maxApiCalls: 100000,
    maxConversationMessages: 50000,
    maxFileSizeMB: 250,
    allowCustomBranding: true,
    allowApiAccess: true,
    allowSso: false,
    allowAuditExport: true,
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
];

const agentTemplates = {
  items: [
    {
      id: "agent-template-1",
      name: "Ops Agent",
      description: "Operational agent",
      type: "FUNCTIONAL",
      model: "gpt-4o-mini",
      systemPrompt: "Prompt",
      instructions: "Instructions",
      permissions: ["read_analytics"],
      config: {},
      isPublic: true,
      version: "1.0.0",
      tenantId: null,
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  total: 1,
};

const departmentTemplates = {
  items: [
    {
      id: "department-template-1",
      name: "Operations",
      slug: "operations",
      description: "Ops structure",
      category: "general",
      tags: ["ops"],
      isPublic: true,
      structure: [
        {
          name: "Operations",
          description: "Primary ops department",
          headAgentType: "CORE",
          parentName: "",
          agentTemplateNames: ["Ops Agent"],
        },
      ],
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-01T00:00:00.000Z",
    },
  ],
  total: 1,
};

const tenantRecord = {
  id: "tenant-1",
  name: "Tenant One",
  slug: "tenant-one",
  status: "ACTIVE",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
  tierId: "tier-starter",
  tier: {
    id: "tier-starter",
    name: "Starter",
    slug: "starter",
    maxAgents: 3,
  },
};

const tenants = {
  items: [tenantRecord],
  total: 1,
};

const departments = {
  items: [
    {
      id: "department-1",
      name: "Operations",
      createdAt: "2026-05-01T00:00:00.000Z",
      templateId: "department-template-1",
      deployedFromTierId: "tier-starter",
      isFixed: true,
      isSelected: true,
    },
  ],
  total: 1,
};

const agents = {
  items: [
    {
      id: "agent-1",
      name: "Ops Agent",
      type: "FUNCTIONAL",
      model: "gpt-4o-mini",
      status: "ACTIVE",
      createdAt: "2026-05-01T00:00:00.000Z",
      templateId: "agent-template-1",
      deployedFromTierId: "tier-starter",
      isFixed: true,
      isSelected: true,
    },
  ],
  total: 1,
};

const tierPreview = {
  tenantId: "tenant-1",
  tenantName: "Tenant One",
  currentTier: {
    id: "tier-starter",
    name: "Starter",
    slug: "starter",
    maxAgents: 3,
  },
  targetTier: {
    id: "tier-growth",
    name: "Growth",
    slug: "growth",
    maxAgents: 10,
  },
  usage: {
    selectedAgents: 1,
    selectedDepartments: 1,
  },
  compatibility: {
    canChange: true,
    blockingReasons: [],
  },
  impact: {
    agentsToProvision: [
      {
        templateId: "agent-template-2",
        templateName: "Growth Agent",
        slotType: "FIXED",
      },
    ],
    departmentsToProvision: [
      {
        templateId: "department-template-2",
        templateName: "Growth Department",
        slotType: "FIXED",
      },
    ],
    reusableAgents: [
      {
        id: "agent-1",
        name: "Ops Agent",
        templateId: "agent-template-1",
      },
    ],
    reusableDepartments: [
      {
        id: "department-1",
        name: "Operations",
        templateId: "department-template-1",
      },
    ],
    tierLinkedAgentsOutsideTargetPolicy: [],
    tierLinkedDepartmentsOutsideTargetPolicy: [],
  },
};

const tierAgentPool = [
  {
    id: "slot-fixed-agent-1",
    tierId: "tier-starter",
    templateId: "agent-template-1",
    templateName: "Ops Agent",
    slot: 1,
    slotType: "FIXED",
    isRequired: true,
    isDefaultSelected: true,
  },
];

const tierDepartmentPool = [
  {
    id: "slot-fixed-department-1",
    tierId: "tier-starter",
    departmentTemplateId: "department-template-1",
    slot: 1,
    slotType: "FIXED",
    isRequired: true,
    isDefaultSelected: true,
    departmentTemplate: {
      id: "department-template-1",
      name: "Operations",
      slug: "operations",
      description: "Ops structure",
    },
  },
];

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": "*",
    },
    body: JSON.stringify(body),
  });
}

async function seedAdminSession(page: Page) {
  await page.addInitScript((user) => {
    const payload = JSON.stringify({
      state: {
        user,
        isAuthenticated: true,
      },
      version: 0,
    });

    window.localStorage.setItem("admin_accessToken", "playwright-access-token");
    window.localStorage.setItem(
      "admin_refreshToken",
      "playwright-refresh-token",
    );
    window.localStorage.setItem("user", JSON.stringify(user));
    window.localStorage.setItem("admin-auth-storage", payload);
  }, adminUser);
}

async function persistAdminSession(page: Page) {
  await page.evaluate((user) => {
    const payload = JSON.stringify({
      state: {
        user,
        isAuthenticated: true,
      },
      version: 0,
    });

    window.localStorage.setItem("admin_accessToken", "playwright-access-token");
    window.localStorage.setItem(
      "admin_refreshToken",
      "playwright-refresh-token",
    );
    window.localStorage.setItem("user", JSON.stringify(user));
    window.localStorage.setItem("admin-auth-storage", payload);
  }, adminUser);
}

async function gotoAdminPath(page: Page, path: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const onLoginPage =
      page.url().includes("/login") ||
      (await page
        .getByRole("heading", { name: "NeureCore Admin" })
        .isVisible()
        .catch(() => false));

    if (!onLoginPage) {
      return;
    }

    await persistAdminSession(page);
  }
}

async function stubAdminApi(page: Page) {
  const state = {
    tiers: structuredClone(tiers),
    tenants: structuredClone(tenants.items),
    agents: structuredClone(agents.items),
    departments: structuredClone(departments.items),
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const body = request.postDataJSON?.() as Record<string, unknown> | null;

    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
          "access-control-allow-headers": "*",
        },
      });
    }

    if (
      method === "GET" &&
      (path.endsWith("/tiers") || path.endsWith("/settings/tiers"))
    ) {
      return json(route, state.tiers);
    }

    if (method === "GET" && /\/tiers\/[^/]+$/.test(path)) {
      const tierId = path.split("/").pop();
      const tier = state.tiers.find((item) => item.id === tierId);
      return json(route, tier ?? state.tiers[0]);
    }

    if (method === "POST" && path.endsWith("/tiers")) {
      const createdTier = {
        id: `tier-created-${state.tiers.length + 1}`,
        name: String(body?.name ?? "New Tier"),
        slug: String(body?.slug ?? `tier-created-${state.tiers.length + 1}`),
        description: String(body?.description ?? ""),
        isActive: body?.isActive ?? true,
        isDefault: body?.isDefault ?? false,
        sortOrder: state.tiers.length + 1,
        monthlyPrice: Number(body?.monthlyPrice ?? 0),
        yearlyPrice: Number(body?.yearlyPrice ?? 0),
        currency: String(body?.currency ?? "USD"),
        maxUsers: Number(body?.maxUsers ?? 5),
        maxAgents: Number(body?.maxAgents ?? 5),
        maxStorageGB: Number(body?.maxStorageGB ?? 10),
        maxApiCalls: Number(body?.maxApiCalls ?? 10000),
        maxConversationMessages: Number(body?.maxConversationMessages ?? 5000),
        maxFileSizeMB: Number(body?.maxFileSizeMB ?? 50),
        allowCustomBranding: Boolean(body?.allowCustomBranding ?? false),
        allowApiAccess: Boolean(body?.allowApiAccess ?? false),
        allowSso: Boolean(body?.allowSso ?? false),
        allowAuditExport: Boolean(body?.allowAuditExport ?? false),
        createdAt: "2026-05-01T00:00:00.000Z",
        updatedAt: "2026-05-01T00:00:00.000Z",
      };
      state.tiers.push(createdTier);
      return json(route, createdTier);
    }

    if (method === "PATCH" && /\/tiers\/[^/]+$/.test(path)) {
      const tierId = path.split("/").pop();
      const current = state.tiers.find((item) => item.id === tierId);
      const updatedTier = {
        ...(current ?? state.tiers[0]),
        ...body,
        updatedAt: "2026-05-02T00:00:00.000Z",
      };
      if (current) {
        Object.assign(current, updatedTier);
      }
      return json(route, updatedTier);
    }

    if (method === "GET" && path.endsWith("/agent-templates/platform")) {
      return json(route, agentTemplates);
    }

    if (method === "GET" && path.endsWith("/department-templates")) {
      return json(route, departmentTemplates);
    }

    if (method === "GET" && path.endsWith("/tenants/tenant-1")) {
      return json(route, {
        data: state.tenants.find((tenant) => tenant.id === "tenant-1"),
      });
    }

    if (method === "GET" && path.endsWith("/tenants")) {
      return json(route, { items: state.tenants, total: state.tenants.length });
    }

    if (method === "GET" && path.endsWith("/departments")) {
      return json(route, {
        items: state.departments,
        total: state.departments.length,
      });
    }

    if (method === "GET" && path.endsWith("/agents")) {
      return json(route, { items: state.agents, total: state.agents.length });
    }

    if (method === "GET" && path.endsWith("/tiers/tier-starter/pool")) {
      return json(route, { slots: tierAgentPool });
    }

    if (method === "GET" && /\/tiers\/tier-created-\d+\/pool$/.test(path)) {
      return json(route, { slots: [] });
    }

    if (
      method === "GET" &&
      path.endsWith("/tiers/tier-starter/department-pool")
    ) {
      return json(route, tierDepartmentPool);
    }

    if (
      method === "GET" &&
      /\/tiers\/tier-created-\d+\/department-pool$/.test(path)
    ) {
      return json(route, []);
    }

    if (
      method === "POST" &&
      path.endsWith("/deploy/tenants/tenant-1/tier-bootstrap/preview")
    ) {
      return json(route, { data: tierPreview });
    }

    if (
      method === "POST" &&
      path.endsWith("/deploy/tenants/tenant-1/tier-bootstrap")
    ) {
      return json(route, {
        data: {
          tenantId: "tenant-1",
          tierId: "tier-starter",
          departmentsProvisioned: 1,
          departmentIds: ["department-1"],
          departmentsReused: 1,
          agentsProvisioned: 1,
          agentIds: ["agent-1"],
          agentsReused: 1,
        },
      });
    }

    if (method === "PATCH" && path.endsWith("/tenants/tenant-1/change-tier")) {
      const tenant = state.tenants.find((item) => item.id === "tenant-1");
      const nextTier = {
        id: "tier-growth",
        name: "Growth",
        slug: "growth",
        maxAgents: 10,
      };
      if (tenant) {
        tenant.tierId = nextTier.id;
        tenant.tier = nextTier;
      }
      return json(route, {
        data: {
          ...tenant,
        },
      });
    }

    if (method === "POST" && path.endsWith("/agents")) {
      const createdAgent = {
        id: `agent-created-${state.agents.length + 1}`,
        name: String(body?.name ?? "Created Agent"),
        type: String(body?.type ?? "FUNCTIONAL"),
        model: String(body?.model ?? "gpt-4o-mini"),
        status: String(body?.status ?? "ACTIVE"),
        createdAt: "2026-05-03T00:00:00.000Z",
        tenantId: String(body?.tenantId ?? "tenant-1"),
        departmentId: (body?.departmentId as string | undefined) ?? null,
        tierAgentPoolId: (body?.tierAgentPoolId as string | undefined) ?? null,
        deployedFromTierId: "tier-starter",
        isFixed: false,
        isSelected: body?.isSelected ?? true,
      };
      state.agents.unshift(createdAgent);
      return json(route, { data: createdAgent });
    }

    if (method === "POST" && path.endsWith("/departments")) {
      const createdDepartment = {
        id: `department-created-${state.departments.length + 1}`,
        name: String(body?.name ?? "Created Department"),
        description: String(body?.description ?? ""),
        status: String(body?.status ?? "ACTIVE"),
        createdAt: "2026-05-03T00:00:00.000Z",
        tenantId: String(body?.tenantId ?? "tenant-1"),
        parentId: (body?.parentId as string | undefined) ?? null,
        headAgentId: (body?.headAgentId as string | undefined) ?? null,
        tierDepartmentPoolId:
          (body?.tierDepartmentPoolId as string | undefined) ?? null,
        deployedFromTierId: "tier-starter",
        isFixed: false,
        isSelected: body?.isSelected ?? true,
      };
      state.departments.unshift(createdDepartment);
      return json(route, { data: createdDepartment });
    }

    return json(route, { data: [] });
  });
}

async function clickWizardContinue(page: Page) {
  await page
    .locator("button:visible")
    .filter({ hasText: /Continue|Create Draft and Continue/ })
    .last()
    .click();
}

function fieldContainer(page: Page, label: string) {
  return page.locator("label", { hasText: label }).first().locator("xpath=..");
}

async function fillField(page: Page, label: string, value: string) {
  await fieldContainer(page, label)
    .locator("input, textarea")
    .first()
    .fill(value);
}

async function selectField(page: Page, label: string, value: string) {
  await fieldContainer(page, label)
    .locator("select")
    .first()
    .selectOption(value);
}

test.beforeEach(async ({ page }) => {
  await seedAdminSession(page);
  await stubAdminApi(page);
});

test.describe("Phase 12 admin UI smoke", () => {
  test("opens the agent template wizard", async ({ page }) => {
    await gotoAdminPath(page, "/agent-templates");

    await expect(
      page.getByRole("heading", { name: "Agent Template Library" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ New Template" }).click({
      force: true,
    });
    await expect(
      page.getByRole("heading", { name: "Agent Template Wizard" }),
    ).toBeVisible();
  });

  test("opens the department template wizard", async ({ page }) => {
    await gotoAdminPath(page, "/dept-templates");

    await expect(
      page.getByRole("heading", { name: "Department Template Library" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ New Template" }).click({
      force: true,
    });
    await expect(
      page.getByRole("heading", { name: "Create Department Template" }),
    ).toBeVisible();
  });

  test("opens the tier wizard from tier settings", async ({ page }) => {
    await gotoAdminPath(page, "/settings/tiers");
    const addTierButton = page
      .locator("button:visible")
      .filter({ hasText: "+ Add Tier" })
      .first();

    await expect(
      page.getByRole("heading", { name: "Tenant Tiers" }),
    ).toBeVisible();
    await addTierButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await expect(
      page.getByRole("heading", { name: "Tier Wizard" }),
    ).toBeVisible();
  });

  test("opens the live agent wizard", async ({ page }) => {
    await gotoAdminPath(page, "/agents");

    await expect(
      page.getByRole("heading", { name: "Live Agents" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ Add Agent" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Live Agent" }),
    ).toBeVisible();
  });

  test("opens the live department wizard", async ({ page }) => {
    await gotoAdminPath(page, "/departments");

    await expect(
      page.getByRole("heading", { name: "Live Departments" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "+ Add Department" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Live Department" }),
    ).toBeVisible();
  });

  test("renders the tenant tier-change controls", async ({ page }) => {
    await gotoAdminPath(page, "/tenants/tenant-1");

    const previewButton = page
      .locator("button:visible")
      .filter({ hasText: "Preview Change" })
      .first();
    const tierSelect = page.locator("select:visible").first();

    await expect(page.getByText("Change Tier")).toBeVisible();
    await expect(tierSelect).toBeVisible();
    await expect(previewButton).toBeVisible();
  });

  test("completes the tier wizard and saves a tier", async ({ page }) => {
    await gotoAdminPath(page, "/settings/tiers");

    await page
      .locator("button:visible")
      .filter({ hasText: "+ Add Tier" })
      .first()
      .click({ force: true });

    await fillField(page, "Name", "Enterprise Plus");
    await fillField(page, "Slug", "enterprise-plus");

    await clickWizardContinue(page);
    await clickWizardContinue(page);
    await clickWizardContinue(page);
    await clickWizardContinue(page);
    await clickWizardContinue(page);
    await clickWizardContinue(page);

    await page.locator("select:visible").last().selectOption("tenant-1");
    await page.getByRole("button", { name: "Run Preview" }).click();

    await expect(
      page.getByText("Tenant One", { exact: true }).last(),
    ).toBeVisible();
    await expect(page.getByText("Starter -> Growth")).toBeVisible();

    await clickWizardContinue(page);
    await page.getByRole("button", { name: "Save Tier" }).click();

    await expect(
      page.getByRole("heading", { name: "Tier Wizard" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Enterprise Plus" }),
    ).toBeVisible();
  });

  test("submits the live agent wizard", async ({ page }) => {
    await gotoAdminPath(page, "/agents");

    await page.getByRole("button", { name: "+ Add Agent" }).click();
    await selectField(page, "Tenant", "tenant-1");
    await clickWizardContinue(page);

    await fillField(page, "Name", "Escalation Agent");
    await fillField(page, "Description", "Handles escalations.");
    await clickWizardContinue(page);

    await fillField(page, "Model", "gpt-5.4");
    await clickWizardContinue(page);

    await selectField(page, "Department", "department-1");
    await selectField(page, "Tier Slot Lineage", "slot-fixed-agent-1");
    await clickWizardContinue(page);

    await expect(page.getByText("Escalation Agent")).toBeVisible();
    await page.getByRole("button", { name: "Create Agent" }).click();

    await expect(
      page.getByRole("heading", { name: "Create Live Agent" }),
    ).not.toBeVisible();
    await expect(page.getByText("Escalation Agent")).toBeVisible();
  });

  test("submits the live department wizard", async ({ page }) => {
    await gotoAdminPath(page, "/departments");

    await page.getByRole("button", { name: "+ Add Department" }).click();
    await selectField(page, "Tenant", "tenant-1");
    await clickWizardContinue(page);

    await fillField(page, "Name", "Revenue Operations");
    await fillField(page, "Description", "Coordinates revenue workflows.");
    await clickWizardContinue(page);

    await selectField(page, "Parent Department", "department-1");
    await selectField(page, "Tier Slot Lineage", "slot-fixed-department-1");
    await clickWizardContinue(page);

    await selectField(page, "Head Agent", "agent-1");
    await clickWizardContinue(page);

    await expect(page.getByText("Revenue Operations")).toBeVisible();
    await page.getByRole("button", { name: "Create Department" }).click();

    await expect(
      page.getByRole("heading", { name: "Create Live Department" }),
    ).not.toBeVisible();
    await expect(page.getByText("Revenue Operations")).toBeVisible();
  });

  test("previews and applies a tenant tier change", async ({ page }) => {
    await gotoAdminPath(page, "/tenants/tenant-1");

    await page.getByRole("combobox").first().selectOption("tier-growth");
    await page.getByRole("button", { name: "Preview Change" }).click();

    await expect(page.getByText("Tier change allowed")).toBeVisible();
    await expect(page.getByText("Growth Agent")).toBeVisible();
    await expect(page.getByText("Growth Department")).toBeVisible();

    await page.getByRole("button", { name: "Apply Tier" }).click();

    await expect(
      page.getByText("Growth", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Tier change allowed")).toBeVisible();
  });
});
