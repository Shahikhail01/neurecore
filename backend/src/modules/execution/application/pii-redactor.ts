import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface RedactionResult {
  value: string;
  redacted: boolean;
  fields: string[];
}

@Injectable()
export class PiiRedactor {
  redact(value: string, strict = true): RedactionResult {
    const fields: string[] = [];
    let result = value;
    const rules: Array<[string, RegExp, string]> = [
      ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]'],
      ['phone', /\+?\d[\d\s().-]{7,}\d/g, '[REDACTED_PHONE]'],
      [
        'secret',
        /(api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi,
        '$1=[REDACTED_SECRET]',
      ],
    ];
    for (const [field, pattern, replacement] of rules) {
      if (pattern.test(result)) fields.push(field);
      result = result.replace(pattern, replacement);
    }
    if (strict) {
      const bearerPattern = /Bearer\s+[A-Za-z0-9._-]+/gi;
      if (bearerPattern.test(result)) fields.push('bearer');
      result = result.replace(bearerPattern, 'Bearer [REDACTED_TOKEN]');
    }
    return { value: result, redacted: fields.length > 0, fields };
  }

  checksum(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}
