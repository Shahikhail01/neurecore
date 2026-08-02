'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { storesConfig } from './config';
export default function StoresPage() {
  return <WorkspaceModuleBuilder config={storesConfig} />;
}