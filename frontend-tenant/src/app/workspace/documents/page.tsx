'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { documentsConfig } from './config';
export default function DocumentsPage() {
  return <WorkspaceModuleBuilder config={documentsConfig} />;
}