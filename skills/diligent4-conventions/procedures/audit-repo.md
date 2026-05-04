# Procedure: Audit a repo against AGENTS.md

Use when the user asks "is this repo following our conventions?" or you're starting work in an unfamiliar repo.

This audit is **read-only**. Do not auto-fix anything during the audit.

## Step 1 — Identify the stack

Read these files at the repo root (or under `frontend/`, `backend/`, etc. for monorepo-ish layouts):

- `package.json` → TS/JS
- `pyproject.toml` → Python (modern)
- `requirements.txt` only → legacy Python
- `setup.py` → very legacy Python
- Both `package.json` and `pyproject.toml` → mixed (e.g., `flingoos-shared`)

## Step 2 — Run convention checks

### TypeScript repos

Check `package.json`:
- [ ] `"type": "module"` (ESM)
- [ ] `packageManager` field pinned (e.g., `"npm@10.9.0"` or `"pnpm@9.15.0"`)
- [ ] Test framework: vitest (or jest, only in `flingoos-shared`)
- [ ] No axios, node-fetch, got — uses native fetch

Check `tsconfig.json` (or `tsconfig.*.json` if composite):
- [ ] `strict: true`
- [ ] `noUncheckedIndexedAccess: true`
- [ ] `exactOptionalPropertyTypes: true`
- [ ] `verbatimModuleSyntax: true`
- [ ] `useUnknownInCatchVariables: true`
- [ ] `target: "ES2022"` or later
- [ ] `moduleResolution: "bundler"` (FE) or `"nodenext"` (Node-only)

Check lint setup:
- [ ] `biome.json` exists
- [ ] No `.eslintrc*` (or only present for custom rules Biome can't express)
- [ ] No `.prettierrc*`

Check code patterns (grep `src/`):
- [ ] No `^export default` (no default exports)
- [ ] No `^export enum |^enum ` (no TS enums)
- [ ] No `module.exports` or top-level `require(` (no CommonJS)

Check shared deps:
- [ ] `@flingoos/shared` installed from GAR (look in `.npmrc` for `me-west1-npm.pkg.dev`)
- [ ] Not pinned via `git+https://`

Check LLM/storage boundary rules (only if repo calls `@flingoos/shared/llm` or `@flingoos/shared/storage`):
- [ ] `eslint-boundary-rules.js` exists alongside `eslint.config.js` (sibling file)
- [ ] `eslint.config.js` imports `NO_DIRECT_LLM_OR_STORAGE_IMPORTS` + `NO_LLM_ENV_READS` from it
- [ ] `eslint-boundary-rules.js` content matches canonical at `Diligent4/.github/skills/diligent4-conventions/templates/eslint-boundary-rules.js` (drift = stale sync)
- [ ] Per-file exception blocks have inline comments explaining why the bypass is legitimate

### Python repos

Check build files:
- [ ] `pyproject.toml` exists
- [ ] `uv.lock` exists and is committed
- [ ] No `setup.py`, no `requirements.txt`, no `Pipfile`, no `poetry.lock`
- [ ] `[project].requires-python = ">=3.13"`
- [ ] `.python-version` file contains `3.13` (if present)

Check linter/type config in `pyproject.toml`:
- [ ] `[tool.ruff]` configured with rule set including at least `E, W, F, I, B, UP, SIM, RUF, N, PL, TID`
- [ ] `[tool.basedpyright]` configured
- [ ] No `[tool.mypy]`, no `[tool.black]`, no `[tool.isort]`, no `[tool.flake8]`
- [ ] No `.flake8` file

Check pytest config:
- [ ] EITHER `pytest.ini` OR `[tool.pytest.ini_options]` — never both

Check layout:
- [ ] `src/` layout (not flat)

Check shared deps:
- [ ] `flingoos-shared-models` installed from GAR (`[tool.uv.sources]` with `index = "flingoos"`)
- [ ] Not pinned via `git+https://`

### All repos

- [ ] `lefthook.yml` exists at root
- [ ] `AGENTS.md` exists at root (or symlink to org canonical)
- [ ] `CLAUDE.md` exists at root, single line `@AGENTS.md`
- [ ] `.github/workflows/` consumes reusable workflows from `Diligent4/.github` (look for `uses: Diligent4/.github/...`)
- [ ] All third-party actions in CI are SHA-pinned — grep `uses:` in `.github/workflows/*.yml` for any `@v1`, `@v2`, etc. without a SHA

## Step 3 — Report findings

Output a Markdown table grouped by severity:

```
## Convention Audit: <repo-name>

### 🔴 Critical (boundary rules)
| Check | Status | Detail |
|---|---|---|
| LLM access via @flingoos/shared | ❌ | `src/llm/openai.ts:5` directly imports `openai` |

### 🟠 High (toolchain)
| ... | ... | ... |

### 🟡 Medium (config)
| ... | ... | ... |

### 🟢 Low (style)
| ... | ... | ... |

## Recommended next step
[Pick ONE migration, link to the procedure file]
```

## Step 4 — Recommend ONE next step

Don't try to fix everything at once. Pick the highest-impact item from Critical/High. Common choices:

- **Critical found**: fix that immediately, separate PR
- **No type checker / no strict flags**: link to `procedures/migrate-ts.md` or `procedures/migrate-python.md`
- **No reusable CI**: link to `procedures/scaffold-cloud-run-service.md` (or simpler — replace `build.yml` with the reusable lint workflow)
- **No AGENTS.md/CLAUDE.md**: trivial fix, do it now

## Don't

- Don't `rm -rf` legacy files. List them; let the user decide.
- Don't auto-fix lint/format. Audit is read-only.
- Don't speculate about file contents — read them.
- Don't list every minor style issue — focus on the rule, not its 47 occurrences.
