# Procedure: Migrate TS repo to Biome + strict mode + vitest

Target end-state: Biome v2 for lint+format, all required strict flags, vitest for tests (except `flingoos-shared` which keeps jest), Lefthook pre-commit, ESM only.

Use when audit reveals: ESLint legacy (`.eslintrc.json`), missing strict flags, jest in non-shared repos, default exports widespread, no `packageManager` field.

## Step 0 — Verify SOTA recommendations

**Before applying this procedure**, run `procedures/research-sota.md` with the standard 4-agent team to confirm Biome / vitest / strict flags listed below are still SOTA *this quarter*. Biome could be displaced by oxlint (type-aware GA), vitest by something faster, or new TS strict flags could become defaults. Verify before freezing this migration into a repo.

If research surfaces a newer SOTA, propose an `AGENTS.md` update PR first, then come back to migrate.

## Pre-flight

Identify what's currently in place:
- `.eslintrc.*` (legacy) vs `eslint.config.*` (flat) vs `biome.json`
- `.prettierrc*`
- `jest.config.*` vs `vitest.config.*`
- `tsconfig.json` strict flag presence
- `package.json` `type` and `packageManager` fields

## Step 1 — Pin packageManager

In `package.json`:
```json
{
  "packageManager": "npm@10.9.0"
}
```

Or for pnpm: `"pnpm@9.15.0"`. Match what's in `package-lock.json` / `pnpm-lock.yaml`.

## Step 2 — Set ESM mode

In `package.json`:
```json
{
  "type": "module"
}
```

Skip if Next.js — Next handles ESM internally and rejects this flag in some configs. For pure libraries / Node services / Electron main, set it.

## Step 3 — Replace ESLint+Prettier with Biome

```bash
npm uninstall eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-config-prettier eslint-plugin-prettier \
  eslint-config-next  # if Next.js — see special case below
rm -f .eslintrc.* .prettierrc* .prettierignore
npm install --save-dev --save-exact @biomejs/biome@latest
```

Copy `templates/biome.template.json` to repo root as `biome.json`. Verify:
```bash
npx biome ci .
```

### Special case: LLM/storage boundary rules (any TS repo that touches LLMs)

Biome v2 doesn't yet support arbitrary custom rules. The Diligent4 LLM/storage isolation rules ship as a **canonical template** at `Diligent4/.github/skills/diligent4-conventions/templates/eslint-boundary-rules.js`.

Pattern for any TS repo that calls `@flingoos/shared/llm` or `@flingoos/shared/storage`:

1. **Copy `eslint-boundary-rules.js`** from the canonical template into the consumer repo, sibling to `eslint.config.js` — sync workflow keeps it current.
2. **Keep `eslint.config.js`** with a single block that imports + applies the rules:
   ```js
   import {
     NO_DIRECT_LLM_OR_STORAGE_IMPORTS,
     NO_LLM_ENV_READS,
   } from './eslint-boundary-rules.js';

   export default [
     {
       files: ['src/**/*.ts'],
       rules: {
         'no-restricted-imports': ['error', NO_DIRECT_LLM_OR_STORAGE_IMPORTS],
         'no-restricted-syntax': ['error', ...NO_LLM_ENV_READS],
       },
     },
     // per-file exceptions go here; document the bypass reason inline
   ];
   ```
3. **Use Biome for everything else** (formatting, standard lint).
4. Run both in pre-commit and CI.

`flingoos-mcp` and `flingoos-admin-panel/frontend` currently inline these rules — migrating them to consume the canonical template is part of the pilot. Other LLM-touching repos should consume the template from day one.

### Special case: Next.js

Keep `eslint-config-next` until Biome reaches Next compatibility. Use Biome only for formatting; ESLint flat config for `next` rules.

## Step 4 — Upgrade tsconfig

Copy `templates/tsconfig.template.json` (as `tsconfig.json` in the consumer) and merge with the existing one. The required strict flags:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "useUnknownInCatchVariables": true,
    "target": "ES2022",
    "moduleResolution": "bundler"
  }
}
```

For Node-only packages (libraries, services without bundler): use `"moduleResolution": "nodenext"` instead.

Run:
```bash
npx tsc --noEmit
```

If error count is high, ratchet — enable one flag at a time, fix, commit, repeat. Don't try to fix all 200 errors in one PR.

## Step 5 — Migrate jest → vitest (skip if `flingoos-shared`)

```bash
npm uninstall jest @types/jest ts-jest jest-environment-jsdom @jest/globals
rm -f jest.config.* jest.setup.*
npm install --save-dev vitest @vitest/ui
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',           // or 'jsdom' if React/DOM
    globals: false,                 // explicit imports preferred
    coverage: { reporter: ['text', 'lcov'] }
  }
})
```

Update `package.json` scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

Find/replace in test files: `from '@jest/globals'` → `from 'vitest'`. Most code requires no other changes — vitest is jest-API-compatible (`describe`, `it`, `test`, `expect`, `beforeEach`, etc.).

Mock APIs differ slightly: `jest.fn()` → `vi.fn()`, `jest.mock()` → `vi.mock()`. Run tests, fix one file at a time.

## Step 6 — Update CI

Replace `build.yml` (or equivalent) with:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    uses: Diligent4/.github/.github/workflows/reusable-lint-node.yml@main
    with:
      needs-ar-auth: true            # if uses @flingoos/shared
      package-manager: npm           # or pnpm
      run-biome: true
      run-eslint: false              # set true if you kept eslint.config.js for custom rules
    secrets: inherit
```

## Step 7 — Add AGENTS.md and CLAUDE.md

```bash
# Sync AGENTS.md from Diligent4/.github
echo '@AGENTS.md' > CLAUDE.md
```

Optionally add `.github/copilot-instructions.md` (one line referencing AGENTS.md) for Copilot users.

## Step 8 — Add Lefthook

Copy `templates/lefthook.template.yml` to repo root as `lefthook.yml`:
```bash
lefthook install
```

## Step 9 — Commit migration

Suggest splitting into atomic commits:
1. `chore: pin packageManager and set type=module`
2. `chore: replace eslint+prettier with biome`
3. `chore: enable tsconfig strict flags` (one PR per ratchet step if errors are many)
4. `chore: migrate jest → vitest` (skip for `flingoos-shared`)
5. `ci: consume reusable-lint-node.yml from Diligent4/.github`

## Don't

- Don't keep both `.eslintrc.*` AND `biome.json` — pick Biome (with `eslint.config.js` only for custom rules Biome can't express yet)
- Don't migrate `flingoos-shared` from jest until Phase 2 stabilizes — it's the publishing keystone
- Don't change `target` if you ship a browser bundle — verify the deploy target's browser support first
- Don't add `noPropertyAccessFromIndexSignature: true` — too noisy, off by default in our tsconfig
- Don't run `biome format` before committing the migration — too many cosmetic changes will hide the real diff
