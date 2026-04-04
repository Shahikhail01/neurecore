/**
 * HR Systems API Tool - P0-4 of remaining tools
 * Enables AI agents to manage HR operations including candidates, offers, and onboarding
 *
 * SOLID Principles Applied:
 * - SRP: Single responsibility for HR operations
 * - OCP: Extensible via HR provider interfaces
 * - DIP: Depends on abstractions for HR systems (Workday, BambooHR, Greenhouse)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';

// ─────────────────────────────────────────────────────────────
// Input Schema
// ─────────────────────────────────────────────────────────────

export const HRSystemsActionEnum = z.enum([
  'list_candidates',
  'get_candidate',
  'update_candidate',
  'create_offer',
  'onboard_employee',
  'list_employees',
  'get_employee',
  'update_employee',
  'list_departments',
  'get_department',
]);

export type HRSystemsAction = z.infer<typeof HRSystemsActionEnum>;

export const HRSystemsInputSchema = z.object({
  action: HRSystemsActionEnum.describe('The HR action to perform'),
  // For list_candidates
  jobId: z.string().optional().describe('Filter by job posting ID'),
  status: z
    .enum(['new', 'screening', 'interview', 'offer', 'hired', 'rejected'])
    .optional()
    .describe('Filter by candidate status'),
  page: z.number().int().min(1).optional().default(1).describe('Page number'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe('Results per page'),
  // For get_candidate, update_candidate
  candidateId: z.string().optional().describe('Candidate ID'),
  // For create_offer
  candidateName: z.string().optional().describe('Candidate name for offer'),
  position: z.string().optional().describe('Position title'),
  salary: z.number().positive().optional().describe('Annual salary'),
  startDate: z.string().optional().describe('Offered start date (ISO)'),
  // For onboard_employee
  onboardEmployeeId: z
    .string()
    .optional()
    .describe('Employee ID for onboarding'),
  // For list_employees, get_employee, update_employee
  listDepartmentId: z.string().optional().describe('Filter by department ID'),
  employeeIdLookup: z.string().optional().describe('Employee ID'),
  // For get_department
  getDepartmentId: z.string().optional().describe('Department ID'),
});

export type HRSystemsInput = z.infer<typeof HRSystemsInputSchema>;

// ─────────────────────────────────────────────────────────────
// Output Schemas
// ─────────────────────────────────────────────────────────────

export const CandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  position: z.string(),
  status: z.enum([
    'new',
    'screening',
    'interview',
    'offer',
    'hired',
    'rejected',
  ]),
  appliedAt: z.string(),
  source: z.string().optional(),
  resumeUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const EmployeesSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  department: z.string(),
  position: z.string(),
  startDate: z.string(),
  status: z.enum(['active', 'inactive', 'on_leave']),
  managerId: z.string().optional(),
});

export const DepartmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  headId: z.string().optional(),
  employeeCount: z.number(),
});

export const HRSystemsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  candidates: z.array(CandidateSchema).optional(),
  candidatesTotal: z.number().optional(),
  employee: EmployeesSchema.optional(),
  employees: z.array(EmployeesSchema).optional(),
  employeesTotal: z.number().optional(),
  departments: z.array(DepartmentSchema).optional(),
  offer: z
    .object({
      id: z.string(),
      candidateId: z.string(),
      position: z.string(),
      salary: z.number(),
      startDate: z.string(),
      status: z.string(),
      createdAt: z.string(),
    })
    .optional(),
  employeeId: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// Provider Interface (DIP)
// ─────────────────────────────────────────────────────────────

interface IHRProvider {
  listCandidates(options: {
    jobId?: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<{ candidates: z.infer<typeof CandidateSchema>[]; total: number }>;

  getCandidate(candidateId: string): Promise<z.infer<typeof CandidateSchema>>;

  updateCandidate(
    candidateId: string,
    data: Partial<z.infer<typeof CandidateSchema>>,
  ): Promise<z.infer<typeof CandidateSchema>>;

  createOffer(data: {
    candidateId: string;
    position: string;
    salary: number;
    startDate: string;
  }): Promise<{ id: string; status: string }>;

  onboardEmployee(data: {
    offerId: string;
    personalInfo: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  }): Promise<{ employeeId: string }>;

  listEmployees(options: {
    departmentId?: string;
    page: number;
    limit: number;
  }): Promise<{ employees: z.infer<typeof EmployeesSchema>[]; total: number }>;

  getEmployee(employeeId: string): Promise<z.infer<typeof EmployeesSchema>>;

  updateEmployee(
    employeeId: string,
    data: Partial<z.infer<typeof EmployeesSchema>>,
  ): Promise<z.infer<typeof EmployeesSchema>>;

  listDepartments(): Promise<z.infer<typeof DepartmentSchema>[]>;

  getDepartment(
    departmentId: string,
  ): Promise<z.infer<typeof DepartmentSchema>>;
}

// ─────────────────────────────────────────────────────────────
// Mock HR Provider (Development Mode)
// ─────────────────────────────────────────────────────────────

@Injectable()
class MockHRProvider implements IHRProvider {
  private readonly logger = new Logger(MockHRProvider.name);
  private candidates = new Map<string, z.infer<typeof CandidateSchema>>();
  private employees = new Map<string, z.infer<typeof EmployeesSchema>>();
  private departments = new Map<string, z.infer<typeof DepartmentSchema>>();
  private offers = new Map<
    string,
    { id: string; candidateId: string; status: string }
  >();

  constructor() {
    this.initializeMockData();
  }

  private initializeMockData(): void {
    // Mock departments
    const depts = [
      { id: 'dept-1', name: 'Engineering', headId: 'emp-1', employeeCount: 25 },
      { id: 'dept-2', name: 'Sales', headId: 'emp-2', employeeCount: 15 },
      { id: 'dept-3', name: 'Marketing', headId: 'emp-3', employeeCount: 10 },
      {
        id: 'dept-4',
        name: 'Human Resources',
        headId: 'emp-4',
        employeeCount: 5,
      },
      { id: 'dept-5', name: 'Finance', headId: 'emp-5', employeeCount: 8 },
    ];
    depts.forEach((d) => this.departments.set(d.id, d));

    // Mock candidates
    const candidateData = [
      {
        id: 'cand-1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '+1-555-0101',
        position: 'Senior Developer',
        status: 'interview' as const,
        appliedAt: '2026-03-15',
        source: 'LinkedIn',
      },
      {
        id: 'cand-2',
        name: 'Bob Smith',
        email: 'bob@example.com',
        phone: '+1-555-0102',
        position: 'Product Manager',
        status: 'screening' as const,
        appliedAt: '2026-03-20',
        source: 'Referral',
      },
      {
        id: 'cand-3',
        name: 'Carol Williams',
        email: 'carol@example.com',
        phone: '+1-555-0103',
        position: 'DevOps Engineer',
        status: 'new' as const,
        appliedAt: '2026-04-01',
        source: 'Job Board',
      },
      {
        id: 'cand-4',
        name: 'David Brown',
        email: 'david@example.com',
        phone: '+1-555-0104',
        position: 'UX Designer',
        status: 'offer' as const,
        appliedAt: '2026-03-10',
        source: 'LinkedIn',
      },
      {
        id: 'cand-5',
        name: 'Eve Davis',
        email: 'eve@example.com',
        phone: '+1-555-0105',
        position: 'Data Analyst',
        status: 'hired' as const,
        appliedAt: '2026-02-28',
        source: 'Career Page',
      },
    ];
    candidateData.forEach((c) =>
      this.candidates.set(c.id, {
        ...c,
        appliedAt: c.appliedAt + 'T00:00:00Z',
      }),
    );

    // Mock employees
    const employeeData = [
      {
        id: 'emp-1',
        firstName: 'John',
        lastName: 'Manager',
        email: 'john@company.com',
        department: 'Engineering',
        position: 'Engineering Manager',
        startDate: '2025-01-15',
        status: 'active' as const,
      },
      {
        id: 'emp-2',
        firstName: 'Sarah',
        lastName: 'Lead',
        email: 'sarah@company.com',
        department: 'Sales',
        position: 'Sales Lead',
        startDate: '2025-03-20',
        status: 'active' as const,
      },
      {
        id: 'emp-3',
        firstName: 'Mike',
        lastName: 'Director',
        email: 'mike@company.com',
        department: 'Marketing',
        position: 'Marketing Director',
        startDate: '2024-11-01',
        status: 'active' as const,
      },
    ];
    employeeData.forEach((e) =>
      this.employees.set(e.id, { ...e, startDate: e.startDate + 'T00:00:00Z' }),
    );
  }

  async listCandidates(options: {
    jobId?: string;
    status?: string;
    page: number;
    limit: number;
  }): Promise<{
    candidates: z.infer<typeof CandidateSchema>[];
    total: number;
  }> {
    this.logger.log(`Listing candidates: ${JSON.stringify(options)}`);
    let result = Array.from(this.candidates.values());

    if (options.status) {
      result = result.filter((c) => c.status === options.status);
    }

    const total = result.length;
    const start = (options.page - 1) * options.limit;
    const paginated = result.slice(start, start + options.limit);

    return { candidates: paginated, total };
  }

  async getCandidate(
    candidateId: string,
  ): Promise<z.infer<typeof CandidateSchema>> {
    this.logger.log(`Getting candidate: ${candidateId}`);
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }
    return candidate;
  }

  async updateCandidate(
    candidateId: string,
    data: Partial<z.infer<typeof CandidateSchema>>,
  ): Promise<z.infer<typeof CandidateSchema>> {
    this.logger.log(`Updating candidate: ${candidateId}`);
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }
    const updated = { ...candidate, ...data };
    this.candidates.set(candidateId, updated);
    return updated;
  }

  async createOffer(data: {
    candidateId: string;
    position: string;
    salary: number;
    startDate: string;
  }): Promise<{ id: string; status: string }> {
    this.logger.log(`Creating offer for candidate: ${data.candidateId}`);
    const offerId = `offer-${Date.now()}`;
    this.offers.set(offerId, {
      id: offerId,
      candidateId: data.candidateId,
      status: 'pending',
    });
    return { id: offerId, status: 'pending' };
  }

  async onboardEmployee(data: {
    offerId: string;
    personalInfo: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
  }): Promise<{ employeeId: string }> {
    this.logger.log(`Onboarding employee: ${data.offerId}`);
    const employeeId = `emp-${Date.now()}`;
    const employee: z.infer<typeof EmployeesSchema> = {
      id: employeeId,
      firstName: data.personalInfo.firstName,
      lastName: data.personalInfo.lastName,
      email: data.personalInfo.email,
      phone: data.personalInfo.phone,
      department: 'Engineering',
      position: 'New Hire',
      startDate: new Date().toISOString(),
      status: 'active',
    };
    this.employees.set(employeeId, employee);
    return { employeeId };
  }

  async listEmployees(options: {
    departmentId?: string;
    page: number;
    limit: number;
  }): Promise<{ employees: z.infer<typeof EmployeesSchema>[]; total: number }> {
    this.logger.log(`Listing employees: ${JSON.stringify(options)}`);
    let result = Array.from(this.employees.values());

    if (options.departmentId) {
      result = result.filter(
        (e) =>
          e.department === this.departments.get(options.departmentId!)?.name,
      );
    }

    const total = result.length;
    const start = (options.page - 1) * options.limit;
    const paginated = result.slice(start, start + options.limit);

    return { employees: paginated, total };
  }

  async getEmployee(
    employeeId: string,
  ): Promise<z.infer<typeof EmployeesSchema>> {
    this.logger.log(`Getting employee: ${employeeId}`);
    const employee = this.employees.get(employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }
    return employee;
  }

  async updateEmployee(
    employeeId: string,
    data: Partial<z.infer<typeof EmployeesSchema>>,
  ): Promise<z.infer<typeof EmployeesSchema>> {
    this.logger.log(`Updating employee: ${employeeId}`);
    const employee = this.employees.get(employeeId);
    if (!employee) {
      throw new Error(`Employee not found: ${employeeId}`);
    }
    const updated = { ...employee, ...data };
    this.employees.set(employeeId, updated);
    return updated;
  }

  async listDepartments(): Promise<z.infer<typeof DepartmentSchema>[]> {
    this.logger.log('Listing departments');
    return Array.from(this.departments.values());
  }

  async getDepartment(
    departmentId: string,
  ): Promise<z.infer<typeof DepartmentSchema>> {
    this.logger.log(`Getting department: ${departmentId}`);
    const department = this.departments.get(departmentId);
    if (!department) {
      throw new Error(`Department not found: ${departmentId}`);
    }
    return department;
  }
}

// ─────────────────────────────────────────────────────────────
// Tool Implementation
// ─────────────────────────────────────────────────────────────

@Injectable()
export class HRSystemsTool extends BaseStructuredTool {
  readonly name = 'hr_systems';
  readonly description =
    'Manage HR operations including candidates, job offers, employee onboarding, and department management';
  readonly category = ToolCategory.API;
  readonly inputSchema = HRSystemsInputSchema;

  private readonly log = new Logger(HRSystemsTool.name);
  private readonly provider: IHRProvider;

  constructor(private readonly config: ConfigService) {
    super();
    // Initialize provider - in production, this would be configured based on provider type
    this.provider = new MockHRProvider();
  }

  protected async executeImpl(
    input: HRSystemsInput,
    context: ToolExecutionContext,
  ): Promise<StructuredToolResult<unknown>> {
    this.logger.log(`Executing HR action: ${input.action}`);

    try {
      switch (input.action) {
        case 'list_candidates':
          return await this.handleListCandidates(input);
        case 'get_candidate':
          return await this.handleGetCandidate(input);
        case 'update_candidate':
          return await this.handleUpdateCandidate(input);
        case 'create_offer':
          return await this.handleCreateOffer(input);
        case 'onboard_employee':
          return await this.handleOnboardEmployee(input);
        case 'list_employees':
          return await this.handleListEmployees(input);
        case 'get_employee':
          return await this.handleGetEmployee(input);
        case 'update_employee':
          return await this.handleUpdateEmployee(input);
        case 'list_departments':
          return await this.handleListDepartments();
        case 'get_department':
          return await this.handleGetDepartment(input);
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }
    } catch (error) {
      const err = error as Error;
      this.log.error(`HR action failed: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  private async handleListCandidates(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    const { candidates, total } = await this.provider.listCandidates({
      jobId: input.jobId,
      status: input.status,
      page: input.page ?? 1,
      limit: input.limit ?? 20,
    });

    return {
      success: true,
      data: {
        candidates,
        total,
        page: input.page ?? 1,
        limit: input.limit ?? 20,
      },
    };
  }

  private async handleGetCandidate(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.candidateId) {
      throw new Error('candidateId is required for get_candidate action');
    }

    const candidate = await this.provider.getCandidate(input.candidateId);

    return {
      success: true,
      data: { candidate },
    };
  }

  private async handleUpdateCandidate(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.candidateId) {
      throw new Error('candidateId is required for update_candidate action');
    }

    const updateData: Partial<z.infer<typeof CandidateSchema>> = {};
    if (input.status) updateData.status = input.status;
    if (input.candidateId) updateData.id = input.candidateId;

    const updated = await this.provider.updateCandidate(
      input.candidateId,
      updateData,
    );

    return {
      success: true,
      data: { candidate: updated },
    };
  }

  private async handleCreateOffer(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.candidateId || !input.position) {
      throw new Error(
        'candidateId and position are required for create_offer action',
      );
    }

    const offer = await this.provider.createOffer({
      candidateId: input.candidateId,
      position: input.position,
      salary: input.salary ?? 0,
      startDate: input.startDate ?? new Date().toISOString(),
    });

    return {
      success: true,
      data: { offer },
    };
  }

  private async handleOnboardEmployee(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.candidateId) {
      throw new Error(
        'candidateId (offer ID) is required for onboard_employee action',
      );
    }

    const { employeeId } = await this.provider.onboardEmployee({
      offerId: input.candidateId,
      personalInfo: {
        firstName: input.candidateName?.split(' ')[0] ?? 'New',
        lastName:
          input.candidateName?.split(' ').slice(1).join(' ') ?? 'Employee',
        email: `employee${Date.now()}@company.com`,
      },
    });

    return {
      success: true,
      data: { employeeId, message: 'Employee successfully onboarded' },
    };
  }

  private async handleListEmployees(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    const { employees, total } = await this.provider.listEmployees({
      departmentId: input.listDepartmentId,
      page: input.page ?? 1,
      limit: input.limit ?? 20,
    });

    return {
      success: true,
      data: {
        employees,
        total,
        page: input.page ?? 1,
        limit: input.limit ?? 20,
      },
    };
  }

  private async handleGetEmployee(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.employeeIdLookup) {
      throw new Error('employeeIdLookup is required for get_employee action');
    }

    const employee = await this.provider.getEmployee(input.employeeIdLookup);

    return {
      success: true,
      data: { employee },
    };
  }

  private async handleUpdateEmployee(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.employeeIdLookup) {
      throw new Error(
        'employeeIdLookup is required for update_employee action',
      );
    }

    const updateData: Partial<z.infer<typeof EmployeesSchema>> = {};
    if (input.listDepartmentId) updateData.department = input.listDepartmentId;

    const updated = await this.provider.updateEmployee(
      input.employeeIdLookup,
      updateData,
    );

    return {
      success: true,
      data: { employee: updated },
    };
  }

  private async handleListDepartments(): Promise<
    StructuredToolResult<unknown>
  > {
    const departments = await this.provider.listDepartments();

    return {
      success: true,
      data: { departments, total: departments.length },
    };
  }

  private async handleGetDepartment(
    input: HRSystemsInput,
  ): Promise<StructuredToolResult<unknown>> {
    if (!input.getDepartmentId) {
      throw new Error('getDepartmentId is required for get_department action');
    }

    const department = await this.provider.getDepartment(input.getDepartmentId);

    return {
      success: true,
      data: { department },
    };
  }
}
