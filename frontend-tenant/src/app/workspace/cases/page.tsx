'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { casesConfig } from './config';
export default function CasesPage() {
  return <WorkspaceModuleBuilder config={casesConfig} />;
}