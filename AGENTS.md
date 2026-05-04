# Diligent4 Engineering Conventions

Canonical agent instructions for every Diligent4 repository.

Read natively by Codex, Cursor (≥1.0), Gemini CLI, Windsurf, Aider, GitHub Copilot (org-wide custom instructions), and similar AGENTS.md-aware tools. Claude Code reads it via a one-line `CLAUDE.md` containing `@AGENTS.md`.

This file is **the canonical source**. Per-repo overrides live in the consumer's `CLAUDE.md` / `.cursor/rules/` and must reference (not duplicate) the rules below.

## Stack baseline

| Concern            | TypeScript                                | Python                              |
|--------------------|-------------------------------------------|-------------------------------------|
| Runtime            | Node 24 LTS                               | Python 3.13+                        |
| Package manager    | pnpm or npm (via `packageManager` field)  | uv                                  |
| Lint + format      | Biome v2                                  | Ruff                                |
| Type checker       | tsc (strict)                              | basedpyright                        |
| Tests              | vitest (jest only in `flingoos-shared`)   | pytest                              |
| Pre-commit         | Lefthook                                  | Lefthook                            |
| GCP region         | me-west1                                  | me-west1                            |

### Quality layers — all required, all independent

Lint, type-check, and tests are **separate concerns**. CI runs them as **separate steps** and **all must pass**:

| Layer | TypeScript | Python | Catches | Misses |
|---|---|---|---|---|
| Lint + format | Biome v2 | Ruff | Style, conventions (no-default-export, no-enum), unused imports, simple patterns | Real type/runtime bugs |
| **Type check** | **tsc --noEmit** | **basedpyright** | Null handling, contract violations, generic mismatches, cross-module type errors | Style + conventions |
| Tests | vitest (jest in `flingoos-shared`) | pytest | Behavior | Static issues |
| Boundary rules | ESLint custom (`eslint-boundary-rules.js`) | Ruff TID251 banned-api | Architectural rules (no direct LLM/storage imports, no LLM env reads) | Type-level issues |

Skipping a layer is not an option. Lint without type-check misses ~90% of real bugs; type-check without lint misses convention violations and architectural rules. The `reusable-lint-{node,python}.yml` workflows enforce this — every step is independent and every step must pass.

## TypeScript

### Required `tsconfig.json` flags

- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `verbatimModuleSyntax: true`
- `useUnknownInCatchVariables: true`
- `target: ES2022` or later
- `moduleResolution: bundler` for FE/Vite/Next; `nodenext` for Node-only packages

### Modules and exports

- ESM only: `"type": "module"` in `package.json`
- `import type { ... }` for type-only imports
- **No default exports** — always named
- `node:` prefix on Node builtins (`import fs from 'node:fs/promises'`)

### Idioms

- `satisfies` + `as const` for literal config objects
- Discriminated unions over enums; **no `enum`**
- Branded types at domain boundaries
- Schema-first with **zod** at I/O seams
- Native `fetch` — no axios, node-fetch, got
- `AbortController` / `AbortSignal` on every async I/O entrypoint
- Web Streams (`ReadableStream`) over `node:stream` in new code

## Python

### Build and packaging

- `pyproject.toml` only — no `setup.py`, no `requirements.txt`
- Lock file: `uv.lock` (committed)
- `requires-python = ">=3.13"`
- One config source per concern — **never both `pytest.ini` AND `[tool.pytest.ini_options]`**

### Lint, format, type

- **Ruff** rules: `E, W, F, I, B, UP, SIM, RUF, N, PL, TID`
- `ruff format` (replaces black + isort)
- **basedpyright** in strict mode
- Type hints on every function signature (args + return)

### Idioms

- `pydantic v2` at I/O boundaries; `pydantic-settings` for config
- `src/` layout, not flat
- `asyncio.TaskGroup` over `asyncio.gather`
- `match` for tagged-union dispatch on Pydantic discriminator fields
- `pytest` + `pytest-asyncio`; AAA layout

## Cross-cutting

### Architecture

- Feature folders, not by-type. **No `utils/`, `helpers/`, `lib/`** as global folders
- Hexagonal / ports-and-adapters at module boundaries
- Functional core, imperative shell
- Throw in core, log at edge — **never swallow** errors
- Repository pattern only when there are ≥2 stores

### Naming

- `camelCase` TS variables, `snake_case` Python
- `PascalCase` types/classes (both languages)
- `kebab-case` TS filenames, `snake_case` Python filenames

### Comments

- Comments explain **why**, never **what**
- Delete a comment if renaming would make it redundant
- No JSDoc `@param` blocks on TS — type signatures are the docs

### Size soft ceilings

- Function ≤ 40 lines
- File ≤ 400 lines

### Imports order

- TS: builtin (`node:*`) → external (`react`, `zod`) → internal alias (`@/x`) → relative (`./x`)
- Python: stdlib → third-party → first-party → relative

## Diligent4 boundary rules

These are **load-bearing security policies**. Enforced by lint + CI.

1. **All LLM access goes through `@flingoos/shared` (TS) or `flingoos_shared_models` (Python).** No direct imports of `openai`, `@anthropic-ai/sdk`, `@google/genai`, `langchain`, etc. outside the shared package.
2. **No reading of LLM env vars** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, etc.) outside `@flingoos/shared`.
3. **All storage access goes through `@flingoos/shared/storage`** or the equivalent Python module. No direct GCS / Firestore / SQL client imports outside.

Enforcement (Phase 2):
- TS: `@flingoos/eslint-plugin` (rules: `no-direct-llm-imports`, `no-llm-env-reads`, `no-direct-storage-imports`)
- Python: `@flingoos/ruff-rules` shared `[tool.ruff.lint.flake8-tidy-imports]` block

## CI

All repos consume reusable workflows from `Diligent4/.github`:

- `reusable-lint-node.yml`
- `reusable-lint-python.yml`
- `reusable-trivy-scan.yml`
- `reusable-cloud-run-deploy.yml`
- `reusable-ar-publish.yml`
- `reusable-check-checkboxes.yml`

### Workflow rules

- **Lint, type-check, and tests as separate steps** — never combine into one umbrella script (`npm run check`, `make ci`). Each layer is an independent gate; the CI log must show which layer failed without re-running. The `reusable-lint-{node,python}.yml` workflows already enforce this shape.
- **SHA-pin** all third-party actions (post-`tj-actions/changed-files` CVE).
- **Concurrency cancellation** on PR runs:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```
- **Path filters** on lint/build to skip irrelevant CI.
- **Least-privilege** `permissions:` at workflow or job level.
- `actions/cache@v4` minimum.
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` env var until Node 24 default rolls out (2026-06-02).

## Forbidden patterns

**TypeScript**
- `enum`, `namespace`, default exports, CommonJS, dual ESM/CJS
- `axios`, `node-fetch`, `got` — use native fetch
- `jest` in new TS code (vitest), unless inheriting `flingoos-shared`'s setup
- Class-based DI containers (tsyringe, InversifyJS)
- Plain JS files in TS repos (`allowJs: true`)
- JSDoc on TS functions

**Python**
- `setup.py`, `setup.cfg`, `requirements.txt`
- `flake8`, `black`, `isort`, `pyupgrade`, `pydocstyle` as separate tools (Ruff replaces all)
- `mypy` (use basedpyright)
- `dotenv` package (use `--env-file` or `pydantic-settings`)
- `unittest.TestCase` setUp/tearDown (use pytest fixtures)
- Poetry for new projects (use uv)

**General**
- `git+https://` direct fork imports of shared packages — go through Google Artifact Registry
- Tag-pinned third-party GitHub Actions in CI — SHA-pin them
- Both `pytest.ini` AND `[tool.pytest.ini_options]` in same repo
- Comments that restate the code

## Updating this file

1. Open a PR against `Diligent4/.github`
2. The sync workflow propagates merged changes to consumer repos as PRs
3. Each consumer reviews and merges in its own time
4. Drift dashboard (cron) reports any consumer >30 days behind
