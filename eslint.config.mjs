import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const unusedVars = ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }];

export default tseslint.config(
  { ignores: ['dist/', 'dist-electron/', 'node_modules/', 'release/', 'src/blob/glyphs.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: globals.browser },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-render': 'error',
      'react-hooks/immutability': 'error',
      // The React Compiler lint rules (`refs`, `set-state-in-effect`, `purity`, ...) assume the
      // compiler is on. It isn't here, and this codebase deliberately uses "latest ref" updates
      // during render and state sync inside effects, so those rules are left off.
      '@typescript-eslint/no-unused-vars': unusedVars,
    },
  },
  {
    files: ['electron/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { '@typescript-eslint/no-unused-vars': unusedVars },
  },
  {
    files: ['*.test.ts', 'vite.config.mts', 'eslint.config.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  }
);
