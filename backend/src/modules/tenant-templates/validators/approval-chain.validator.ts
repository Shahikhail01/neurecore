import { Injectable } from '@nestjs/common';
import { TemplateType } from '@prisma/client';
import { z } from 'zod';
import { TemplateValidator } from './template-validator.interface';

const approvalChainConfigSchema = z.object({
  steps: z
    .array(
      z.object({
        order: z.number().int().min(1).max(20),
        role: z.string().min(1).max(100),
        approverRoles: z.array(z.string().min(1).max(100)).min(1).max(10),
      }),
    )
    .min(1)
    .max(10),
});

@Injectable()
export class ApprovalChainValidator implements TemplateValidator {
  readonly templateType: TemplateType = 'APPROVAL_CHAIN';

  validate(config: unknown): { valid: boolean; errors: string[] } {
    const result = approvalChainConfigSchema.safeParse(config);
    if (result.success) return { valid: true, errors: [] };
    return {
      valid: false,
      errors: result.error.issues.map(
        (i) => `${i.path.join('.')}: ${i.message}`,
      ),
    };
  }
}