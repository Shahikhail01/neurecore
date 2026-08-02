'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { grantsConfig } from './config';
export default function GrantsPage() {
  return <WorkspaceModuleBuilder config={grantsConfig} />;
}