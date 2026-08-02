'use client';

/**
 * TicketsPage — thin wrapper around WorkspaceModuleBuilder.
 *
 * PRUNED-INDUSTRIES-IMPLEMENTATION-PLAN §6.1.5 (P1) — every workspace
 * module page is a 5-line wrapper. Adding a new module = one config file
 * (config.ts sibling) + this 5-line page.
 */

import { WorkspaceModuleBuilder } from '@/components/industry/WorkspaceModuleBuilder';
import { ticketsConfig } from './config';

export default function TicketsPage() {
  return <WorkspaceModuleBuilder config={ticketsConfig} />;
}