/**
 * NeureCore Backend - Jest Configuration
 * Production-ready test configuration with SOLID principles
 *
 * Supports:
 * - Unit tests: Isolated tests for services, controllers
 * - Integration tests: Tests with real dependencies but mocked external services
 * - E2E tests: Full application tests with test database
 *
 * @version 1.0.0
 */

module.exports = {
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/*.spec.ts',
    '<rootDir>/test/unit/**/*.spec.ts',
    '<rootDir>/test/e2e/**/*.spec.ts',
  ],

  // Ignore plugins-backup folder to avoid duplicate jest haste collisions
  testPathIgnorePatterns: ['<rootDir>/src/plugins-backup/'],

  // File extensions to consider
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Source file handling
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
        // Enable strict type checking in tests
        isolatedModules: true,
        // Use Babel for better compatibility
        useESM: false,
      },
    ],
  },

  // Test environment
  testEnvironment: 'node',

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/**/index.ts',
    '!**/*.module.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!prisma/**',
    '!scripts/**',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/modules/': {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },

  // Coverage reporters
  coverageReporters: ['html', 'text', 'lcov', 'json', 'text-summary'],

  // Coverage output directory
  coverageDirectory: '<rootDir>/coverage',

  // Clear mocks between tests
  clearMocks: true,

  // Detect open handles (helps find async leaks)
  detectOpenHandles: true,

  // Force Jest to exit after tests complete
  forceExit: true,

  // Timeout for tests (30 seconds)
  testTimeout: 30000,

  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Error on deprecated features
  errorOnDeprecated: true,

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test/setup/unit.setup.ts'],

  // Module path ignore patterns - exclude backup and node_modules
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/src/plugins-backup/',
  ],

  // Roots
  roots: ['<rootDir>/src/', '<rootDir>/test/'],

  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@common/(.*)$': '<rootDir>/src/common/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@infrastructure/(.*)$': '<rootDir>/src/infrastructure/$1',
  },
};
