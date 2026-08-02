'use client';

import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { releasesConfig } from './config';

export default function ReleasesPage() {
  return <WorkspaceModuleBuilder config={releasesConfig} />;
}