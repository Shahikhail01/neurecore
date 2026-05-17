/**
 * NocoBase Client Shim
 * Re-exports from local NocoBase modules
 */

// Re-export from local block-provider
export * from '../block-provider';

// Re-export from local data-source
export * from '../data-source';

// Re-export from local collection-manager
export * from '../collection-manager';

// Re-export from local schema-component
export * from '../schema-component';

// Re-export from local schema-settings
export * from '../schema-settings';

// Re-export from local schema-initializer
export * from '../schema-initializer';

// Re-export from local acl
export * from '../acl';

// Re-export from local plugins
export * from '../plugins';

// Common re-exports
export { default as antd } from 'antd';
export { default as React } from 'react';
export * from 'react';
