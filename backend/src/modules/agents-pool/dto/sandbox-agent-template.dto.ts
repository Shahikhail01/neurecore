import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SandboxAgentTemplateDto {
  @IsString()
  @Length(1, 4000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  modelOverride?: string;

  @IsOptional()
  @IsInt()
  @Min(64)
  @Max(4000)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  includeTools?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSources?: string[];
}

export interface SandboxAgentTemplateResult {
  templateId: string;
  templateName: string;
  model: string;
  authorityLevel: string;
  memoryPolicy: string;
  channels: string[];
  allowedTools: string[];
  blockedTools: string[];
  knowledgeSources: string[];
  response: string;
  toolPlan: string[];
  warnings: string[];
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
}

export interface PersistedSandboxRun {
  id: string;
  actor: string;
  createdAt: string;
  prompt: string;
  result: SandboxAgentTemplateResult;
}

export interface SandboxRunComparison {
  left: PersistedSandboxRun;
  right: PersistedSandboxRun;
  summary: {
    responseChanged: boolean;
    toolPlanChanged: boolean;
    tokenDelta: number;
    warningDelta: number;
  };
}
