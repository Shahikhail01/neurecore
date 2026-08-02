'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { campaignsConfig } from './config';
export default function CampaignsPage() {
  return <WorkspaceModuleBuilder config={campaignsConfig} />;
}