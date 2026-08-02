/**
 * Sim05 Scenario Provider — metadata for the 20 Sim-05 training scenarios.
 *
 * Plan ref: NC-SIM05-IMP-2 (Phase A: 6 compute scenarios; Phase B: 14 judgment scenarios).
 *
 * Each scenario records:
 *   - id: numeric ID from the original Sim-05 prompt (1-20)
 *   - title: short title
 *   - company: simulated company name
 *   - category: 'COMPUTE' (uses nc.accounting.* tools) | 'JUDGMENT' (uses LLM reasoning)
 *   - tools: which nc.accounting.* tools the agent invokes
 *   - datasetSpec: schema for the synthetic dataset the agent must produce
 *   - requiredOutputs: what the agent must produce by the end
 *
 * The 6 COMPUTE scenarios exercise the new accounting-sidecar; the 14
 * JUDGMENT scenarios are primarily LLM reasoning with finding-recording.
 */

export type Sim05Category = 'COMPUTE' | 'JUDGMENT';

export type Sim05Tool =
  | 'nc.accounting.compute_npv'
  | 'nc.accounting.compute_irr'
  | 'nc.accounting.compute_mirr'
  | 'nc.accounting.amortize_loan';

export interface DatasetField {
  name: string;
  type: 'number' | 'string' | 'date' | 'currency';
  description: string;
  required: boolean;
}

export interface Sim05Scenario {
  id: number;
  title: string;
  company: string;
  category: Sim05Category;
  tools: Sim05Tool[];
  promptSummary: string;
  datasetSpec?: DatasetField[];
  requiredOutputs: string[];
  /** Beancount-account codes needed for ledger posts in this scenario (if any) */
  ledgerPostCodes?: string[];
  /** Difficulty hint (INFORMATIVE; not used for scoring in Phase A) */
  difficulty: 'INTRODUCTORY' | 'INTERMEDIATE' | 'ADVANCED';
}

export const SIM05_SCENARIOS: Sim05Scenario[] = [
  // ─── Phase A: COMPUTE scenarios (6) ─────────────────────────────────
  {
    id: 9,
    title: 'Capital Investment Appraisal',
    company: 'Falcon Motors Limited',
    category: 'COMPUTE',
    tools: ['nc.accounting.compute_npv', 'nc.accounting.compute_irr', 'nc.accounting.compute_mirr'],
    promptSummary:
      '$2M machine purchase. Cash flows + salvage + maintenance. ' +
      'Agent computes NPV, IRR, MIRR, sensitivity. Recommends invest/reject.',
    datasetSpec: [
      { name: 'initial_investment', type: 'currency', description: 'Upfront cost of the machine', required: true },
      { name: 'cashflows', type: 'string', description: 'Comma-separated projected annual cashflows', required: true },
      { name: 'salvage_value', type: 'currency', description: 'End-of-life salvage value', required: false },
      { name: 'discount_rate', type: 'number', description: 'Hurdle rate (decimal, e.g. 0.10)', required: true },
      { name: 'finance_rate', type: 'number', description: 'Finance rate for MIRR (decimal)', required: false },
      { name: 'reinvest_rate', type: 'number', description: 'Reinvest rate for MIRR (decimal)', required: false },
    ],
    requiredOutputs: ['NPV', 'IRR', 'MIRR', 'sensitivity_grid', 'recommendation'],
    ledgerPostCodes: ['1500', '1000', '2000'], // equipment, cash, financing
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 11,
    title: 'Inventory Obsolescence',
    company: 'FutureTech Electronics Ltd.',
    category: 'COMPUTE',
    tools: [],
    promptSummary:
      'Inventory records + aging + market prices. ' +
      'Agent computes NRV per item, decides write-downs, prepares journal entries.',
    datasetSpec: [
      { name: 'items', type: 'string', description: 'JSON array of inventory items', required: true },
    ],
    requiredOutputs: ['NRV_per_item', 'write_down_total', 'journal_entries'],
    ledgerPostCodes: ['1500', '5800'], // inventory, obsolescence loss
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 12,
    title: 'Foreign Exchange Analysis',
    company: 'Global Imports Limited',
    category: 'COMPUTE',
    tools: [],
    promptSummary:
      'International transactions in USD/EUR/GBP. ' +
      'Agent measures FX exposure, computes gains/losses, recommends hedges.',
    datasetSpec: [
      { name: 'transactions', type: 'string', description: 'JSON array of FX transactions', required: true },
      { name: 'base_currency', type: 'string', description: 'Base currency code (USD/EUR/GBP)', required: true },
    ],
    requiredOutputs: ['exposure_summary', 'gain_loss', 'hedge_recommendations'],
    ledgerPostCodes: ['1200', '7100'], // receivables, FX gain/loss
    difficulty: 'ADVANCED',
  },
  {
    id: 17,
    title: 'Lease Accounting',
    company: 'City Mall Holdings Ltd.',
    category: 'COMPUTE',
    tools: ['nc.accounting.amortize_loan'],
    promptSummary:
      '50 lease agreements with terms + payments + discount rates. ' +
      'Agent computes lease liabilities via amortization, prepares IFRS-16 journal entries.',
    datasetSpec: [
      { name: 'leases', type: 'string', description: 'JSON array of lease agreements', required: true },
    ],
    requiredOutputs: ['lease_liabilities', 'rou_assets', 'journal_entries'],
    ledgerPostCodes: ['1700', '2400'], // ROU asset, lease liability
    difficulty: 'ADVANCED',
  },
  {
    id: 13,
    title: 'IPO Preparation',
    company: 'Zenith Energy Limited',
    category: 'COMPUTE',
    tools: ['nc.accounting.compute_npv'],
    promptSummary:
      '3 years audited statements + prospectus + analysts. ' +
      'Agent conducts IPO readiness review and computes share-price valuation (DCF).',
    datasetSpec: [
      { name: 'cashflows', type: 'string', description: 'JSON array of projected post-IPO cashflows', required: true },
      { name: 'discount_rate', type: 'number', description: 'Cost of capital', required: true },
      { name: 'shares_outstanding', type: 'number', description: 'Pre-IPO share count', required: true },
      { name: 'peer_multiples', type: 'string', description: 'JSON peer P/E ratios', required: false },
    ],
    requiredOutputs: ['DCF_value_per_share', 'P/E_valuation', 'recommendations'],
    difficulty: 'ADVANCED',
  },
  {
    id: 5,
    title: 'Payroll Review (compute)',
    company: 'BrightWave Electronics Limited',
    category: 'COMPUTE',
    tools: [],
    promptSummary:
      '1,000 employees payroll + overtime + attendance. ' +
      'Agent computes monthly payroll totals, identifies anomalies, prepares write-off journal entry.',
    datasetSpec: [
      { name: 'employees', type: 'string', description: 'JSON array of employee records', required: true },
      { name: 'anomalies', type: 'string', description: 'JSON array of detected anomalies', required: false },
    ],
    requiredOutputs: ['payroll_totals_by_month', 'anomaly_summary', 'write_off_entries'],
    ledgerPostCodes: ['6000', '2100', '1300'], // wages, payable, fraud-loss
    difficulty: 'INTERMEDIATE',
  },

  // ─── Phase B: JUDGMENT scenarios (14) — content only, no sidecar wiring ─
  // These don't need the new accounting-sidecar; they need LLM judgment +
  // finding-recording via nc.accounting.record_finding (HTTP route, not sidecar).
  {
    id: 1,
    title: 'Inventory Warehouse Audit',
    company: 'Ali Wood Manufacturing Limited',
    category: 'JUDGMENT',
    tools: [],
    promptSummary:
      '500 inventory items + 15 intentional discrepancies. ' +
      'Agent identifies discrepancies via LLM reasoning + record_finding.',
    datasetSpec: [
      { name: 'inventory', type: 'string', description: 'JSON inventory records', required: true },
    ],
    requiredOutputs: ['discrepancies', 'audit_findings'],
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 2,
    title: 'Annual Financial Statement Audit',
    company: 'Crescent Textiles Sdn. Bhd.',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: 'Trial balance + GL + bank statements + 10 misstatements. ' +
      'Agent identifies misstatements + materiality + audit opinion.',
    datasetSpec: [
      { name: 'documents', type: 'string', description: 'JSON of all audit documents', required: true },
    ],
    requiredOutputs: ['misstatements', 'materiality', 'audit_opinion'],
    difficulty: 'ADVANCED',
  },
  {
    id: 3,
    title: 'Budget Preparation',
    company: 'Skyline Aviation Services Ltd.',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: '5 years history + forecasts. ' +
      'Agent prepares 2027 budget by department + consolidation.',
    datasetSpec: [
      { name: 'history', type: 'string', description: 'JSON 5-year financial history', required: true },
    ],
    requiredOutputs: ['budget'],
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 4,
    title: 'Cash Fraud Investigation',
    company: 'Metro Retail Stores Limited',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: 'POS records + bank deposits + suspicious emails + 3 suspects. ' +
      'Agent investigates, interviews, determines perpetrator.',
    datasetSpec: [
      { name: 'evidence', type: 'string', description: 'JSON investigation evidence', required: true },
    ],
    requiredOutputs: ['investigation_report', 'perpetrator', 'fraud_findings'],
    difficulty: 'ADVANCED',
  },
  {
    id: 6,
    title: 'Tax Audit',
    company: 'Green Farms Pakistan Limited',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: 'Tax returns + 5 compliance issues. ' +
      'Agent reviews filings + calculates additional tax + penalties + responses.',
    datasetSpec: [
      { name: 'returns', type: 'string', description: 'JSON tax return data', required: true },
    ],
    requiredOutputs: ['additional_tax', 'penalties', 'response_letter'],
    difficulty: 'ADVANCED',
  },
  {
    id: 7,
    title: 'Merger Due Diligence',
    company: 'Acme Target Co.',
    category: 'JUDGMENT',
    tools: ['nc.accounting.compute_npv'],
    promptSummary: '$50M acquisition + financials + contracts + hidden liabilities. ' +
      'Agent identifies risks, calculates valuation, recommends acquisition.',
    datasetSpec: [
      { name: 'cashflows', type: 'string', description: 'JSON projected post-acquisition cashflows', required: true },
      { name: 'discount_rate', type: 'number', description: 'WACC', required: true },
      { name: 'target_data', type: 'string', description: 'JSON target company data', required: true },
    ],
    requiredOutputs: ['valuation', 'risks', 'recommendation'],
    difficulty: 'ADVANCED',
  },
  {
    id: 8,
    title: 'Payroll Review',
    company: 'BrightWave Electronics Limited',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: '1,000 employees + ghost employees + duplicate payments. ' +
      'Agent reconciles + identifies anomalies + recommends controls.',
    datasetSpec: [
      { name: 'payroll', type: 'string', description: 'JSON payroll records', required: true },
    ],
    requiredOutputs: ['reconciliation_report', 'anomalies', 'recommendations'],
    difficulty: 'ADVANCED',
  },
  {
    id: 10,
    title: 'Bank Reconciliation',
    company: 'Sapphire Hotels Group',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: '6 months bank statements + cash book + outstanding cheques + errors + fraud. ' +
      'Agent reconciles + identifies errors + adjusts records.',
    datasetSpec: [
      { name: 'bank', type: 'string', description: 'JSON bank statements', required: true },
      { name: 'cashbook', type: 'string', description: 'JSON cash book', required: true },
    ],
    requiredOutputs: ['reconciliation', 'errors', 'adjustments'],
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 14,
    title: 'Cost Reduction Project',
    company: 'Ocean Foods Manufacturing Ltd.',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: 'Production + utilities + labor + 20 cost-saving opportunities. ' +
      'Agent analyzes costs + ranks opportunities + estimates savings.',
    datasetSpec: [
      { name: 'costs', type: 'string', description: 'JSON cost breakdown', required: true },
    ],
    requiredOutputs: ['ranked_opportunities', 'estimated_savings', 'implementation_plan'],
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 15,
    title: 'Insurance Claim Assessment',
    company: 'Prime Logistics Limited',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: 'Warehouse fire + damaged inventory + policy. ' +
      'Agent assesses losses + verifies coverage + prepares claim.',
    datasetSpec: [
      { name: 'incident', type: 'string', description: 'JSON incident data', required: true },
      { name: 'policy', type: 'string', description: 'JSON policy data', required: true },
    ],
    requiredOutputs: ['loss_assessment', 'coverage_verification', 'claim_package'],
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 16,
    title: 'Loan Application Analysis',
    company: 'Horizon Construction Limited',
    category: 'JUDGMENT',
    tools: ['nc.accounting.amortize_loan'],
    promptSummary: 'Bank loan application + financial statements + cashflows. ' +
      'Agent analyzes ratios + assesses risk + approves/rejects + sets rate.',
    datasetSpec: [
      { name: 'financials', type: 'string', description: 'JSON financial statements', required: true },
      { name: 'cashflows', type: 'string', description: 'JSON projected cashflows', required: true },
      { name: 'loan_amount', type: 'currency', description: 'Requested loan amount', required: true },
      { name: 'term_months', type: 'number', description: 'Loan term in months', required: true },
    ],
    requiredOutputs: ['ratio_analysis', 'risk_assessment', 'recommendation'],
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 18,
    title: 'Expense Reimbursement Audit',
    company: 'Prime Logistics Limited',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: '500 expense claims + receipts + fraudulent claims. ' +
      'Agent verifies receipts + tests compliance + identifies fraud.',
    datasetSpec: [
      { name: 'claims', type: 'string', description: 'JSON expense claims', required: true },
    ],
    requiredOutputs: ['verification_report', 'fraud_findings'],
    difficulty: 'INTERMEDIATE',
  },
  {
    id: 19,
    title: 'Business Valuation',
    company: 'Family Business Inc.',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: '$25M family business + 3 years statements + industry reports. ' +
      'Agent performs DCF + multiples + determines fair value.',
    datasetSpec: [
      { name: 'cashflows', type: 'string', description: 'JSON projected cashflows', required: true },
      { name: 'discount_rate', type: 'number', description: 'WACC', required: true },
      { name: 'comparables', type: 'string', description: 'JSON peer company data', required: false },
    ],
    requiredOutputs: ['dcf_value', 'multiples_value', 'fair_value', 'recommendation'],
    difficulty: 'ADVANCED',
  },
  {
    id: 20,
    title: 'Quarterly Performance Analysis',
    company: 'Blue Ocean Shipping Limited',
    category: 'JUDGMENT',
    tools: [],
    promptSummary: 'Quarterly financial data + KPIs + benchmarks + unusual trends. ' +
      'Agent calculates ratios + analyzes trends + identifies issues.',
    datasetSpec: [
      { name: 'quarterly', type: 'string', description: 'JSON quarterly data', required: true },
    ],
    requiredOutputs: ['ratio_analysis', 'trend_analysis', 'findings'],
    difficulty: 'INTERMEDIATE',
  },
];

export const COMPUTE_SCENARIOS = SIM05_SCENARIOS.filter((s) => s.category === 'COMPUTE');
export const JUDGMENT_SCENARIOS = SIM05_SCENARIOS.filter((s) => s.category === 'JUDGMENT');

export function getScenarioById(id: number): Sim05Scenario | undefined {
  return SIM05_SCENARIOS.find((s) => s.id === id);
}