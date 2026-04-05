import { EvaluationStatus } from '@prisma/client';

// ─── Domain objects ────────────────────────────────────────────────────────

export interface TestCase {
  input: string;
  expectedOutput?: string;
  criteria?: string; // e.g. "factual accuracy", "tone"
}

export interface TestResult {
  testCaseIndex: number;
  passed: boolean;
  actualOutput: string;
  latencyMs: number;
  error?: string;
}

export interface EvaluationRunRecord {
  id: string;
  agentId: string;
  tenantId: string;
  status: EvaluationStatus;
  testCases: TestCase[];
  results: TestResult[] | null;
  scoreOverall: number | null;
  runBy: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Repository interface (ISP / DIP) ─────────────────────────────────────

export interface IEvaluationRepository {
  create(input: CreateEvaluationInput): Promise<EvaluationRunRecord>;
  findById(id: string): Promise<EvaluationRunRecord | null>;
  findByAgent(
    agentId: string,
    tenantId: string,
  ): Promise<EvaluationRunRecord[]>;
  updateStatus(
    id: string,
    status: EvaluationStatus,
    results: TestResult[],
    scoreOverall: number,
  ): Promise<EvaluationRunRecord>;
}

export interface CreateEvaluationInput {
  agentId: string;
  tenantId: string;
  testCases: TestCase[];
  runBy: string;
  notes?: string;
}
