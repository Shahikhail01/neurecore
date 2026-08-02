'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { assetsConfig } from './config';
export default function AssetsPage() {
  return <WorkspaceModuleBuilder config={assetsConfig} />;
}