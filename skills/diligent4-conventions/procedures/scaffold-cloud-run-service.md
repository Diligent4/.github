# Procedure: Scaffold a new Cloud Run service

Use when the user wants to add a new service to the Diligent4 fleet.

## Decision tree

Answer these before scaffolding:

1. **Language** — TypeScript or Python?
2. **Traffic** — internal-only (VPC), external (public), or both with auth?
3. **Shared deps** — does it use `@flingoos/shared` (TS) or `flingoos-shared-models` (Python)?
4. **State** — stateless (min-instances=0) or warm (min-instances=1+)?
5. **Triggers** — HTTP only, or also Cloud Scheduler / Pub/Sub?

## Files to create

```
flingoos-<service-name>/
├── src/                              ← service code
├── tests/                            ← tests
├── Dockerfile                        ← multi-stage build
├── .dockerignore
├── package.json | pyproject.toml
├── tsconfig.json | (none for Python)
├── biome.json   | ruff.toml          ← lint/format config
├── lefthook.yml                      ← pre-commit (from templates/lefthook.template.yml)
├── AGENTS.md                         ← symlink or sync from Diligent4/.github
├── CLAUDE.md                         ← single line: @AGENTS.md
├── .github/
│   ├── copilot-instructions.md       ← reference AGENTS.md
│   └── workflows/
│       ├── ci.yml                    ← uses reusable-lint-{node,python}.yml
│       ├── deploy.yml                ← uses reusable-cloud-run-deploy.yml
│       └── check-pr.yml              ← uses reusable-check-checkboxes.yml
└── README.md
```

## Standard `ci.yml`

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
    uses: Diligent4/.github/.github/workflows/reusable-lint-<node|python>.yml@main
    with:
      needs-ar-auth: true
    secrets: inherit
```

## Standard `deploy.yml`

```yaml
name: Deploy <service-name>
on:
  push:
    branches: [main]
    paths: ['src/**', 'Dockerfile', '.github/workflows/deploy.yml']
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
        default: staging
  release:
    types: [published]

concurrency:
  group: deploy-${{ github.event_name == 'release' && 'production' || github.event.inputs.environment || 'staging' }}
  cancel-in-progress: false

jobs:
  deploy:
    uses: Diligent4/.github/.github/workflows/reusable-cloud-run-deploy.yml@main
    with:
      service-name: flingoos-<service-name>
      target-env: ${{ github.event_name == 'release' && 'production' || github.event.inputs.environment || 'staging' }}
      project-id: ${{ github.event_name == 'release' && 'flingoos-production' || 'flingoos-staging' }}
      project-number: ${{ github.event_name == 'release' && '407742180982' || '874835055262' }}
      service-account: flingoos-<service-name>-sa@flingoos-${{ github.event_name == 'release' && 'production' || 'staging' }}.iam.gserviceaccount.com
      port: '3000'                       # 3000 for Node, 8080 for most others
      cpu: '1'
      memory: '512Mi'                    # bump for memory-heavy services
      min-instances: '0'                 # 1+ for warm services with cold-start sensitivity
      max-instances: '10'
      enable-rollback: true
      enable-trivy: true
      env-vars: |
        NODE_ENV=production
        LOG_LEVEL=info
      secrets-mapping: |
        # KEY=secret-name:version (Secret Manager)
        # API_KEY=apikeys-svc-_platform:latest
    secrets: inherit
```

For services that need VPC egress (private GCP resources), add via `extra-deploy-args`:
```yaml
      extra-deploy-args: |
        --network=flingoos-egress-vpc
        --subnet=flingoos-egress-subnet
        --vpc-egress=all-traffic
```

For services receiving Cloud Scheduler OIDC traffic, add `custom-audiences`:
```yaml
      custom-audiences: flingoos-<service-name>
```

## Standard `check-pr.yml`

```yaml
name: PR Checks
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]

jobs:
  checkboxes:
    uses: Diligent4/.github/.github/workflows/reusable-check-checkboxes.yml@main
```

## Dockerfile shape — TypeScript

Multi-stage with `node:24-slim`. Copy from existing `flingoos-mcp/Dockerfile` for the canonical pattern:
- Stage 1: install deps with `npm ci --prefer-offline --ignore-scripts` (after `google-artifactregistry-auth`)
- Stage 2: build with `tsc`
- Stage 3: minimal runtime with only `dist/`, `node_modules/`, `package.json`
- Use `--mount=type=secret,id=gcloud_adc` to pass GCP creds at build for AR auth
- `USER node` (drop root)

## Dockerfile shape — Python

Multi-stage with `python:3.13-slim`. Pattern:
- Stage 1: `uv sync --frozen --no-dev --all-extras` into a `/app/.venv`
- Stage 2: copy venv + source, set `ENTRYPOINT`
- For AR auth: same `--mount=type=secret` pattern
- `USER appuser` (drop root)

## GCP setup checklist

Before the first deploy:

1. **Service account exists in BOTH projects** — `flingoos-<service-name>-sa@flingoos-staging.iam.gserviceaccount.com` and `@flingoos-production`
2. **WIF role binding** — `github-actions-deployer@*` has `roles/iam.serviceAccountUser` on the service SA
3. **Container repo exists** — `flingoos-containers` in both projects (already set up org-wide)
4. **Secret Manager secrets** — pre-create with `gcloud secrets create` and grant the service SA `roles/secretmanager.secretAccessor`
5. **DNS / domain mapping** — only if external; configure after first successful deploy

## Don't

- Don't copy-paste an existing `deploy.yml` — use the reusable workflow
- Don't bake secrets into the Dockerfile or env-vars — use `--set-secrets` / `secrets-mapping`
- Don't add VPC egress flags unless the service actually needs GCP private resources
- Don't allow unauthenticated traffic if the service has any auth assumption — pass `allow-unauthenticated: false`
- Don't forget the `paths:` filter on the deploy push trigger — README-only commits should not redeploy
- Don't use `min-instances > 0` unless cold-start latency is genuinely unacceptable — costs $0 → $$ instantly
