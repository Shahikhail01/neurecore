'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { contentConfig } from './config';
export default function ContentPage() {
  return <WorkspaceModuleBuilder config={contentConfig} />;
}