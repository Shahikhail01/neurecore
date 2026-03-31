// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'prisma/**/*.cjs',
      'scripts/**/*.cjs',
      'dist/**',
      'node_modules/**',
      'src/**/*.d.ts',
    ],
  },
  // Base JavaScript recommended rules
  eslint.configs.recommended,
  // TypeScript recommended rules (non-type-checked to reduce noisy type-aware rules)
  ...tseslint.configs.recommended,
  // Prettier integration
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        // Avoid full type-aware parsing in ESLint run to reduce noisy type-checked rules in CI/dev.
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Custom rules for NestJS backend
    rules: {
      // Allow 'any' in specific scenarios
      '@typescript-eslint/no-explicit-any': 'off',
      // Relax unsafe checks due to gradual typing in Prisma & legacy modules
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // Disable require-await rule where async signatures are used without await
      '@typescript-eslint/require-await': 'off',
      // Disable floating-promises and unsafe-argument rules because parser type-checking is disabled
      '@typescript-eslint/no-floating-promises': 'off',
      // Disable unsafe-argument since it requires type information
      '@typescript-eslint/no-unsafe-argument': 'off',
      // Warn about unused variables (but allow underscore prefix)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Prefer const where possible
      'prefer-const': 'warn',
      // No console in production (allow warn/error)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Prettier formatting
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // Temporarily relax some strict type-aware rules to reduce blocking errors
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      'no-constant-binary-expression': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    // Test files can have different rules
    name: 'test-files',
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
