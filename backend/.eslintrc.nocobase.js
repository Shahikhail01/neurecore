module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.nocobase.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'unused-imports'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist/**', 'node_modules/**'],
  rules: {
    // SOLID: Single Responsibility - Warn on large functions/classes
    complexity: ['warn', 10],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true }],
    'max-lines': ['warn', { max: 300, skipBlankLines: true }],

    // SOLID: Interface Segregation - Enforce interface quality
    '@typescript-eslint/no-empty-interface': [
      'error',
      { allowSingleExtends: false },
    ],

    // SOLID: Dependency Inversion - Forbid direct instantiation of services
    'no-restricted-syntax': [
      'error',
      {
        selector:
          'NewExpression[callee.name=/^(NocoDB|Database|API|Service)$/]',
        message:
          'Use dependency injection instead of direct instantiation (SOLID: Dependency Inversion)',
      },
    ],

    // Type safety
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-types': 'error',
    '@typescript-eslint/explicit-module-boundary-types': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-promises': 'error',
    '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],

    // Code style
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: 'enumMember',
        format: ['UPPER_CASE'],
      },
    ],

    // Error handling
    '@typescript-eslint/no-throw-literal': 'error',
    '@typescript-eslint/prefer-readonly': 'warn',
  },
};
