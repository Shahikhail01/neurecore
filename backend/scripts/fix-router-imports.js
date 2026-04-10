#!/usr/bin/env node

/**
 * Phase 13: React Router DOM Import Replacer
 *
 * Replaces all "from 'react-router-dom'" with "from '@/lib/router-compat'"
 * in frontend-admin and frontend-tenant source files.
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
};

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);

    // Skip node_modules, .next, dist, etc
    if (
      ['node_modules', '.next', 'dist', '.git', 'build'].includes(file.name)
    ) {
      continue;
    }

    if (file.isDirectory()) {
      walkDir(fullPath, callback);
    } else if (
      file.isFile() &&
      (file.name.endsWith('.ts') || file.name.endsWith('.tsx'))
    ) {
      callback(fullPath);
    }
  }
}

function replaceImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace react-router-dom imports in various formats
  content = content.replace(
    /from ['"]react-router-dom['"]/g,
    "from '@/lib/router-compat'",
  );

  // Also handle require syntax
  content = content.replace(
    /require\(['"]react-router-dom['"]\)/g,
    "require('@/lib/router-compat')",
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

async function main() {
  console.log(
    `${colors.blue}Phase 13: React Router DOM Import Replacer${colors.reset}\n`,
  );

  const dirs = [
    '/mnt/data/Web Dev/NeureCore/frontend-admin/src',
    '/mnt/data/Web Dev/NeureCore/frontend-tenant/src',
  ];

  let totalFiles = 0;
  let replacedFiles = 0;

  for (const dir of dirs) {
    const componentName = dir.includes('frontend-admin')
      ? 'Frontend-Admin'
      : 'Frontend-Tenant';
    console.log(`${colors.blue}Scanning ${componentName}...${colors.reset}`);

    walkDir(dir, (filePath) => {
      totalFiles++;
      if (replaceImports(filePath)) {
        replacedFiles++;
        const relative = filePath.replace(dir, '');
        console.log(`  ${colors.green}✓${colors.reset} ${relative}`);
      }
    });
  }

  console.log(
    `\n${colors.green}Replaced ${replacedFiles} files out of ${totalFiles} total files${colors.reset}\n`,
  );
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
