// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@prisma/client'],
            message: 'Direct Prisma imports are restricted. Use repository interfaces or approved infrastructure modules.',
          },
        ],
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
  },
  overrides: [
    {
      files: [
        'src/modules/**/repositories/*.ts',
        'src/modules/**/infrastructure/*.ts',
        'src/common/outbox/*.ts',
        'src/modules/enterprise-events/**/*.ts',
        'src/modules/audit/**/*.ts',
        'prisma/**/*.ts',
        'src/test/**/*.ts',
      ],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '*.js',
  ],
};
