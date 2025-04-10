import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    files: ['**/*.{ts,tsx,cts,mts,js,cjs,mjs}'],
  },
  {
    ignores: [
      '**/node_modules/**',
      '.yarn/',
      'eslint.config.mjs',
      'run/**/*.js',
      'scripts/*.js',
      'avd/',
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
    },
  }
);
