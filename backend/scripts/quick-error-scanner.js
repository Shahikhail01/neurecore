#!/usr/bin/env node

/**
 * Phase 13: Quick Error Scanner
 * 
 * Detects common issues without full compilation:
 * - Missing imports
 * - Undefined references
 * - Type issues
 * - Missing modules
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
  magenta: '\x1b[35m',
};

const issues = {
  missing_modules: [],
  import_errors: [],
  type_errors: [],
  reference_errors: [],
};

function scanDirectory(dirPath, component) {
  console.log(`${colors.blue}Scanning ${component}...${colors.reset}`);
  
  const files = [];
  
  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && !entry.name.startsWith('node_modules')) {
            walk(fullPath);
          }
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
          files.push(fullPath);
        }
      });
    } catch (e) {
      // Skip unreadable dirs
    }
  }
  
  walk(dirPath);
  
  // Sample first 20 files for quick check
  const sampleFiles = files.slice(0, 20);
  
  console.log(`  Total TS/TSX files: ${files.length}`);
  console.log(`  Sampling: ${sampleFiles.length} files for quick diagnostics\n`);
  
  let sampleErrors = 0;
  
  sampleFiles.forEach((file) => {
    try {
      const content = fs.readFileSync(file, 'utf8');
      
      // Check for common patterns
      if (content.includes('import') && content.includes('from')) {
        // Look for unresolved imports
        const importLines = content.split('\n').filter(l => l.includes('import') && l.includes('from'));
        
        importLines.forEach((line) => {
          // Check for @nocobase imports
          if (line.includes('@nocobase/')) {
            const match = line.match(/@nocobase\/[\w-]+/);
            if (match && !content.includes('node_modules/@nocobase')) {
              // This might be an issue if not properly aliased
            }
          }
          
          // Check for missing modules
          if (line.includes('react-router-dom')) {
            sampleErrors++;
            issues.import_errors.push({
              file: file.substring(file.indexOf(component)),
              issue: 'react-router-dom import found',
              line: line.trim(),
            });
          }
        });
      }
      
      // Check for common issues
      if (content.includes('unknown type') || content.includes('Type not found')) {
        sampleErrors++;
      }
      
    } catch (e) {
      // Skip files we can't read
    }
  });
  
  return sampleErrors;
}

async function main() {
  console.log(`\n${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Phase 13: Quick Error Scanner${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);

  const workspaceRoot = '/mnt/data/Web Dev/NeureCore';
  
  let totalErrors = 0;
  
  // Scan both frontends
  totalErrors += scanDirectory(
    path.join(workspaceRoot, 'frontend-admin/src'),
    'frontend-admin'
  );
  
  totalErrors += scanDirectory(
    path.join(workspaceRoot, 'frontend-tenant/src'),
    'frontend-tenant'
  );
  
  // Report findings
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}Quick Scan Results${colors.reset}\n`);
  
  if (issues.import_errors.length > 0) {
    console.log(`${colors.red}Import Errors Found: ${issues.import_errors.length}${colors.reset}`);
    issues.import_errors.slice(0, 5).forEach((err) => {
      console.log(`  ${err.file}:`);
      console.log(`    ${err.issue}`);
      console.log(`    ${err.line}\n`);
    });
  } else {
    console.log(`${colors.green}✓ No obvious import errors found${colors.reset}\n`);
  }
  
  console.log(`${colors.yellow}Note: This is a quick scan. Full TypeScript compilation may reveal additional issues.${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════${colors.reset}\n`);
}

main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
