'use client';

import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { knowledgeConfig } from './config';

export default function KnowledgePage() {
  return <WorkspaceModuleBuilder config={knowledgeConfig} />;
}