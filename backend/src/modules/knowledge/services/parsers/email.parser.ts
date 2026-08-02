/**
 * EML / MSG email parser — uses the optional `mailparser` package.
 *
 * Package: `mailparser` (MIT). When not installed the parser abstains
 * with a typed `ParserUnavailableError`. Attachments are NOT inlined —
 * they appear as warnings so the ingestion service can decide to spawn
 * follow-up ingestion tasks.
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  IFileParser,
  ParsedDocument,
  ParserFormatError,
  ParserUnavailableError,
  ParserWarning,
} from './parser.interface';

interface MailparserSimple {
  subject?: string;
  from?: { text?: string; value?: Array<{ address?: string; name?: string }> };
  to?: { text?: string; value?: Array<{ address?: string; name?: string }> };
  date?: Date;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename?: string;
    contentType?: string;
    size?: number;
  }>;
}
interface MailparserModule {
  simpleParser: (input: Buffer | string) => Promise<MailparserSimple>;
}

let mailparserModule: MailparserModule | null | undefined;
let loadAttempted = false;

function loadMailparser(): MailparserModule | null | undefined {
  if (loadAttempted) return mailparserModule;
  loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mailparserModule = require('mailparser') as MailparserModule;
  } catch {
    mailparserModule = null;
  }
  return mailparserModule;
}

@Injectable()
export class EmailParser implements IFileParser {
  public readonly mime = 'message/rfc822';
  public readonly name = 'email';
  private readonly logger = new Logger(EmailParser.name);

  isAvailable(): boolean {
    return loadMailparser() !== null;
  }

  async parse(buffer: Buffer, mime: string): Promise<ParsedDocument> {
    const lower = mime.toLowerCase();
    if (lower !== 'message/rfc822' && lower !== 'application/vnd.ms-outlook') {
      throw new ParserFormatError(this.name, `unexpected mime ${mime}`);
    }
    if (!buffer || buffer.length === 0) {
      throw new ParserFormatError(this.name, 'empty buffer');
    }
    const mod = loadMailparser();
    if (!mod) {
      throw new ParserUnavailableError(
        this.name,
        'package "mailparser" not installed; install with `pnpm add mailparser`',
      );
    }
    let parsed: MailparserSimple;
    try {
      parsed = await mod.simpleParser(buffer);
    } catch (err) {
      this.logger.warn(`mailparser failed: ${(err as Error).message}`);
      throw new ParserFormatError(this.name, (err as Error).message);
    }
    const body = parsed.text ?? (parsed.html ? stripHtml(parsed.html) : '');
    const headers = [
      `Subject: ${parsed.subject ?? ''}`,
      `From: ${parsed.from?.text ?? ''}`,
      `To: ${parsed.to?.text ?? ''}`,
      `Date: ${parsed.date?.toISOString?.() ?? ''}`,
    ].join('\n');
    const text = `${headers}\n\n${body}`;
    const warnings: ParserWarning[] = [];
    if (parsed.attachments && parsed.attachments.length > 0) {
      warnings.push({
        code: 'EMAIL_ATTACHMENTS_PRESENT',
        severity: 'info',
        message: `Email had ${parsed.attachments.length} attachment(s); not inlined.`,
      });
    }
    return {
      text,
      metadata: {
        charCount: text.length,
        tokenEstimate: Math.ceil(text.length / 4),
        extra: {
          attachments: parsed.attachments?.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
          })),
        },
      },
      warnings,
    };
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
