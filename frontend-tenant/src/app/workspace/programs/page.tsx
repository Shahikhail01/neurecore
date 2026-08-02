'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { programsConfig } from './config';
export default function ProgramsPage() {
  return <WorkspaceModuleBuilder config={programsConfig} />;
}