# Procedure: Migrate Python repo to uv + Ruff + basedpyright

Target end-state: `pyproject.toml` only, `uv.lock` committed, Ruff replacing flake8/black/isort, basedpyright replacing mypy, Python 3.13+.

Use when audit reveals: `requirements.txt`, `setup.py`, `flake8`, `mypy`, or pre-3.13 target.

## Step 0 — Verify SOTA recommendations

**Before applying this procedure**, run `procedures/research-sota.md` with the standard 4-agent team to confirm uv / Ruff / basedpyright / Python 3.13 are still SOTA *this quarter*. The procedure here freezes choices made on a specific date — verify the canonical rules in AGENTS.md haven't been superseded by something newer (e.g., a faster type checker, a successor to Ruff, a new Python LTS).

If research surfaces a newer SOTA, propose an `AGENTS.md` update PR first, then come back to migrate.

## Pre-flight

Identify the legacy state. Common starting points:
- `requirements.txt` + maybe `requirements-dev.txt` (most common legacy)
- `setup.py` + `setup.cfg` (very legacy)
- `Pipfile` / `pipenv` (uncommon)
- `poetry.lock` + `[tool.poetry]` (modern-ish, but switch to uv)

Note pinned constraints — preserve them.

## Step 1 — Initialize uv (if pyproject.toml is missing or pre-uv)

If no pyproject.toml:
```bash
uv init --package
```

If pyproject.toml exists but is poetry-style:
- Keep `[project]`, drop `[tool.poetry]`
- Migrate `[tool.poetry.dependencies]` → `[project].dependencies`
- Migrate `[tool.poetry.group.dev.dependencies]` → `[dependency-groups].dev`

## Step 2 — Migrate dependencies

From `requirements.txt`:
```bash
xargs -n1 uv add < requirements.txt
```

From `requirements-dev.txt`:
```bash
xargs -n1 uv add --dev < requirements-dev.txt
```

From `setup.py` / `setup.cfg`: read manually, extract `install_requires` and `extras_require`, run `uv add` on each. Preserve version constraints.

## Step 3 — Configure GAR for shared packages

In `pyproject.toml`:

```toml
[[tool.uv.index]]
name = "flingoos"
url = "https://me-west1-python.pkg.dev/flingoos-production/flingoos-python/simple/"
explicit = true

[tool.uv.sources]
flingoos-shared-models = { index = "flingoos" }
```

If repo currently uses `git+https://github.com/Tslilon/flingoos-shared.git@main` — **REMOVE** that and add `flingoos-shared-models[storage]==X.Y.Z` from the `flingoos` index instead.

Local dev requires `gcloud auth login --update-adc` once; CI uses WIF (handled by `reusable-lint-python.yml`).

## Step 4 — Set Python version

In `pyproject.toml`:
```toml
[project]
requires-python = ">=3.13"
```

Create `.python-version` (one line: `3.13`).

## Step 5 — Configure Ruff

Replace any existing `.flake8`, `[tool.black]`, `[tool.isort]`, `[tool.flake8]` with `templates/ruff.template.toml` content (copy as `ruff.toml` in the consumer; or inline the `[tool.ruff]` block into pyproject.toml).

Then:
```bash
rm -f .flake8
```

Remove from `pyproject.toml`:
- `[tool.black]`
- `[tool.isort]`
- `[tool.flake8]`

## Step 6 — Configure basedpyright

Add to `pyproject.toml`:
```toml
[tool.basedpyright]
typeCheckingMode = "strict"
pythonVersion = "3.13"
include = ["src", "tests"]
```

Add basedpyright to dev deps:
```bash
uv add --dev basedpyright
```

Remove from `pyproject.toml`:
- `[tool.mypy]`
- mypy from deps

## Step 7 — Resolve pytest config conflict

If both `pytest.ini` AND `[tool.pytest.ini_options]` exist:
- Pick `[tool.pytest.ini_options]` (consolidated config)
- Delete `pytest.ini`
- Verify `uv run pytest` still discovers tests

## Step 8 — Lock and verify locally

```bash
uv sync
uv run ruff check .                  # expect violations — fix iteratively
uv run ruff format .
uv run basedpyright                  # expect type errors — fix or add ignores
uv run pytest
```

If ruff has hundreds of issues, ratchet by rule family:
```bash
uv run ruff check --select E .       # pycodestyle errors
uv run ruff check --fix --select I . # isort first (auto-fixable)
```

Migration debt is fine — add specific `# ruff: noqa: <rule>` or `[tool.ruff.lint.per-file-ignores]` entries with a comment explaining `MIGRATION DEBT`.

## Step 9 — Update CI

Replace existing `build.yml` (or equivalent) with:

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
    uses: Diligent4/.github/.github/workflows/reusable-lint-python.yml@main
    with:
      needs-ar-auth: true   # if uses flingoos-shared-models; else false
    secrets: inherit
```

Confirm WIF secrets `WIF_PROVIDER` and `WIF_SERVICE_ACCOUNT` are set at the org level (already true for existing repos).

## Step 10 — Add AGENTS.md and CLAUDE.md

Sync `AGENTS.md` from `Diligent4/.github` (or symlink locally for dev). Add `CLAUDE.md`:
```
@AGENTS.md
```

## Step 11 — Add Lefthook

Copy `templates/lefthook.template.yml` to repo root as `lefthook.yml`. Run:
```bash
lefthook install
```

## Step 12 — Commit migration

Suggest splitting into 3-4 atomic commits:
1. `chore: migrate to uv` (pyproject.toml + uv.lock + delete requirements.txt/setup.py)
2. `chore: replace flake8/black/isort with ruff` (ruff config + remove old)
3. `chore: replace mypy with basedpyright`
4. `ci: consume reusable-lint-python.yml from Diligent4/.github`

## Don't

- Don't keep `.flake8` "just in case"
- Don't keep `[tool.black]` or `[tool.isort]` — Ruff replaces both
- Don't keep mypy deps in `pyproject.toml`
- Don't keep both `pytest.ini` AND `[tool.pytest.ini_options]`
- Don't pin `git+https://` URLs — go through GAR
- Don't try to fix all type errors before merging the migration — ratchet via per-file-ignores
