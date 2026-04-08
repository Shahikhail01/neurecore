#!/usr/bin/env node

/**
 * JWT_SECRET Configuration Verification Script
 * ═══════════════════════════════════════════════════════════════════════════
 * Verifies that JWT_SECRET is properly configured and used throughout the backend
 *
 * Exit codes:
 * 0 = All checks passed
 * 1 = Configuration issues found
 * 2 = Critical errors
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.dirname(__filename);
const ENV_FILE = path.join(BACKEND_ROOT, '.env');
const ENV_EXAMPLE_FILE = path.join(BACKEND_ROOT, '.env.example');

console.log(
  '═══════════════════════════════════════════════════════════════════════════',
);
console.log('JWT_SECRET Configuration Verification');
console.log(
  '═══════════════════════════════════════════════════════════════════════════\n',
);

let checksPassed = 0;
let checksFailed = 0;
let checksWarning = 0;

// Check 1: .env file exists and JWT_SECRET is set
console.log('Check 1: .env file and JWT_SECRET environment variable...');
if (!fs.existsSync(ENV_FILE)) {
  console.log('  ✗ FAIL: .env file not found at', ENV_FILE);
  checksFailed++;
} else {
  const envContent = fs.readFileSync(ENV_FILE, 'utf-8');
  const jwtSecretMatch = envContent.match(/^JWT_SECRET=(.+)$/m);

  if (!jwtSecretMatch) {
    console.log('  ✗ FAIL: JWT_SECRET not defined in .env file');
    checksFailed++;
  } else {
    const jwtSecret = jwtSecretMatch[1].trim();

    if (jwtSecret.length < 32) {
      console.log(
        `  ✗ FAIL: JWT_SECRET is too short (${jwtSecret.length} chars, minimum 32 chars required)`,
      );
      console.log('    Value:', jwtSecret.substring(0, 20) + '...');
      checksFailed++;
    } else {
      console.log(
        `  ✓ PASS: JWT_SECRET is set and has sufficient length (${jwtSecret.length} chars)`,
      );
      checksPassed++;
    }
  }
}
console.log();

// Check 2: SecretProviderService exists and has proper implementation
console.log('Check 2: SecretProviderService implementation...');
const secretProviderPath = path.join(
  BACKEND_ROOT,
  'src/modules/security/providers/secret.provider.ts',
);
if (!fs.existsSync(secretProviderPath)) {
  console.log(
    '  ✗ FAIL: SecretProviderService not found at',
    secretProviderPath,
  );
  checksFailed++;
} else {
  const secretProviderContent = fs.readFileSync(secretProviderPath, 'utf-8');

  const hasGetJwtSecret = secretProviderContent.includes('getJwtSecret()');
  const hasValidation = secretProviderContent.includes(
    'CRITICAL: Required secret',
  );
  const hasThrow = secretProviderContent.includes('throw error');

  if (!hasGetJwtSecret) {
    console.log('  ✗ FAIL: getJwtSecret() method not found');
    checksFailed++;
  } else if (!hasValidation) {
    console.log('  ⚠ WARN: Secret validation not found');
    checksWarning++;
  } else if (!hasThrow) {
    console.log('  ⚠ WARN: Error throwing mechanism not found');
    checksWarning++;
  } else {
    console.log('  ✓ PASS: SecretProviderService has proper validation');
    checksPassed++;
  }
}
console.log();

// Check 3: AuthModule uses SecretProviderService
console.log('Check 3: AuthModule JWT configuration...');
const authModulePath = path.join(
  BACKEND_ROOT,
  'src/modules/auth/auth.module.ts',
);
if (!fs.existsSync(authModulePath)) {
  console.log('  ✗ FAIL: AuthModule not found at', authModulePath);
  checksFailed++;
} else {
  const authModuleContent = fs.readFileSync(authModulePath, 'utf-8');

  const importsSecretProvider = authModuleContent.includes(
    'SecretProviderService',
  );
  const injectsSecretProvider = authModuleContent.includes('inject(');
  const callsGetJwtSecret = authModuleContent.includes(
    'secrets.getJwtSecret()',
  );
  const hasValidation = authModuleContent.includes('JWT_SECRET is missing');

  if (!importsSecretProvider) {
    console.log('  ✗ FAIL: SecretProviderService not imported');
    checksFailed++;
  } else if (!callsGetJwtSecret) {
    console.log('  ✗ FAIL: secrets.getJwtSecret() not called in factory');
    checksFailed++;
  } else if (!hasValidation) {
    console.log('  ⚠ WARN: JWT_SECRET validation not found in auth module');
    checksWarning++;
  } else {
    console.log(
      '  ✓ PASS: AuthModule properly uses SecretProviderService with validation',
    );
    checksPassed++;
  }
}
console.log();

// Check 4: JwtStrategy uses SecretProviderService
console.log('Check 4: JwtStrategy configuration...');
const jwtStrategyPath = path.join(
  BACKEND_ROOT,
  'src/modules/auth/strategies/jwt.strategy.ts',
);
if (!fs.existsSync(jwtStrategyPath)) {
  console.log('  ✗ FAIL: JwtStrategy not found at', jwtStrategyPath);
  checksFailed++;
} else {
  const jwtStrategyContent = fs.readFileSync(jwtStrategyPath, 'utf-8');

  const importsSecretProvider = jwtStrategyContent.includes(
    'SecretProviderService',
  );
  const removedUnsafeFallback = !jwtStrategyContent.includes(
    'process.env.JWT_SECRET',
  );

  if (!importsSecretProvider) {
    console.log(
      '  ⚠ WARN: SecretProviderService not imported (may use config directly)',
    );
    checksWarning++;
  } else if (!removedUnsafeFallback) {
    console.log(
      '  ⚠ WARN: Unsafe process.env.JWT_SECRET fallback still present',
    );
    checksWarning++;
  } else {
    console.log('  ✓ PASS: JwtStrategy properly uses SecretProviderService');
    checksPassed++;
  }
}
console.log();

// Check 5: Unsafe defaults removed from modules
console.log('Check 5: Unsafe hardcoded defaults...');
const modulesToCheck = [
  {
    name: 'OnboardingModule',
    path: 'src/modules/onboarding/onboarding.module.ts',
  },
  { name: 'EventsModule', path: 'src/modules/events/events.module.ts' },
  { name: 'AuthService', path: 'src/core/services/auth.service.ts' },
];

let unsafeDefaults = 0;
for (const module of modulesToCheck) {
  const modulePath = path.join(BACKEND_ROOT, module.path);
  if (!fs.existsSync(modulePath)) {
    console.log(`  ⚠ Module ${module.name} not found at ${module.path}`);
    continue;
  }

  const content = fs.readFileSync(modulePath, 'utf-8');
  const hasUnsafeDefault =
    content.includes("'dev-secret'") ||
    content.includes("'default-secret'") ||
    content.includes("'dev-refresh-secret'");

  if (hasUnsafeDefault) {
    console.log(`  ✗ FAIL: ${module.name} has unsafe hardcoded defaults`);
    unsafeDefaults++;
    checksFailed++;
  }
}

if (unsafeDefaults === 0) {
  console.log('  ✓ PASS: No unsafe hardcoded JWT_SECRET defaults found');
  checksPassed++;
}
console.log();

// Summary
console.log(
  '═══════════════════════════════════════════════════════════════════════════',
);
console.log('Verification Summary');
console.log(
  '═══════════════════════════════════════════════════════════════════════════',
);
console.log(`✓ Passed: ${checksPassed}`);
console.log(`✗ Failed: ${checksFailed}`);
console.log(`⚠ Warnings: ${checksWarning}`);
console.log();

if (checksFailed === 0) {
  console.log(
    '✓ All critical checks passed! JWT_SECRET is properly configured.',
  );
  console.log();
  console.log('Next steps:');
  console.log('1. Run: npm run build');
  console.log('2. Run: npm run start:dev');
  console.log(
    '3. Test authentication: curl -X POST http://localhost:3000/api/v1/auth/login -H "Content-Type: application/json" -d \'{...}\'',
  );
  process.exit(0);
} else {
  console.log(
    '✗ Configuration issues found. Please review the failed checks above.',
  );
  process.exit(1);
}
