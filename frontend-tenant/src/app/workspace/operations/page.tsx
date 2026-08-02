'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { operationsConfig } from './config';
export default function OperationsPage() {
  return <WorkspaceModuleBuilder config={operationsConfig} />;
}