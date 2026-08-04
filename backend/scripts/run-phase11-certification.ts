import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ProductionPilotGovernance } from '../src/harness/phase11';

const reportsDir = join(__dirname, '..', 'src', 'harness', 'phase11', 'reports');
mkdirSync(reportsDir, { recursive: true });

const pilot = new ProductionPilotGovernance();
pilot.seedDefaultPilotEvidence();
const summary = pilot.summarize();
const out = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  summary,
};

writeFileSync(
  join(reportsDir, 'phase11-production-pilot-summary.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
writeFileSync(
  join(reportsDir, 'phase11-production-pilot-dashboard.json'),
  `${JSON.stringify(summary.dashboard, null, 2)}\n`,
);

console.log('Phase 11 certification artifacts written to', reportsDir);

