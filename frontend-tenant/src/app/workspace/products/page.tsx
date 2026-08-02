'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { productsConfig } from './config';
export default function ProductsPage() {
  return <WorkspaceModuleBuilder config={productsConfig} />;
}