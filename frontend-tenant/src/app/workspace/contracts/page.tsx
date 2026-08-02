'use client';

import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { contractsConfig } from './config';

export default function ContractsPage() {
  return <WorkspaceModuleBuilder config={contractsConfig} />;
}