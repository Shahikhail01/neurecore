#!/usr/bin/env node

/**
 * Phase 13: Resolve @nocobase/* Imports
 *
 * Creates wrapper modules and path aliases to resolve @nocobase/* packages
 * to local copies in frontend-admin/src and frontend-tenant/src
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

// Helper to parse JSON with comments (tsconfig.json format)
function parseJsonWithComments(content) {
  try {
    // Remove comments while preserving strings
    let commentRemoved = content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ style comments
      .replace(/\/\/.*$/gm, '') // Remove // style comments
      .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas

    return JSON.parse(commentRemoved);
  } catch (e) {
    console.error(`Parse error: ${e.message}`);
    // If parsing fails, try a more aggressive approach
    content = content
      .split('\n')
      .filter(
        (line) =>
          !line.trim().startsWith('//') && !line.trim().startsWith('/*'),
      )
      .join('\n');

    let cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove trailing commas more aggressively
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    return JSON.parse(cleaned);
  }
}

async function createNocobaseIndexFiles() {
  console.log(
    `${colors.blue}Phase 13: Creating NocoBase Module Index Files${colors.reset}\n`,
  );

  const components = [
    {
      name: 'Frontend-Admin',
      path: '/mnt/data/Web Dev/NeureCore/frontend-admin/src',
    },
    {
      name: 'Frontend-Tenant',
      path: '/mnt/data/Web Dev/NeureCore/frontend-tenant/src',
    },
  ];

  for (const component of components) {
    console.log(`${colors.blue}${component.name}${colors.reset}`);

    // Create wrapper for @nocobase/client
    const clientIndex = path.join(
      component.path,
      'lib/nocobase-client-shim.ts',
    );
    const clientContent = `/**
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
`;

    fs.mkdirSync(path.dirname(clientIndex), { recursive: true });
    fs.writeFileSync(clientIndex, clientContent, 'utf8');
    console.log(
      `  ${colors.green}✓${colors.reset} Created lib/nocobase-client-shim.ts`,
    );
  }

  console.log(
    `\n${colors.green}Created NocoBase wrapper modules${colors.reset}\n`,
  );
}

async function updateTsConfig() {
  console.log(
    `${colors.blue}Updating tsconfig.json with path aliases${colors.reset}\n`,
  );

  const components = [
    {
      name: 'Frontend-Admin',
      path: '/mnt/data/Web Dev/NeureCore/frontend-admin',
    },
    {
      name: 'Frontend-Tenant',
      path: '/mnt/data/Web Dev/NeureCore/frontend-tenant',
    },
  ];

  for (const component of components) {
    const tsconfigPath = path.join(component.path, 'tsconfig.json');

    if (!fs.existsSync(tsconfigPath)) {
      console.log(
        `  ${colors.yellow}⚠${colors.reset} ${component.name}: tsconfig.json not found`,
      );
      continue;
    }

    const content = fs.readFileSync(tsconfigPath, 'utf8');

    // Check if paths already have @nocobase/client mapped
    if (
      content.includes('@nocobase/client') &&
      content.includes('./src/lib/nocobase-client-shim.ts')
    ) {
      console.log(
        `  ${colors.green}✓${colors.reset} ${component.name}: Paths already configured`,
      );
      continue;
    }

    // Try to parse with the helper function
    try {
      const tsconfig = parseJsonWithComments(content);

      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
      }

      if (!tsconfig.compilerOptions.paths) {
        tsconfig.compilerOptions.paths = {};
      }

      // Add path aliases for @nocobase packages
      tsconfig.compilerOptions.paths['@nocobase/client'] = [
        './src/lib/nocobase-client-shim.ts',
      ];
      if (!tsconfig.compilerOptions.paths['@nocobase/*']) {
        tsconfig.compilerOptions.paths['@nocobase/*'] = ['./src/*'];
      }

      fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');
      console.log(
        `  ${colors.green}✓${colors.reset} ${component.name}: Added path aliases`,
      );
    } catch (err) {
      console.log(
        `  ${colors.yellow}⚠${colors.reset} ${component.name}: Skipped (paths may already be configured)`,
      );
    }
  }

  console.log(`\n`);
}

async function main() {
  try {
    await createNocobaseIndexFiles();
    await updateTsConfig();
    console.log(
      `${colors.green}Phase 13: @nocobase import resolution complete${colors.reset}\n`,
    );
  } catch (err) {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    process.exit(1);
  }
}

main();
