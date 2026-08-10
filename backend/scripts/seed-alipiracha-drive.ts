#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * seed-alipiracha-drive.ts
 *
 * Seed Google Drive files for tenant alipiracha@live.com.
 * Creates the folder hierarchy and 50+ realistic documents across all feature domains.
 *
 * Usage (on Contabo):
 *   cd /opt/neurecore/backend
 *   DATABASE_URL=... ENCRYPTION_KEY=... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
 *     node scripts/seed-alipiracha-drive.js
 *
 * Prerequisites:
 *   1. Tenant alipiracha@live.com must be provisioned
 *   2. Google Workspace must be connected (IntegrationCredential for GOOGLE exists)
 *   3. OAuth tokens must be valid (not revoked)
 *
 * What it creates:
 *   - NeureCore/ root folder
 *   - NeureCore/Sales Research Agent Alpha/{Drafts, Documents, Reports, Templates, Archive}
 *   - NeureCore/Service Agent Beta/{Drafts, Documents, Reports, Templates, Archive}
 *   - NeureCore/Universal Agent Gamma/{Drafts, Documents, Reports, Templates, Archive}
 *   - 50+ documents across all folders (tax filings, financial reports, client docs, etc.)
 *
 * Idempotent: folder creation checks for existing folders before creating.
 *             File uploads use unique names to avoid duplicates.
 *
 * Token refresh: if access_token is expired, attempts refresh using stored refresh_token.
 *                If refresh fails, logs a clear error and exits with non-zero code.
 */

import { PrismaClient, IntegrationProvider, IntegrationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

require('dotenv').config({ path: './.env' });

// ─── Types ───────────────────────────────────────────────────────────────────

interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  scopes: string[];
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

// ─── Crypto (minimal, no NestJS needed) ─────────────────────────────────────

class SimpleCryptoService {
  private readonly key: Buffer;

  constructor() {
    const hexKey = process.env['ENCRYPTION_KEY'] || process.env['GOOGLE_TOKEN_ENCRYPTION_KEY'];
    const appSecret = process.env['APP_SECRET'];

    if (!hexKey && !appSecret) {
      throw new Error('Neither ENCRYPTION_KEY nor APP_SECRET is set. Cannot decrypt Google credentials.');
    }

    if (hexKey) {
      this.key = Buffer.from(hexKey, 'hex');
    } else {
      const { scryptSync } = require('crypto');
      this.key = scryptSync(appSecret!, 'neurecore-oauth-salt-v1', 32);
    }
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) throw new Error('Invalid ciphertext format');
    const [ivHex, tagHex, dataHex] = parts;
    const { createDecipheriv } = require('crypto');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', this.key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  }

  encrypt(plaintext: string): string {
    const { randomBytes, createCipheriv } = require('crypto');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv, { authTagLength: 16 });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }
}

// ─── Google Auth (token management) ─────────────────────────────────────────

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<{ access_token: string; expires_in: number; scope?: string }> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<{ access_token: string; expires_in: number; scope?: string }>;
}

async function getValidAccessToken(
  creds: GoogleTokens,
  clientId: string,
  clientSecret: string,
  tenantId: string,
  prisma: PrismaClient,
): Promise<string> {
  const isExpired = creds.expiryDate !== undefined && creds.expiryDate < Date.now() + 60_000;

  if (!isExpired) return creds.accessToken;

  if (!creds.refreshToken) {
    throw new Error(
      `Google access token for tenant ${tenantId} is expired and no refresh token is available. ` +
      `Please reconnect Google Workspace in the NeureCore UI.`,
    );
  }

  console.log(`[seed-alipiracha] Refreshing expired Google access token for tenant ${tenantId}...`);
  const tokens = await refreshAccessToken(clientId, clientSecret, creds.refreshToken);

  const newCreds: GoogleTokens = {
    accessToken: tokens.access_token,
    refreshToken: creds.refreshToken,
    expiryDate: Date.now() + tokens.expires_in * 1000,
    scopes: tokens.scope ? tokens.scope.split(' ') : creds.scopes,
  };

  // Save updated credentials back to DB
  const crypto = new SimpleCryptoService();
  const encrypted = crypto.encrypt(JSON.stringify(newCreds));
  await prisma.integrationCredential.update({
    where: { tenantId_provider: { tenantId, provider: IntegrationProvider.GOOGLE } },
    data: { encryptedCredentials: encrypted, updatedAt: new Date() },
  });

  console.log(`[seed-alipiracha] Access token refreshed successfully.`);
  return newCreds.accessToken;
}

// ─── Drive API helpers ───────────────────────────────────────────────────────

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function driveFetch(
  url: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    ...(options.headers ?? {}),
  };
  return fetch(url, { ...options, headers });
}

async function findFolderByName(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<DriveFile | null> {
  let q = `mimeType='${FOLDER_MIME}' and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const params = new URLSearchParams({ q, fields: 'files(id,name,mimeType,parents)' });
  const res = await driveFetch(`${DRIVE_API}/files?${params}`, accessToken);
  if (!res.ok) return null;
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files?.[0] ?? null;
}

async function createFolder(
  accessToken: string,
  name: string,
  parentId?: string,
): Promise<DriveFile> {
  const existing = await findFolderByName(accessToken, name, parentId);
  if (existing) return existing;

  const body: Record<string, unknown> = { name, mimeType: FOLDER_MIME };
  if (parentId) body.parents = [parentId];

  const fields = 'id,name,mimeType,parents';
  const res = await driveFetch(
    `${DRIVE_API}/files?fields=${encodeURIComponent(fields)}`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Failed to create Drive folder "${name}": ${err}`);
  }

  return res.json() as Promise<DriveFile>;
}

async function createFile(
  accessToken: string,
  name: string,
  content: string,
  mimeType: string,
  parentId?: string,
): Promise<DriveFile> {
  const boundary = `neurecore_boundary_${Date.now()}`;
  const metadata: Record<string, unknown> = { name, mimeType: mimeType === 'text/plain' ? 'text/plain' : mimeType };
  if (parentId) metadata.parents = [parentId];

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const fields = 'id,name,mimeType,webViewLink,parents,createdTime';
  const res = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent(fields)}`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Failed to create Drive file "${name}": ${err}`);
  }

  return res.json() as Promise<DriveFile>;
}

async function createGoogleDoc(
  accessToken: string,
  name: string,
  mimeType: string,
  content: string,
  parentId?: string,
): Promise<DriveFile> {
  // Google Docs/Sheets/Slides use a different MIME type for creation
  const boundary = `neurecore_boundary_${Date.now()}`;
  const metadata: Record<string, unknown> = { name, mimeType };
  if (parentId) metadata.parents = [parentId];

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const fields = 'id,name,mimeType,webViewLink,parents,createdTime';
  const res = await driveFetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=${encodeURIComponent(fields)}`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody,
    },
  );

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new Error(`Failed to create Google Doc "${name}": ${err}`);
  }

  return res.json() as Promise<DriveFile>;
}

// ─── File content generators ──────────────────────────────────────────────────

function generateTextFile(content: string): string {
  return content;
}

function generateCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map(r => r.map(escape).join(','))].join('\n');
}

function generateHTML(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #1a3a5c; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; }
    h2 { color: #2c5f8a; margin-top: 24px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
    th { background: #1a3a5c; color: white; }
    tr:nth-child(even) { background: #f5f7fa; }
    .meta { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${body}
  <p class="meta">Generated by NeureCore AI — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
</body>
</html>`;
}

function generateMarkdown(title: string, content: string): string {
  return `# ${title}\n\n${content}\n\n---\n*Generated by NeureCore AI — ${new Date().toLocaleDateString('en-US') }*\n`;
}

// ─── Seed content: 50+ files across domains ───────────────────────────────────

interface SeedFile {
  name: string;
  mimeType: string;
  content: string;
  folder: string; // 'Documents' | 'Reports' | 'Templates' | 'Drafts' | 'Archive'
}

function buildSeedFiles(): SeedFile[] {
  const files: SeedFile[] = [];
  const now = new Date();
  const year = now.getFullYear();

  // ── Tax & Compliance ──
  files.push({
    name: `IRS Form 1065 — ${year} Partnership Tax Return — Pinnacle Holdings.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`IRS FORM 1065 — PARTNERSHIP TAX RETURN\n${year}\nPinnacle Holdings LLC\nEIN: 84-XXXXXXX\n\nTABLE OF CONTENTS\n1. Page 1 — Identifying Information\n2. Page 2 — Allocated Items\n3. Schedule K-1 — Partner Distributions\n4. Schedule K-2 — Foreign Tax Credit\n5. Schedule K-3 — Section 704(c) Allocations\n\nSECTION 1: IDENTIFYING INFORMATION\nForm 1065 Page 1\nPartnership Name: Pinnacle Holdings LLC\nEmployer Identification Number: 84-XXXXXXX\nPrincipal Business Activity: Real Estate Investment\nNumber of Partners: 3\nPartnership's Total Assets: $5,000,000\n\nANALYSIS OF NET INCOME (Line 1)\nOrdinary Business Income (Loss): $425,000\nSection 199A Pass-Through Deduction: $85,000\nTotal Qualified Business Income: $340,000\n\nSCHEDULE K-1 SUMMARY\nPartner 1 (Ali Piracha): Ordinary income $170,000, Section 199A deduction $34,000\nPartner 2 (Maria Chen): Ordinary income $127,500, Section 199A deduction $25,500\nPartner 3 (Robert Kim): Ordinary income $127,500, Section 199A deduction $25,500\n`),
  });

  files.push({
    name: `Q${Math.ceil((now.getMonth()+1)/3)} ${year} State Tax Filing Checklist.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`STATE TAX FILING CHECKLIST — Q${Math.ceil((now.getMonth()+1)/3)} ${year}\nPinnacle Holdings LLC\n\nJURISDICTION | FORM | DEADLINE | STATUS\n─────────────────────────────────────────────────\nCalifornia | Form 565 | Apr 15 ${year} | PENDING\nNew York | IT-204-LL | Apr 15 ${year} | PENDING\nTexas | No corporate income tax | N/A | N/A\nFlorida | Form F-1120 | Mar 1 ${year} | FILED\nNevada | No corporate income tax | N/A | N/A\n\nFILING STATUS SUMMARY\nTotal jurisdictions: 5\nFederal form: 1065 (due Apr 15)\nState returns filed: 1/5\nExtensions requested: 0\nEstimated payments made: $127,500\n`),
  });

  files.push({
    name: `Pinnacle Holdings — Estimated Tax Payments ${year}.xlsx.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateCSV(
      ['Quarter', 'Due Date', 'Amount Due', 'Amount Paid', 'Date Paid', 'Status'],
      [
        ['Q1', 'Jan 15, ' + year, '$106,250', '$106,250', 'Jan 14, ' + year, 'PAID'],
        ['Q2', 'Apr 15, ' + year, '$106,250', '$106,250', 'Apr 14, ' + year, 'PAID'],
        ['Q3', 'Jun 15, ' + year, '$106,250', '', '', 'DUE'],
        ['Q4', 'Sep 15, ' + year, '$106,250', '', '', 'DUE'],
      ]
    ),
  });

  files.push({
    name: `Tax Research Memo — Section 199A QBI Deduction ${year}.doc.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`MEMORANDUM\nTO: File — Pinnacle Holdings LLC\nFROM: Alipiracha Accounting & Advisory\nDATE: ${now.toLocaleDateString()}\nRE: Section 199A Qualified Business Income Deduction — ${year}\n\nISSUE\nWhether the Section 199A QBI deduction is properly calculated for Pinnacle Holdings LLC's ${year} Form 1065 filing, given the partnership's status as a specified service trade or business.\n\nSHORT ANSWER\nNo. Pinnacle Holdings LLC's rental real estate activities are not a specified service trade or business (SSTB). The full 20% QBI deduction is available.\n\nFACTS\nPinnacle Holdings LLC is a multi-member partnership engaged in real estate investment. The partnership owns 12 residential rental properties and 3 commercial properties. The partnership reported $425,000 of ordinary business income on its ${year} Form 1065.\n\nANALYSIS\nA. QBI Deduction Overview\nSection 199A allows a deduction of up to 20% of qualified business income (QBI) from a qualified trade or business. For partnerships, the deduction is taken at the partner level.\n\nB. Rental Real Estate Exception\nRental real estate activities generally qualify as a trade or business under Section 162 if the taxpayer is engaged in a regular, continuous, and considerable activity. The IRS has historically recognized rental real estate as a Section 162 trade or business when the taxpayer spends significant time on activities such as tenant relations, property management, and maintenance oversight.\n\nC. SSTB Limitation\nThe 20% deduction is limited (and potentially eliminated) for taxpayers with taxable income above certain thresholds ($170,050 for single filers, $340,500 for married filing jointly) who are engaged in a specified service trade or business. Rental real estate is NOT classified as an SSTB.\n\nCONCLUSION\nThe full 20% QBI deduction ($85,000) is available for ${year}. Each partner may claim their proportionate share on their individual returns.\n`),
  });

  files.push({
    name: `IRS Publication 541 — Partnerships ${year}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`IRS PUBLICATION 541 — PARTNERSHIPS\nFor use in preparing ${year} Returns\n\nTABLE OF CONTENTS\n1. Who Must File\n2. Filing Dates and Extensions\n3. Partnership Returns (Form 1065)\n4. Schedule K-1 (Form 1065)\n5. Partner's Distributive Share\n6. Self-Employment Tax\n7. Section 199A — QBI Deduction\n8. Audit Guidelines\n\nKEY FILING DEADLINES\nForm 1065 due: April 15 (or 15th of 4th month after year-end)\nSchedule K-1 due: Same as Form 1065\nExtension (Form 7004): 6 months\n\nNOTE: This document is for reference only. Consult current IRS guidance for ${year} provisions.\n`),
  });

  files.push({
    name: `Quarterly Sales Tax Report — Q${Math.ceil((now.getMonth()+1)/3)} ${year}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Reports',
    content: generateTextFile(`QUARTERLY SALES TAX REPORT — Q${Math.ceil((now.getMonth()+1)/3)} ${year}\nAlipiracha Accounting & Advisory\n\nREGISTERED JURISDICTIONS\nState | Collected | Exempt | Remitted | Due Date | Status\n────────────────────────────────────────────────────────\nCalifornia | $34,500 | $8,200 | $34,500 | Apr 30 | REMITTED\nNew York | $21,300 | $5,100 | $21,300 | Apr 20 | REMITTED\nFlorida | $12,800 | $2,900 | $12,800 | Apr 30 | REMITTED\nTexas | $8,400 | $1,800 | $8,400 | Apr 30 | REMITTED\n\nTOTAL COLLECTED: $77,000\nTOTAL EXEMPT SALES: $18,000\nTOTAL REMITTED: $77,000\nBALANCE DUE: $0\n`),
  });

  // ── Client Files ──
  files.push({
    name: `Pinnacle Holdings — Client Intake Form ${year}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`CLIENT INTAKE FORM\nPinnacle Holdings LLC\nPrepared: ${now.toLocaleDateString()}\n\nBUSINESS INFORMATION\nLegal Name: Pinnacle Holdings LLC\nEntity Type: Multi-Member Partnership\nState of Formation: Delaware\nPrincipal Place of Business: 450 Park Avenue, New York NY 10022\nFederal EIN: 84-XXXXXXX\nDate of Formation: January 15, 2018\nFiscal Year End: December 31\n\nPRIMARY CONTACTS\nManaging Partner: Ali Piracha | ali@pirachallp.com | +1-555-0100\nCFO: Sarah Mitchell | sarah.mitchell@pinnacleholdings.com | +1-555-0101\n\nSERVICES ENGAGED\n- Annual tax preparation (Form 1065)\n- Quarterly estimated tax compliance\n- State tax filing (5 jurisdictions)\n- Sales tax reporting\n- Financial statement preparation\n\nBILLING INFORMATION\nFee Arrangement: Fixed Fee — $25,000/year\nBilling Cycle: Quarterly\nPayment Terms: Net 30\n`),
  });

  files.push({
    name: `Meridian Capital Partners — Financial Statement Summary ${year}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`MERIDIAN CAPITAL PARTNERS — FINANCIAL SUMMARY\nFor the Year Ended December 31, ${year}\n(Prepared by Alipiracha Accounting & Advisory)\n\nEXECUTIVE SUMMARY\nTotal Revenue: $12,450,000 (+18% YoY)\nOperating Expenses: $8,200,000\nNet Operating Income: $4,250,000\nNet Income: $3,180,000\nTotal Assets: $45,600,000\nTotal Liabilities: $22,100,000\nNet Worth: $23,500,000\n\nREVENUE BREAKDOWN\nManagement Fees: $8,200,000\nPerformance Fees: $3,150,000\nAdvisory Services: $1,100,000\n\nASSET BREAKDOWN\nCash & Equivalents: $5,400,000\nInvestments (fair value): $32,100,000\nReal Estate: $6,200,000\nOther Assets: $1,900,000\n\nNOTE: This is a summary. Full audited financial statements available upon request.\n`),
  });

  files.push({
    name: `Client Meeting Notes — Pinnacle Holdings — Q3 Review 08-${year}.doc.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`CLIENT MEETING NOTES\nPinnacle Holdings LLC — Q3 ${year} Review\nDate: ${now.toLocaleDateString()}\nAttendees: Ali Piracha (Managing Partner), Sarah Mitchell (CFO), Ali (Advisory)\n\nAGENDA\n1. Q2 Tax Filing Status\n2. Q3 Estimated Tax Payment\n3. Rental Property Depreciation Schedule\n4. Q4 Planning\n\nDISCUSSION NOTES\n1. Q2 filing was submitted on time with no changes requested. $127,500 in estimated taxes paid YTD.\n\n2. Q3 estimated payment of $106,250 is due September 15. Client confirmed funds are available.\n\n3. Rental depreciation: $340,000 total depreciation across 15 properties. Client asked about cost segregation study — recommended proceeding if properties are older than 10 years.\n\n4. Q4 planning: Client expects $200,000 in additional rental income from new tenant lease commencing October 1. This will increase Q4 estimated tax obligation.\n\nACTION ITEMS\n[ ] Schedule cost segregation study for rental properties\n[ ] Prepare amended Q3 estimated tax if income increases\n[ ] Send depreciation schedule for review by Sept 15\n[ ] Schedule year-end planning call for December\n`),
  });

  // ── Financial Reports ──
  files.push({
    name: `Balance Sheet — Alipiracha Accounting & Advisory — ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Reports',
    content: generateTextFile(`BALANCE SHEET\nAlipiracha Accounting & Advisory\nAs of ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n(Unaudited)\n\nASSETS\nCurrent Assets\n  Cash & Cash Equivalents: $425,000\n  Accounts Receivable: $89,500\n  Prepaid Expenses: $12,300\n  Total Current Assets: $526,800\n\nFixed Assets\n  Office Equipment (net): $34,200\n  Leasehold Improvements (net): $18,500\n  Total Fixed Assets: $52,700\n\nTOTAL ASSETS: $579,500\n\nLIABILITIES\nCurrent Liabilities\n  Accounts Payable: $24,300\n  Accrued Expenses: $41,200\n  Current Tax Payable: $67,800\n  Total Current Liabilities: $133,300\n\nLong-Term Liabilities\n  Equipment Loan: $15,000\n  Total Long-Term Liabilities: $15,000\n\nTOTAL LIABILITIES: $148,300\n\nEQUITY\nPartner's Capital: $431,200\nTotal Equity: $431,200\n\nTOTAL LIABILITIES & EQUITY: $579,500\n`),
  });

  files.push({
    name: `Income Statement — Alipiracha Accounting & Advisory — YTD ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Reports',
    content: generateTextFile(`INCOME STATEMENT (YTD)\nAlipiracha Accounting & Advisory\nFor the Period January 1 — ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n(Unaudited)\n\nREVENUE\nTax Preparation Services: $312,000\nFinancial Advisory: $189,000\nBookkeeping Services: $98,500\nOther Consulting: $45,000\nTOTAL REVENUE: $644,500\n\nEXPENSES\nSalaries & Wages: $245,000\nProfessional Development: $12,400\nRent & Utilities: $36,000\nTechnology & Software: $18,200\nMarketing: $8,900\nInsurance: $14,500\nProfessional Fees: $9,200\nOffice Supplies: $3,800\nTravel & Entertainment: $11,300\nTOTAL EXPENSES: $359,300\n\nNET OPERATING INCOME: $285,200\n\nOTHER INCOME/(EXPENSE)\nInterest Income: $4,200\nGain on Investment: $12,500\nNET INCOME: $301,900\n`),
  });

  files.push({
    name: `Cash Flow Statement — YTD ${year}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Reports',
    content: generateTextFile(`CASH FLOW STATEMENT (Indirect Method)\nAlipiracha Accounting & Advisory\nFor the Period January 1 — ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\nOPERATING ACTIVITIES\nNet Income: $301,900\nAdjustments:\n  Depreciation & Amortization: $8,400\n  (Increase) Decrease in A/R: ($14,200)\n  (Increase) Decrease in Prepaid: ($2,100)\n  Increase (Decrease) in A/P: $8,900\n  Increase (Decrease) in Accrued: $12,400\nNET CASH FROM OPERATIONS: $315,300\n\nINVESTING ACTIVITIES\nPurchase of Equipment: ($15,000)\nInvestment in Marketable Securities: ($50,000)\nNET CASH FROM INVESTING: ($65,000)\n\nFINANCING ACTIVITIES\nPartner Distributions: ($180,000)\nEquipment Loan Repayment: ($12,000)\nNET CASH FROM FINANCING: ($192,000)\n\nNET CHANGE IN CASH: $58,300\nBeginning Cash Balance: $366,700\nENDING CASH BALANCE: $425,000\n`),
  });

  // ── Templates ──
  files.push({
    name: 'IRS Form 1065 Template — Partnership Tax Return.pdf.txt',
    mimeType: 'text/plain',
    folder: 'Templates',
    content: generateTextFile(`FORM 1065 — PARTNERSHIP TAX RETURN TEMPLATE\n\nINSTRUCTIONS:\n1. Complete all identifying information in Part I\n2. Complete Analysis of Income (Line 1) in Part II\n3. Attach Schedule K-1 for each partner\n4. Complete Schedule K-2 for foreign items\n5. Complete Schedule K-3 for 704(c) allocations\n6. Attach all required state filings\n\nPART I — IDENTIFYING INFORMATION\nCheck applicable boxes:\n[ ] Initial Form 1065   [ ] Final Form 1065   [ ] Amended Form 1065\n\nPartnership Name:\n:\nEmployer Identification Number (EIN):\nNumber of Schedules K-1 filed:\nPrincipal business activity:\nBusiness code:\n\nPART II — ANALYSIS OF INCOME\nLine 1 Ordinary business income (loss):\nLine 2 Net rental real estate income (loss):\nLine 3 Other net rental income (loss):\nLine 4 Guaranteed payments:\nLine 5 Interest income:\n... [full template available at IRS.gov] ...\n`),
  });

  files.push({
    name: 'Engagement Letter Template — Tax Preparation.pdf.txt',
    mimeType: 'text/plain',
    folder: 'Templates',
    content: generateTextFile(`ENGAGEMENT LETTER — TAX PREPARATION SERVICES\n[Accounting Firm Name]\n[Address] | [Phone] | [Email]\n\nDATE: [Engagement Date]\nCLIENT: [Client Legal Name]\nRE: Tax Preparation Engagement for Tax Year [Year]\n\nDear [Client Name],\n\nThis letter confirms your engagement of [Firm Name] to prepare your federal and state tax returns for the tax year referenced above. This engagement letter sets forth the nature and limitations of the services we will provide.\n\nSCOPE OF SERVICES\nWe will prepare the following tax returns:\n[ ] Federal Form 1065 (Partnership)\n[ ] Federal Form 1120-S (S-Corporation)\n[ ] Form 1041 (Estate/Trust)\n[ ] State tax returns for: _____________\n\nWe will not conduct an audit or other verification of your records. Our engagement cannot be relied upon to disclose errors, irregularities, or illegal acts that may exist.\n\nFEES\nOur fees for these services are based on the complexity of the engagement and are estimated at $[Amount]. This estimate does not include responding to IRS audits or other tax authority inquiries.\n\nPlease sign below to confirm your acceptance of this engagement.\n\nSincerely,\n\n[Accountant Name, CPA]\n[Firm Name]\n\nACCEPTED:\n\nClient Signature: ___________________________\nPrinted Name: _______________________________\nDate: _____________________________________\n`),
  });

  files.push({
    name: 'Client Onboarding Checklist.pdf.txt',
    mimeType: 'text/plain',
    folder: 'Templates',
    content: generateTextFile(`CLIENT ONBOARDING CHECKLIST\nNew Client Setup — Tax & Advisory Services\n\nINITIAL SETUP\n[ ] Engagement letter signed and filed\n[ ] Engagement acceptance documented\n[ ] Client added to practice management software\n[ ] Firm privacy policy provided\n\nDOCUMENT COLLECTION\n[ ] Prior year tax returns (3 years)\n[ ] Current year financial statements\n[ ] Bank statements (all accounts, all pages)\n[ ] Loan statements and amortization schedules\n[ ] Investment account statements\n[ ] Rental property schedules and tenant records\n[ ] Payroll records (if applicable)\n[ ] Receipt documentation\n[ ] Charitable contribution acknowledgments\n\nVERIFICATION\n[ ] Entity structure verified (IRS BOD)\n[ ] State registrations confirmed\n[ ] EIN verification letter obtained\n[ ] Officer/partner information current\n\nTAX RESEARCH\n[ ] Industry-specific issues identified\n[ ] Regulatory changes addressed\n[ ] State nexus issues evaluated\n\nSTATUS: [ ] COMPLETE | [ ] IN PROGRESS\nAssigned Staff: _____________\nDate Opened: _____________\nExpected Completion: _____________\n`),
  });

  files.push({
    name: 'Monthly Close Checklist.pdf.txt',
    mimeType: 'text/plain',
    folder: 'Templates',
    content: generateTextFile(`MONTHLY ACCOUNTING CLOSE CHECKLIST\n\nDUE DATE: 10th of following month\nCOMPLETED BY: [Staff Name]    DATE COMPLETED: ________\n\nBANK RECONCILIATIONS\n[ ] All bank accounts reconciled\n[ ] Journal entries for bank errors prepared\n[ ] Outstanding checks reviewed (older than 90 days)\n[ ] Deposits in transit verified\n\nACCOUNTS RECEIVABLE\n[ ] AR aging report generated\n[ ] Collections follow-up completed\n[ ] Write-offs approved\n[ ] Deferred revenue reconciled\n\nACCOUNTS PAYABLE\n[ ] AP aging report generated\n[ ] Bills approved for payment\n[ ] Credit card statements reviewed\n[ ] Petty cash reconciled\n\nPAYROLL\n[ ] Payroll entries posted\n[ ] Payroll tax deposits made\n[ ] Employee benefit accruals reviewed\n[ ] Time records approved\n\nFINANCIAL REPORTING\n[ ] P&L reviewed with budget variances explained\n[ ] Balance sheet accounts reviewed\n[ ] Prepaid expenses amortized\n[ ] Fixed assets depreciation posted\n[ ] Accruals recorded\n\nFINAL STEPS\n[ ] Financial statements prepared\n[ ] Management report drafted\n[ ] Reviewed by [Manager/Partner]\n[ ] Filed with client workpapers\n`),
  });

  // ── Archive / Past Work ──
  files.push({
    name: `Atlas Insurance Group — Final Tax Return ${year-1}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Archive',
    content: generateTextFile(`ATLAS INSURANCE GROUP — ${year-1} TAX RETURN — ARCHIVED\nStatus: CLIENT INACTIVE\n\nFORM: Form 1120 (C-Corporation)\nEIN: 45-XXXXXXX\nDate Filed: March 15, ${year}\nRefund: $0 — No tax due\n\nNOTE: This client has been marked inactive. Records retained per firm policy.\nLast active engagement: ${year-1} tax year.\nReason for closure: Client requested discontinuation of services.\n`),
  });

  files.push({
    name: `Pinnacle Holdings — ${year-1} K-1 Partner Statement.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Archive',
    content: generateTextFile(`SCHEDULE K-1 (Form 1065) — ${year-1}\nPartner: Ali Piracha\nPartnership: Pinnacle Holdings LLC\nEIN: 84-XXXXXXX\n\nPARTNER'S SHARE OF CURRENT YEAR ITEMS\nItem 1 — Ordinary business income (loss): $165,000\nItem 2 — Net rental real estate income (loss): $45,000\nItem 4 — Guaranteed payments: $0\nItem 5 — Interest income: $2,100\nItem 6a — Ordinary dividends: $0\nItem 7 — Royalties: $0\nItem 8 — Section 1231 gain (loss): $0\nItem 9 — Other income (loss): ($3,500)\nItem 10 — Section 179 deduction: $0\nItem 11 — Other deductions: ($12,000)\n\nSection 199A QBI Deduction: $33,000\n\nSTATEMENT OF PARTNER'S CAPITAL ACCOUNT\nBeginning Capital: $380,000\nCapital Contributions: $50,000\nWithdrawals: ($120,000)\nCurrent Year Income: $212,100\nENDING CAPITAL: $522,100\n\nThis K-1 is for use in preparing the partner's individual income tax return.\n`),
  });

  // ── More Documents (fill to 50+) ──
  files.push({
    name: `Depreciation Schedule — Rental Properties ${year}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateTextFile(`DEPRECIATION SCHEDULE — RENTAL PROPERTIES\nPinnacle Holdings LLC\nTax Year ${year}\n\nPROPERTY | COST BASIS | DATE ACQUIRED | METHOD | RATE | ANNUAL DEPR\n─────────────────────────────────────────────────────────────────────\n450 Park Ave #12 | $850,000 | Jan 2019 | 27.5 yr | 3.636% | $30,909\n123 Main St | $420,000 | Mar 2020 | 27.5 yr | 3.636% | $15,271\n789 Broadway #3A | $680,000 | Jun 2020 | 27.5 yr | 3.636% | $24,727\n...\n[TOTAL: 15 properties]\n\nTOTAL ANNUAL DEPRECIATION: $340,000\n\nNOTE: 0% bonus depreciation applied in year of acquisition.\nCost segregation study recommended for properties acquired before 2015.\n`),
  });

  files.push({
    name: `Fixed Asset Register — ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}.xlsx.txt`,
    mimeType: 'text/plain',
    folder: 'Documents',
    content: generateCSV(
      ['Asset ID', 'Description', 'Category', 'Cost', 'Date Acquired', 'Life (yrs)', ' Depreciation Method', 'Accum Depr', 'Net Book Value'],
      [
        ['FA-001', 'Office Furniture — Conference Room', 'Furniture', '$24,000', 'Jan 2019', '7', 'MACRS', '$17,143', '$6,857'],
        ['FA-002', 'Herman Miller Workstations (x8)', 'Furniture', '$48,000', 'Apr 2020', '7', 'MACRS', '$27,429', '$20,571'],
        ['FA-003', 'Server Equipment', 'Technology', '$32,000', 'Jul 2019', '5', 'MACRS', '$25,600', '$6,400'],
        ['FA-004', 'Company Vehicle — Ford Transit', 'Transportation', '$42,000', 'Feb 2021', '5', 'MACRS', '$26,880', '$15,120'],
        ['FA-005', 'Leasehold Improvements', 'Leasehold', '$55,000', 'Jan 2020', '15', 'Straight-Line', '$14,667', '$40,333'],
      ]
    ),
  });

  files.push({
    name: `Accounts Payable Aging Report — ${now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Reports',
    content: generateTextFile(`ACCOUNTS PAYABLE AGING REPORT\nAs of ${now.toLocaleDateString()}\n\nVENDOR | INVOICE # | DATE | DUE DATE | AMOUNT | DAYS OUT\n──────────────────────────────────────────────────────────────────\nWealth Management Co | INV-2026-0042 | Jul 15 | Aug 14 | $4,200 | 25\nLegal Services LLC | LS-8821 | Jul 28 | Aug 27 | $12,500 | 12\nOffice Depot | OD-33445 | Aug 01 | Aug 31 | $892 | 8\nTech Solutions Inc | TSI-991 | Aug 05 | Sep 04 | $3,400 | 4\nHVAC Services | HVAC-221 | Jul 20 | Aug 19 | $2,100 | 20\n\nTOTAL: $23,092\nCURRENT (0-30): $19,792\n31-60 DAYS: $3,300\n61-90 DAYS: $0\nOVER 90 DAYS: $0\n`),
  });

  files.push({
    name: `Accounts Receivable Aging Report — ${now.toLocaleDateString()}.pdf.txt`,
    mimeType: 'text/plain',
    folder: 'Reports',
    content: generateTextFile(`ACCOUNTS RECEIVABLE AGING REPORT\nAs of ${now.toLocaleDateString()}\n\nCLIENT | PROJECT | INVOICE | DATE | DUE | AMOUNT | DAYS OUT\n─────────────────────────────────────────────────────────────────\nPinnacle Holdings LLC | Tax Eng | INV-2026-0045 | Jul 15 | Aug 14 | $6,250 | 25\nMeridian Capital | Advisory | INV-2026-0047 | Aug 01 | Aug 31 | $18,500 | 8\nAtlas Insurance | Archive | INV-2025-0038 | Jun 01 | Jul 01 | $3,200 | OVER 90\nNew Client Co | Intake | INV-2026-0050 | Aug 08 | Sep 07 | $5,000 | 1\n\nTOTAL: $32,950\nCURRENT: $24,500\n31-60: $5,250\n61-90: $0\nover 90: $3,200\n\nCOLLECTIONS NOTES: Atlas Insurance $3,200 — sent to collections. Do not schedule calls.\n`),
  });

  // ── Draft documents ──
  files.push({
    name: `Draft — Q4 Estimated Tax Projection ${year}.doc.txt`,
    mimeType: 'text/plain',
    folder: 'Drafts',
    content: generateTextFile(`DRAFT — DO NOT FILE\nQ4 ${year} ESTIMATED TAX PROJECTION\nPinnacle Holdings LLC\nPrepared: ${now.toLocaleDateString()} | Status: DRAFT\n\nESTIMATED Q4 INCOME\nRental Income (Q4 only): $200,000 (new tenant lease commencing Oct 1)\nOperating Expenses: ($60,000)\nNet Q4 Income: $140,000\nAnnualized: $560,000\n\nQ4 ESTIMATED TAX COMPUTATION\nAnnual Net Income: $425,000 + $140,000 = $565,000\nSelf-Employment Tax: $565,000 x 92.35% x 15.3% = $79,865\nQBI Deduction: $565,000 x 20% = $113,000\nTaxable Income: $565,000 - $113,000 = $452,000\nFederal Tax: $452,000 x 37% = $167,240\nLess Prior Qtrs Paid: ($134,160)\nBALANCE DUE Q4: $33,080\n\nNOTE: This is a draft estimate only. Final computation required after year-end.\n`),
  });

  files.push({
    name: `Draft — ${year} Year-End Tax Planning Letter.doc.txt`,
    mimeType: 'text/plain',
    folder: 'Drafts',
    content: generateTextFile(`DRAFT — YEAR-END TAX PLANNING LETTER\n[Accounting Firm]\nTo: Valued Clients\nDate: ${now.toLocaleDateString()}\nRe: ${year} Year-End Tax Planning Opportunities\n\nDear Client,\n\nAs we approach year-end, we want to bring several tax planning opportunities to your attention. Please review the items below with your advisor to determine which strategies may be appropriate for your situation.\n\n1. MAXIMIZING RETIREMENT CONTRIBUTIONS\n   Consider maximizing contributions to SEP-IRA, Solo 401(k), or other retirement plans before December 31.\n\n2. DEPRECIATION AND COST SEGREGATION\n   If you own rental property acquired in prior years, a cost segregation study may allow you to accelerate depreciation deductions.\n\n3. CHARITABLE CONTRIBUTIONS\n   Charitable contributions of appreciated assets can avoid capital gains tax while providing a deduction.\n\n4. HEALTH INSURANCE DEDUCTION (Self-Employed)\n   Self-employed individuals can deduct 100% of health insurance premiums.\n\n5. HOME OFFICE DEDUCTION\n   If you use a portion of your home exclusively for business, you may be able to claim the home office deduction.\n\nSTATUS: DRAFT — DO NOT DISTRIBUTE\n`),
  });

  // Add more files to reach 50+
  const additionalFiles: SeedFile[] = [
    { name: `Accounts Payable Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'ACCOUNTS PAYABLE POLICY\n\n1. All invoices must be approved by department head before payment.\n2. Payments are processed every two weeks on Fridays.\n3. Standard payment terms are Net 30.\n4. Emergency payments require CFO approval.\n5. All payments are made via ACH unless wire transfer is requested.\n\nApproved by: Ali Piracha, Managing Partner\nEffective: January 1, ' + year },
    { name: `Anti-Money Laundering Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'ANTI-MONEY LAUNDERING (AML) POLICY\n\n1. Client identification required before engagement acceptance.\n2. Enhanced due diligence for high-risk clients.\n3. Suspicious activity reports filed within 30 days.\n4. Annual AML training required for all staff.\n5. Independent compliance review annually.\n\nThis policy complies with Bank Secrecy Act requirements.' },
    { name: `Business Continuity Plan ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'BUSINESS CONTINUITY PLAN\n\n1. Data backups performed daily to secure cloud storage.\n2. Alternate office space identified in Manhattan.\n3. Key personnel contact list maintained and updated quarterly.\n4. Client data recovery procedures documented.\n5. Annual tabletop exercise conducted each January.\n\nLast Updated: January 2, ' + year },
    { name: `Client Privacy Notice ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'CLIENT PRIVACY NOTICE\n\nWe are required by law to provide this notice describing our privacy practices and the confidentiality of your information.\n\nINFORMATION WE COLLECT: Tax returns, financial statements, identification documents, contact information.\nHOW WE USE IT: To prepare tax returns and provide advisory services.\nHOW WE PROTECT IT: Encrypted storage, access controls, secure transmission.\n\nYour information will not be shared with third parties without your explicit consent except as required by law.' },
    { name: `Q3 Sales Pipeline Report ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Reports', content: 'Q3 SALES PIPELINE REPORT\nAlipiracha Accounting & Advisory\nQ3 ' + year + '\n\nPROSPECTS BY STAGE\nLead: 12 | Qualified: 8 | Proposal: 4 | Negotiation: 2 | Closed Won: 3 | Closed Lost: 1\n\nPipeline Value: $485,000\nQ3 Revenue Added: $89,500\nQ4 Forecast: $120,000\n\nTOP PROSPECTS\n1. Metro Commercial Properties — $75,000 (Negotiation)\n2. Heritage Wealth Advisors — $45,000 (Proposal)\n3. Summit Ventures LLC — $38,000 (Qualified)' },
    { name: `Budget vs Actual — YTD ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Reports', content: 'BUDGET VS ACTUAL — YTD ' + year + '\n\nCategory | Budget | Actual | Variance\nRevenue | $650,000 | $644,500 | -$5,500\nSalaries | $250,000 | $245,000 | -$5,000\nRent | $36,000 | $36,000 | $0\nTech | $20,000 | $18,200 | -$1,800\nMarketing | $15,000 | $8,900 | -$6,100\nInsurance | $15,000 | $14,500 | -$500\nNet Income | $301,900 | $301,900 | $0' },
    { name: `Staff Utilization Report — August ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Reports', content: 'STAFF UTILIZATION REPORT — August ' + year + '\n\nStaff | Billable Hrs | Admin Hrs | Total | Utilization\nAli (Partner) | 85 | 35 | 120 | 71%\nOps Admin | 0 | 160 | 160 | 0%\nAcct Staff | 140 | 20 | 160 | 88%\nReviewer | 95 | 65 | 160 | 59%\n\nFIRM AVG UTILIZATION: 73%\nTARGET: 75%\nSTATUS: ON TRACK' },
    { name: `Employee Benefits Summary ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'EMPLOYEE BENEFITS SUMMARY\n\nHEALTH INSURANCE\n- Medical: Blue Cross Blue Shield PPO (firm pays 80%)\n- Dental: Delta Dental (firm pays 80%)\n- Vision: VSP (firm pays 80%)\n\nRETIREMENT\n- 401(k) with 4% firm match (after 1 year)\n- SEP-IRA available for partners\n\nPAID TIME OFF\n- 15 days PTO (years 1-3)\n- 20 days PTO (years 4-7)\n- 25 days PTO (years 8+)\n- 10 holidays\n- 5 sick days\n\nOTHER\n- CPA exam reimbursement (up to $2,000)\n- CPE courses paid (up to $3,000/year)\n- Remote work policy: 2 days/week' },
    { name: `Vendor Management List ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'APPROVED VENDOR LIST — ' + year + '\n\nAccounting Software: QuickBooks Online Advanced\nTax Software: Drake Tax\nPayroll: Gusto\nHR Platform: Rippling\nEmail: Google Workspace\nDocument Storage: Google Drive\nCRM: HubSpot\nCybersecurity: CrowdStrike\nOffice Supplies: Staples Business Advantage\nPrint Services: FedEx Office' },
    { name: `Fee Schedule ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Templates', content: 'FEE SCHEDULE — ' + year + '\n\nTAX SERVICES\nForm 1065 (Partnership): Starting at $3,500\nForm 1120-S (S-Corp): Starting at $2,800\nForm 1040 (Individual): Starting at $800\nState Tax Returns: $300 per state\nAmended Returns: 50% of original fee\n\nADVISORY\nHourly Rate (Partner): $450/hr\nHourly Rate (Manager): $275/hr\nHourly Rate (Staff): $175/hr\nFixed Fee Engagements: Quoted individually\n\nBOOKKEEPING\nMonthly bookkeeping: Starting at $500/month\nQuarterly clean-up: Starting at $1,200/quarter\nYear-end close: Starting at $2,500' },
    { name: `Audit Readiness Checklist.pdf.txt`, mimeType: 'text/plain', folder: 'Templates', content: 'AUDIT READINESS CHECKLIST\n\nGENERAL\n[ ] Organizational documents (LLC agreements, amendments)\n[ ] EIN verification letter\n[ ] State registrations and good standing certificates\n[ ] Board/partnership meeting minutes\n\nTAX\n[ ] Three years of filed tax returns\n[ ] All supporting schedules and workpapers\n[ ] Payroll tax returns (941s, 940s)\n[ ] Sales tax returns\n[ ] 1099s issued and filed\n\nFINANCIAL\n[ ] Trial balance (current year)\n[ ] Prior year financial statements\n[ ] Bank reconciliations (all accounts)\n[ ] Fixed asset register and depreciation schedules\n[ ] A/P and A/R aging reports\n\nENTITY-SPECIFIC\n[ ] Partner capital accounts and K-1s\n[ ] Shareholder/officer compensation\n[ ] Related-party transactions\n[ ] Contingent liabilities' },
    { name: `Email Signature Template.pdf.txt`, mimeType: 'text/plain', folder: 'Templates', content: 'EMAIL SIGNATURE TEMPLATE\n\n[Your Name], CPA\n[Your Title]\nAlipiracha Accounting & Advisory\n\nDirect: [Your Phone]\nEmail: [Your Email]\nWeb: www.alipiracha.com\n\nCONFIDENTIALITY NOTICE: This email and any attachments are confidential and may be protected by attorney-client privilege or work product doctrine. If you are not the intended recipient, please notify the sender immediately and delete this message.' },
    { name: `Competitor Analysis ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Reports', content: 'COMPETITOR ANALYSIS — Accounting Firms, NYC Metro\n' + year + '\n\nFIRM | SIZE | PRIMARY MARKET | NOTABLE\nAlipiracha A&A | 3-5 staff | SMB, Real Estate | Partner-led, fixed fee\nBig 4 | 1000+ | Enterprise | Full service, high cost\nRegional Firms | 50-200 | Mid-market | Good for complex audits\nSolo Practitioners | 1-2 | Individuals, small biz | Low cost, limited scope\n\nCOMPETITIVE POSITION\nStrengths: Partner attention, fixed fees, real estate specialization, responsive\nWeaknesses: Brand recognition, limited scale, no audit capability\nOpportunity: Growing SMB market in NYC, real estate investor segment\nThreat: Price competition from online services (TurboTax, etc.)' },
    { name: `Social Media Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'SOCIAL MEDIA POLICY\n\n1. Personal social media accounts must not mention clients by name.\n2. No client confidential information may be shared.\n3. Professional tone on all firm-related posts.\n4. Prior approval required for any posts mentioning the firm.\n5. No political content on firm accounts.\n\nViolations may result in disciplinary action.' },
    { name: `IT Security Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'IT SECURITY POLICY\n\nPASSWORDS\n- Minimum 16 characters with complexity\n- Password manager required (1Password)\n- MFA on all accounts\n- Biometric auth on devices\n\nDEVICE MANAGEMENT\n- Laptops encrypted (FileVault/BitLocker)\n- Remote wipe enabled\n- Auto-lock after 5 minutes inactivity\n- No personal software installation\n\nDATA HANDLING\n- Client data encrypted at rest and in transit\n- No client data on personal devices\n- Secure file sharing via Google Drive only\n- Physical documents shredded on-site\n\nINCIDENT RESPONSE\nReport suspected incidents to: security@alipiracha.com\nResponse SLA: 4 hours' },
    { name: `Marketing Strategy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'MARKETING STRATEGY — ' + year + '\n\nGOALS\n- Add 8 new clients (target $180,000 in new revenue)\n- Increase client retention to 95%\n- Establish thought leadership in real estate tax\n\nCHANNELS\n1. Referrals (target: 50% of new business)\n2. LinkedIn content marketing (2 posts/week)\n3. Email newsletter (monthly)\n4. CPE events (2/year)\n5. Strategic partnerships (2 new CPAs, 1 real estate attorney)\n\nBUDGET\nContent creation: $3,600/year\nEvents: $2,400/year\nSoftware: $1,200/year\nTOTAL: $7,200/year' },
    { name: `Strategic Plan ${year}-${year+2}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'STRATEGIC PLAN — ' + year + '-' + (year+2) + '\n\nVISION: To be the preferred accounting advisor for real estate investors and SMBs in the NYC metro area.\n\n3-YEAR GOALS\nRevenue: $900K by year 3\nStaff: 8 (add 1 senior, 1 staff per year)\nClient retention: 95%\nNew clients/year: 10\nProfit margin: 30%\n\nSTRATEGIC PILLARS\n1. Deepen real estate specialization\n2. Build recurring revenue (monthly bookkeeping)\n3. Develop next-generation partners\n4. Technology leverage for efficiency\n5. Strategic partnerships' },
    { name: `Knowledge Management Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'KNOWLEDGE MANAGEMENT POLICY\n\nPURPOSE: Capture and share firm knowledge for continuity and efficiency.\n\nWHAT TO DOCUMENT\n- Client-specific tax issues and positions\n- Industry-specific guidance\n- Unusual transactions and treatment\n- Process improvements\n\nHOW TO DOCUMENT\n- Use firm Google Drive (Knowledge folder)\n- Tag with client name, year, issue type\n- Update when treatment changes\n\nRETENTION\n- Client workpapers: 7 years minimum\n- Tax positions: Per statute of limitations\n- Policies: Current version always available' },
    { name: `Project Management Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'PROJECT MANAGEMENT POLICY\n\nENGAGEMENT LIFECYCLE\n1. Proposal accepted → Engagement letter sent\n2. Client onboarding → Document request list sent\n3. Preparation → Work in progress tracking\n4. Review → Manager review of all workpapers\n5. Delivery → Final review with client\n6. Billing → Invoice sent within 30 days\n\nTIMELINE STANDARDS\nSimple return: 5 business days\nComplex return: 15 business days\nAmendment: 10 business days\nAdvisory: Per agreed scope\n\nBILLING\nStandard billing at engagement close.\nFlat fees invoiced 50% at engagement, 50% at delivery.\nMonthly hourly billings due within 30 days.' },
    { name: `Succession Planning Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'SUCCESSION PLANNING POLICY\n\nPURPOSE: Ensure continuity of services in the event of partner departure, disability, or death.\n\nKEY PROVISIONS\n1. Each partner designates a successor partner.\n2. Succession plan reviewed annually.\n3. Firm maintains key person insurance on all partners.\n4. Emergency contact list updated quarterly.\n5. Operations manual accessible to all partners.\n\nTRANSFER OF OWNERSHIP\nValuation: Based on trailing 3-year average of adjusted receipts.\nPayment: 5-year installment note at applicable federal rate.\nNon-compete: 3 years within 25-mile radius.\n' },
    { name: `Remote Work Policy ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'REMOTE WORK POLICY\n\nELIGIBILITY\n- All full-time employees eligible after 90 days\n- 2 days remote per week standard\n- Additional days require manager approval\n\nREQUIREMENTS\n- Dedicated workspace (private, secure)\n- Reliable internet (minimum 25 Mbps)\n- Available during core hours (10am-3pm)\n- Camera on for client meetings\n- Secure Wi-Fi (WPA3 or WPA2)\n\nEQUIPMENT\n- Firm provides: laptop, monitor, keyboard\n- Employee provides: desk, chair, internet\n- $50/month internet stipend' },
    { name: `Disaster Recovery Plan ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'DISASTER RECOVERY PLAN\n\nSCENARIOS COVERED\n1. Office inaccessible (fire, flood, etc.)\n2. Key personnel unavailable\n3. Technology failure\n4. Data breach\n5. Natural disaster\n\nIMMEDIATE ACTIONS (0-4 hours)\n- Notify all staff via text message tree\n- Activate remote work protocols\n- Verify backup integrity\n- Contact building management\n\nRECOVERY (4-24 hours)\n- Establish temporary office (WeWork agreement in place)\n- IT restores systems from backups\n- Client communications sent\n\nRESTORATION (24-72 hours)\n- Determine root cause\n- Restore normal operations\n- Incident report filed' },
    { name: `Industry Alert — Real Estate Tax Changes ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'INDUSTRY ALERT\nREAL ESTATE TAX LAW CHANGES — ' + year + '\n\nKEY CHANGES AFFECTING CLIENTS\n\n1. DEPRECIATION\nCost segregation studies continue to provide accelerated depreciation on commercial and residential rental properties. Bonus depreciation remains at 60% for ' + year + ' (phasing down 20% per year through 2026).\n\n2. 1031 EXCHANGES\nNew IRS guidance on like-kind exchanges narrows the scope to real property only. Personal property exchanges no longer qualify.\n\n3. QBI DEDUCTION\nThe 20% qualified business income deduction remains available for rental real estate activities. Phase-out for high-income taxpayers continues (threshold: $170,050 single, $340,500 MFJ).\n\n4. STATE AND LOCAL TAX (SALT)\n$10,000 cap on state and local tax deductions remains in effect. Clients in high-tax states should consider entity structure optimization.\n\nRECOMMENDED ACTIONS\n- Review depreciation schedules for optimization opportunities\n- Evaluate entity structure (LLC vs. S-Corp vs. C-Corp)\n- Consider bunching charitable contributions\n- Review rental vs. real estate professional status' },
    { name: `Industry Alert — SECURE Act 2.0 Provisions ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'INDUSTRY ALERT\nSECURE ACT 2.0 — KEY PROVISIONS EFFECTIVE ' + year + '\n\nRETIREMENT PLAN CHANGES\n\n1. REQUIRED MINIMUM DISTRIBUTIONS\nRMD age increased to 73 (for those born 1951-1959) and 75 (for those born after 1960).\n\n2. CATCH-UP CONTRIBUTIONS\nCatch-up contributions to 401(k) now indexed for inflation. Age 50+ catch-up remains $7,500 (indexed).\n\n3. STUDENT LOAN MATCH\nEmployers may now match student loan payments with retirement contributions (SECURE Act 2.0 provision).\n\n4. EMERGENCY SAVINGS\nNew provision allows penalty-free withdrawals from retirement accounts for emergencies (up to $1,000/year).\n\nACTION ITEMS FOR CLIENTS\n- Review retirement plan beneficiary designations\n- Evaluate RMD planning strategies\n- Consider Roth conversions before RMDs begin\n- Optimize catch-up contributions if eligible' },
    { name: `IRS Audit Statistics — Partnership Returns ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'IRS AUDIT STATISTICS — PARTNERSHIP RETURNS ' + year + '\n\nOVERALL AUDIT RATE\nPartnership returns: 0.41%\nS-Corp returns: 0.53%\nC-Corp returns: 1.5%\nIndividual returns: 0.68%\n\nHIGH-RISK AREAS (Audit Triggers)\n- Schedule M-2 (partner capital accounts)\n- Large deductions relative to income\n- Related-party transactions\n- Foreign financial interests\n- Business expenses on personal returns\n\nAUDIT PROCESS\n1. IRS sends notice (CP80 or Letter 2205)\n2. 30 days to respond\n3. Field examination typically scheduled within 90 days\n4. Average audit duration: 4-8 months\n\nFIRM AUDIT HISTORY\nAlipiracha A&A: 0 audits in last 10 years\nClient audit support provided at no additional fee\n' },
    { name: `Industry Alert — IRS Guidance on Crypto ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'INDUSTRY ALERT\nIRS CRYPTOCURRENCY GUIDANCE — ' + year + '\n\nBACKGROUND\nThe Infrastructure Investment and Jobs Act (2021) expanded broker reporting requirements to include cryptocurrency transactions. ' + year + ' is the second tax year with Form 1099-DA requirements.\n\nFILING REQUIREMENTS\n- Brokers must report cryptocurrency transactions on Form 1099-DA\n- Taxpayers must report all cryptocurrency sales on Form 8949\n- Cost basis tracking is the taxpayer\'s responsibility\n\nCOMPLIANCE RISKS\n- Crypto exchanges with <$10,000 in transactions may not issue 1099s\n- Foreign exchanges often do not report to IRS\n- NFT transactions may trigger capital gains treatment\n\nCLIENT COMMUNICATION\nAsk every client: "Did you buy, sell, or exchange cryptocurrency this year?"\nDocument the response in the workpapers.\n' },
    { name: `Q3 Client Newsletter — Tax Planning Tips ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'NEWSLETTER — Q3 ' + year + '\nAlipiracha Accounting & Advisory\n\nIN THIS ISSUE\n1. Year-End Tax Planning Opportunities\n2. New Retirement Contribution Limits for ' + year + '\n3. Estimated Tax Deadlines (Q3 reminder)\n4. Client Spotlight: Pinnacle Holdings LLC\n5. Upcoming CPE Event\n\nYEAR-END PLANNING\nWith Q4 approaching, now is the time to evaluate your tax situation. Consider:\n- Maximizing retirement contributions\n- Bunching charitable contributions\n- Reviewing your entity structure\nContact us to schedule a year-end planning session.\n\nRETIREMENT LIMITS ' + year + '\n401(k) employee contribution: $23,000 (+ $7,500 catch-up if 50+)\nSEP-IRA: up to 25% of compensation, max $69,000\nSolo 401(k): up to $76,500 (with catch-up)\n\nESTIMATED TAX DEADLINES\nQ3 payment due: September 15, ' + year + '\nQ4 payment due: January 15, ' + (year+1) + '\n' },
    { name: `Q4 Client Newsletter — Year-End Planning ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'NEWSLETTER — Q4 ' + year + '\nAlipiracha Accounting & Advisory\n\nYEAR-END PLANNING EDITION\n\nTOP 10 YEAR-END TAX MOVES\n1. Fund your retirement accounts\n2. Take required minimum distributions (if applicable)\n3. Harvest investment losses\n4. Review your income for QBI deduction limits\n5. Prepay state income taxes\n6. Consider bunching charitable contributions\n7. Review your business entity structure\n8. Check your beneficiary designations\n9. Maximize health savings account (HSA) contributions\n10. Schedule your year-end planning meeting\n\nIMPORTANT DEADLINES\nDec 31: Most retirement plan contributions\nDec 31: Qualified charitable distributions (IRA)\nJan 15: Q4 estimated tax payment\n\nWe offer complimentary year-end planning consultations for all clients.\n' },
    { name: `ISO 27001 Security Checklist.pdf.txt`, mimeType: 'text/plain', folder: 'Templates', content: 'INFORMATION SECURITY CHECKLIST — ISO 27001 ALIGNMENT\n\nPHYSICAL SECURITY\n[ ] Server room access restricted (biometric or key card)\n[ ] Visitor log maintained\n[ ] CCTV cameras in place\n[ ] Climate monitoring for server room\n\nACCESS CONTROL\n[ ] Role-based access control implemented\n[ ] Privileged access management in place\n[ ] Access rights reviewed quarterly\n[ ] Terminated employee access revoked within 24 hours\n\nDATA PROTECTION\n[ ] Encryption at rest (AES-256)\n[ ] Encryption in transit (TLS 1.3)\n[ ] Backup encryption\n[ ] Key management policy\n\nINCIDENT RESPONSE\n[ ] Incident response plan documented\n[ ] Staff trained on incident reporting\n[ ] Post-incident review process\n[ ] Regulatory notification procedures\n' },
    { name: `Risk Assessment Matrix ${year}.pdf.txt`, mimeType: 'text/plain', folder: 'Documents', content: 'RISK ASSESSMENT MATRIX\nAlipiracha Accounting & Advisory — ' + year + '\n\nRisk | Likelihood | Impact | Mitigation\n─────────────────────────────────────────────\nClient data breach | Medium | Critical | Encryption, MFA, training\nStaff departure | High | Medium | Documentation, succession\nTechnology failure | Low | High | Cloud backups, DR plan\nRegulatory change | High | Medium | CPE, industry alerts\nReputation damage | Low | Critical | Client communication\n\nCYBER RISK SCORE: 7/25 (Moderate)\nTOP PRIORITY: Continue security awareness training, annual penetration testing' },
  ];

  files.push(...additionalFiles);

  return files;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[seed-alipiracha] === Google Drive Seed ===');
  console.log(`Started at ${new Date().toISOString()}`);

  const clientId = process.env['GOOGLE_CLIENT_ID'];
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    console.error('[seed-alipiracha] FATAL: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set.');
    console.error('                 Copy .env.example to .env and fill in the values.');
    process.exit(1);
  }

  const p = new PrismaClient();

  // ── Step 1: Find alipiracha tenant ──
  console.log('[seed-alipiracha] Finding tenant...');
  const tenant = await p.tenant.findFirst({
    where: {
      OR: [
        { name: { contains: 'alipiracha', mode: 'insensitive' } },
        { slug: { contains: 'alipiracha', mode: 'insensitive' } },
        { users: { some: { email: 'alipiracha@live.com' } } },
      ],
    },
    include: {
      users: { where: { email: 'alipiracha@live.com' }, select: { id: true, email: true } },
      agents: { select: { id: true, name: true, googleDriveFolderId: true } },
    },
  });

  if (!tenant) {
    console.error('[seed-alipiracha] FATAL: Tenant "alipiracha" not found. Run seed-alipiracha-db.ts first.');
    process.exit(1);
  }
  console.log(`[seed-alipiracha] Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`[seed-alipiracha] Drive root (cached): ${tenant.googleDriveRootFolderId ?? 'NOT SET'}`);

  // ── Step 2: Get Google credentials ──
  const credsRow = await p.integrationCredential.findUnique({
    where: { tenantId_provider: { tenantId: tenant.id, provider: IntegrationProvider.GOOGLE } },
  });

  if (!credsRow) {
    console.error('[seed-alipiracha] FATAL: No Google IntegrationCredential found for tenant.');
    console.error('                 Go to Settings > Integrations > Google Workspace and reconnect.');
    process.exit(1);
  }

  if (credsRow.status !== IntegrationStatus.ACTIVE) {
    console.error(`[seed-alipiracha] FATAL: Google credential status is ${credsRow.status} (not ACTIVE).`);
    console.error('                 Reconnect Google Workspace in Settings.');
    process.exit(1);
  }

  let creds: GoogleTokens;
  try {
    const crypto = new SimpleCryptoService();
    creds = JSON.parse(crypto.decrypt(credsRow.encryptedCredentials)) as GoogleTokens;
  } catch (err) {
    console.error('[seed-alipiracha] FATAL: Failed to decrypt Google credentials:', (err as Error).message);
    process.exit(1);
  }

  console.log(`[seed-alipiracha] Scopes: ${creds.scopes.join(', ')}`);

  // ── Step 3: Get valid access token ──
  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(creds, clientId, clientSecret, tenant.id, p);
  } catch (err) {
    console.error('[seed-alipiracha] FATAL: Failed to get Google access token:', (err as Error).message);
    process.exit(1);
  }

  // ── Step 4: Ensure root folder ──
  console.log('[seed-alipiracha] Ensuring NeureCore root folder...');
  let rootFolderId = tenant.googleDriveRootFolderId ?? undefined;
  if (!rootFolderId) {
    const rootFolder = await createFolder(accessToken, 'NeureCore');
    rootFolderId = rootFolder.id;
    await p.tenant.update({
      where: { id: tenant.id },
      data: { googleDriveRootFolderId: rootFolderId },
    });
    console.log(`[seed-alipiracha] Created root folder: ${rootFolderId}`);
  } else {
    console.log(`[seed-alipiracha] Using cached root folder: ${rootFolderId}`);
  }

  // ── Step 5: Create agent folders ──
  const agentFolders: Record<string, { folderId: string; subfolders: Record<string, string> }> = {};
  const subfolderNames = ['Drafts', 'Documents', 'Reports', 'Templates', 'Archive'];

  for (const agent of tenant.agents) {
    console.log(`[seed-alipiracha] Setting up Drive folders for agent: ${agent.name}...`);

    if (agent.googleDriveFolderId) {
      // Agent folder already exists, just get subfolder IDs
      const subfolders: Record<string, string> = {};
      for (const subName of subfolderNames) {
        const existing = await findFolderByName(accessToken, subName, agent.googleDriveFolderId);
        subfolders[subName] = existing?.id ?? '';
      }
      agentFolders[agent.id] = { folderId: agent.googleDriveFolderId, subfolders };
      console.log(`  Using cached agent folder: ${agent.googleDriveFolderId}`);
    } else {
      // Create agent folder
      const agentFolder = await createFolder(accessToken, agent.name, rootFolderId);
      const subfolders: Record<string, string> = {};
      for (const subName of subfolderNames) {
        const sub = await createFolder(accessToken, subName, agentFolder.id);
        subfolders[subName] = sub.id;
        console.log(`    Created subfolder: ${subName} (${sub.id})`);
      }
      agentFolders[agent.id] = { folderId: agentFolder.id, subfolders };

      // Cache agent folder ID
      await p.agent.update({ where: { id: agent.id }, data: { googleDriveFolderId: agentFolder.id } });
    }
  }

  // ── Step 6: Generate and upload files ──
  const files = buildSeedFiles();
  console.log(`[seed-alipiracha] Uploading ${files.length} files...`);

  let uploaded = 0;
  let skipped = 0;

  // Distribute files across agents and subfolders
  const agentIds = Object.keys(agentFolders);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const agentIndex = i % agentIds.length;
    const agentId = agentIds[agentIndex];
    const agentFolder = agentFolders[agentId];
    const parentId = agentFolder.subfolders[file.folder];

    if (!parentId) {
      console.warn(`  Skipping ${file.name}: parent folder "${file.folder}" not found for agent ${agentId}`);
      skipped++;
      continue;
    }

    try {
      const mimeType = file.name.endsWith('.xlsx.txt') || file.name.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : file.mimeType;

      await createFile(accessToken, file.name, file.content, mimeType, parentId);
      uploaded++;
      if (uploaded % 10 === 0) {
        console.log(`  Progress: ${uploaded}/${files.length} uploaded`);
      }
    } catch (err) {
      console.error(`  Failed to upload ${file.name}: ${(err as Error).message}`);
      skipped++;
    }
  }

  // ── Done ──
  console.log('\n[seed-alipiracha] === Drive Seed Complete ===');
  console.log(`Uploaded: ${uploaded}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Total:    ${files.length}`);

  await p.$disconnect();
}

main().catch((err) => {
  console.error('[seed-alipiracha] FATAL:', err.message);
  process.exit(1);
});
