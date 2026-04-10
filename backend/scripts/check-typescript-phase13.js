#!/usr/bin/env node

/**
 * Phase 13: Fix TypeScript Errors Script
 * 
 * Analyzes and attempts to fix common TypeScript errors in frontend components
 * that use NocoBase modules
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m', 
  red: '\x1b[31m',
  blue: '\x1b[36m',
};

async function runTypeCheck(workspaceRoot, component) {
  console.log(`${colors.blue}Running TypeScript check for ${component}...${colors.reset}`);

  const componentPath = path.join(workspaceRoot, component);
  
  const result = spawnSync('npx', ['tsc', '--noEmit', '--skipLibCheck'], {
    cwd: componentPath,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  const output = result.stderr || result.stdout || '';
  const lines = output.split('\n').filter(l => l.includes('error'));
  
  console.log(`  Found ${lines.length} TypeScript errors`);
  
  return {
    component,
    errors: lines.slice(0, 20), // First 20 errors
    totalErrors: lines.length,
    success: result.status === 0,
  };
}

async function main() {
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Phase 13: TypeScript Error Analysis${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);

  const workspaceRoot = '/mnt/data/Web Dev/NeureCore';
  const components = ['frontend-admin', 'frontend-tenant'];
  
  console.log(`${colors.yellow}Note: Run this after router imports are fixed${colors.reset}\n`);

  for (const component of components) {
    const result = await runTypeCheck(workspaceRoot, component);
    
    if (result.success) {
      console.log(`  ${colors.green}✓ No TypeScript errors!${colors.reset}\n`);
    } else {
      console.log(`  ${colors.yellow}Top errors:${colors.reset}`);
      result.errors.slice(0, 5).forEach(err => {
        console.log(`    ${err.substring(0, 100)}`);
      });
      console.log();
    }
  }

  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
}

main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
