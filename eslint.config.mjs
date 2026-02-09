import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  {
    files: ['**/*.{ts,tsx,cts,mts,js,cjs,mjs}'],
  },
  {
    plugins: {
      perfectionist,
    },
  },
  {
    ignores: [
      '**/node_modules/**',
      '.pnpm-store/',
      'eslint.config.mjs',
      'run/**/*.js',
      'scripts/*.js',
      'avd/',
      'allure*/',
      'run/localizer/*',
      'pnpm-lock.yaml',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked, // see https://typescript-eslint.io/getting-started/typed-linting/
  {
    languageOptions: {
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: globals.node,
    },
  },
  {
    rules: {
      'no-unused-vars': 'off', // we have @typescript-eslint/no-unused-vars enabled below
      'no-else-return': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      quotes: ['error', 'single', { avoidEscape: true, allowTemplateLiterals: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          caughtErrors: 'none',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'perfectionist/sort-imports': 'error',
      'perfectionist/sort-named-imports': 'error',
      'perfectionist/sort-union-types': [
        'error',
        {
          // This ensures null/undefined come after other types for better readability
          groups: [
            'named',
            'keyword',
            'operator',
            'literal',
            'function',
            'import',
            'conditional',
            'object',
            'tuple',
            'intersection',
            'union',
            'nullish',
          ],
        },
      ],
    },
  },
  {
    files: ['run/localizer/*'],
    rules: {
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'perfectionist/sort-union-types': 'off',
    },
  },
  {
    files: ['run/test/specs/locators/*'],
    rules: {
      'perfectionist/sort-modules': 'error',
    },
  }
);
