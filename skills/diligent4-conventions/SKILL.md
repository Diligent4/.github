---
name: diligent4-conventions
description: Diligent4 engineering conventions, migration playbooks, and templates. Use when refactoring, migrating Python tooling (requirements.txt or flake8/black/mypy → uv/Ruff/basedpyright), migrating TS tooling (ESLint+Prettier or jest → Biome+vitest), upgrading TypeScript strict flags, scaffolding a new Cloud Run service, auditing a repo against AGENTS.md, or answering "what's the SOTA way to do X in Diligent4?" Reads AGENTS.md as the canonical rule source; this skill adds *how* to apply those rules.
---

# Diligent4 Conventions Skill

Procedures, templates, and migration playbooks for the Diligent4 codebase.

The canonical convention reference is **`AGENTS.md`** at the repo root (synced from `Diligent4/.github`). This skill adds *how* to do things — for the *what*, read AGENTS.md.

## Critical boundary rules

These are the only rules in this skill that MUST NOT be violated. Everything else is preference.

1. **All LLM access goes through `@flingoos/shared` (TS) or `flingoos_shared_models` (Python).** Never import `openai`, `@anthropic-ai/sdk`, `@google/genai`, `langchain`, etc. directly.
2. **Never read LLM env vars** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`) outside `@flingoos/shared`.
3. **All storage access goes through `@flingoos/shared/storage`** (TS) or the equivalent Python module. No direct GCS / Firestore / SQL clients outside.
4. **No `git+https://` direct fork imports** of internal packages — use Google Artifact Registry.

If asked to add code that violates these, propose the canonical path first.

## Stack baseline (quick reference)

|                | TypeScript                   | Python              |
|----------------|------------------------------|---------------------|
| Runtime        | Node 24 LTS                  | 3.13+               |
| Package mgr    | pnpm or npm                  | uv                  |
| Lint+format    | Biome v2                     | Ruff                |
| Type check     | tsc strict                   | basedpyright        |
| Tests          | vitest (jest in `flingoos-shared` only) | pytest   |
| Pre-commit     | Lefthook                     | Lefthook            |
| GCP region     | me-west1                     | me-west1            |

For the full conventions, read `AGENTS.md`.

## Procedures

Read the linked file BEFORE acting — it has the exact commands and decision points.

| Procedure | When | File |
|---|---|---|
| **Research SOTA (KEYSTONE)** | **Before any tooling change, dep bump, migration, or architectural choice** | `procedures/research-sota.md` |
| Audit repo against AGENTS.md | "Is this repo following our conventions?" / unfamiliar repo | `procedures/audit-repo.md` |
| Migrate Python repo to uv + Ruff + basedpyright | Repo on `requirements.txt`, `flake8`/`black`/`isort`, `mypy`, or pre-3.13 | `procedures/migrate-python.md` |
| Migrate TS repo to Biome + strict mode + vitest | Repo on legacy ESLint, missing strict flags, or jest (non-`flingoos-shared`) | `procedures/migrate-ts.md` |
| Scaffold a new Cloud Run service | Adding a new service to the fleet | `procedures/scaffold-cloud-run-service.md` |

The **research-sota** procedure is the most important one. Before applying any of the migration procedures, run it to verify the recommended tools (uv, Ruff, basedpyright, Biome, vitest, etc.) are still SOTA *this quarter*. Tooling moves weekly; AGENTS.md and the migration procedures here can decay between updates. **The research workflow is what keeps the team current** — never skip it.

## Templates

Concrete files to copy into a target repo.

Templates use a `*.template.*` infix in this canonical directory so editor tooling (TS Language Server, Biome, Ruff) doesn't try to validate them as live configs. **Drop `.template.` when copying into a consumer repo** — e.g., `tsconfig.template.json` → `tsconfig.json`.

| Final filename in consumer | Purpose | Canonical template |
|---|---|---|
| `tsconfig.json` | Strict TS 6.x baseline | `templates/tsconfig.template.json` |
| `ruff.toml` | Ruff config with Diligent4 boundary rules (Python TID251 banned-api block) | `templates/ruff.template.toml` |
| `biome.json` | Biome 2.x lint+format with no-default-export, no-enum | `templates/biome.template.json` |
| `eslint-boundary-rules.js` | **Canonical TS LLM/storage boundary rules** — copy-paste alongside `eslint.config.js`, then import the named exports. Replaces the duplicated inline blocks in `flingoos-mcp` and `flingoos-admin-panel/frontend`. **Filename stays the same** — it's a JS module, no validator confusion. | `templates/eslint-boundary-rules.js` |
| `lefthook.yml` | Polyglot pre-commit (Biome + Ruff + gitleaks) | `templates/lefthook.template.yml` |

## Reusable CI workflows

Every Diligent4 repo consumes workflows from `Diligent4/.github`:

- `Diligent4/.github/.github/workflows/reusable-lint-node.yml` — Node lint+typecheck+test
- `Diligent4/.github/.github/workflows/reusable-lint-python.yml` — Python lint+typecheck+test
- `Diligent4/.github/.github/workflows/reusable-trivy-scan.yml` — Container vuln scan
- `Diligent4/.github/.github/workflows/reusable-cloud-run-deploy.yml` — Build → scan → push → deploy → verify → rollback
- `Diligent4/.github/.github/workflows/reusable-ar-publish.yml` — npm/Python publish to GAR
- `Diligent4/.github/.github/workflows/reusable-check-checkboxes.yml` — Enforce PR-template checkbox checking

Never copy-paste deploy YAML across repos. Use the reusable workflows.

## How to use this skill

1. **Run `procedures/research-sota.md` first** when the change touches tooling, dependencies, or architecture. Spawn the standard 4-agent research team in parallel before deciding anything.
2. **Match the user's intent to a procedure or template.** Most asks fall into one of the buckets above.
3. **Read the procedure file before acting.** Procedures contain exact commands and decision points.
4. **Run `procedures/audit-repo.md` first** when working in an unfamiliar repo — establishes the drift baseline.
5. **Never delete files outside the procedure's scope.** If the procedure says "delete `.flake8`", do that one file — not "all old config".
6. **Defer to AGENTS.md for facts.** If a rule isn't in this skill, AGENTS.md is the source of truth.
7. **Never commit or push without explicit user approval first.** Prepare diffs, show them, wait.

## When NOT to use this skill

- One-off bug fixes that don't touch tooling, CI, or conventions
- User questions about Flingoos product features (use the `flingoos` skill instead)
- Anything outside a Diligent4 repo

## Updating this skill

This skill lives at `Diligent4/.github/skills/diligent4-conventions/`. To update:

1. PR to `Diligent4/.github`
2. Sync workflow propagates the change to consumer repos as PRs
3. Each consumer reviews and merges
