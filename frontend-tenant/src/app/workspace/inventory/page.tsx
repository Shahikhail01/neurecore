'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { inventoryConfig } from './config';
export default function InventoryPage() {
  return <WorkspaceModuleBuilder config={inventoryConfig} />;
}