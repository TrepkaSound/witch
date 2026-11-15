// The lint step (guardrails, Ed's go 2026-11-15; docs/notes/guardrails.md). A small rule set that earns its place: each rule
// catches real mistakes tsc lets through, with few false alarms. tsc already covers unused variables (noUnusedLocals,
// noUnusedParameters) and switch fallthrough (noFallthroughCasesInSwitch) for src/, so those aren't repeated here.
// An existing violation that isn't a trivial fix carries a per-line `// eslint-disable-next-line <rule> -- <why>`: no shared
// baseline file for builders to clash on. Run: npm run lint (about a minute: the promise rules read the types).
import tseslint from 'typescript-eslint';

/** Cheap rules (no type information), for src/ and tools/ alike. */
const plain = {
  eqeqeq: ['error', 'always', { null: 'ignore' }], // (== null for "null or undefined" is the one allowed loose compare)
  'no-self-compare': 'error',
  'no-dupe-else-if': 'error',
  'no-cond-assign': 'error',
  'no-self-assign': 'error',
  'no-dupe-keys': 'error',
  'no-duplicate-case': 'error',
  'no-unreachable': 'error',
  'no-loss-of-precision': 'error',
  'no-unsafe-negation': 'error',
  'no-constant-binary-expression': 'error',
  'no-fallthrough': 'error',
  'use-isnan': 'error',
  'valid-typeof': 'error',
  'no-debugger': 'error',
};

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', 'tools/voice/pink-trombone/**'] }, // (vendored)
  { linterOptions: { reportUnusedDisableDirectives: 'error' } }, // (a disable left behind after its line is fixed fails)
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      ...plain,
      'no-var': 'error',
      'no-unsafe-finally': 'error',
      // A promise nobody awaits or catches: its failure is silent. `void p` says "fire and forget" on purpose.
      '@typescript-eslint/no-floating-promises': 'error',
      // An async function where a plain callback is expected (an event handler, setTimeout): its rejection goes nowhere.
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-for-in-array': 'error',
    },
  },
  {
    files: ['tools/**/*.{js,mjs,cjs,ts}'],
    languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest' },
    rules: plain, // (no-var left out: the page scripts tools inject keep var; no-unsafe-finally: the tests' fixture guards throw there)
  },
];
