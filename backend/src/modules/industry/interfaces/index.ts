/**
 * index.ts — barrel for Industry provider interfaces + symbols.
 *
 * Re-exports all 5 contracts so consumers can do:
 *   import { INDUSTRY_METADATA, IndustryMetadataProvider } from '../industry/interfaces';
 */

export * from './industry-metadata.provider';
export * from './industry-nav.provider';
export * from './industry-customer-field.provider';
export * from './industry-approval-addon.registry';
export * from './industry-widget.provider';
