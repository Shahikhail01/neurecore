'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { fieldOpsConfig } from './config';
export default function FieldOperationsPage() {
  return <WorkspaceModuleBuilder config={fieldOpsConfig} />;
}