'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { promotionsConfig } from './config';
export default function PromotionsPage() {
  return <WorkspaceModuleBuilder config={promotionsConfig} />;
}