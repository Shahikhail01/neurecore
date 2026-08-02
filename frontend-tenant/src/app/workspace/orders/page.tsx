'use client';
import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { ordersConfig } from './config';
export default function OrdersPage() {
  return <WorkspaceModuleBuilder config={ordersConfig} />;
}