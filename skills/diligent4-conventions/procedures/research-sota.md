# Procedure: Research SOTA before tooling, dependency, or pattern changes

**This is the keystone Diligent4 workflow.** Before any tooling change, dependency upgrade, refactor, or architectural decision — fan out research to a team of agents and verify what's current. **Don't trust your training data.** The cutoff is months stale; tooling moves weekly.

## When to invoke this procedure

**ALWAYS before:**

- Adding a new dependency to any repo
- Bumping a major version of any dep
- Migrating tooling (lint, format, test, type checker, package manager, build tool)
- Choosing between alternatives (e.g., tRPC vs ts-rest, Drizzle vs Prisma, Zod vs Valibot)
- Refactoring an architectural pattern (DI, error handling, schema validation, logging)
- Updating `AGENTS.md` or this skill
- Any answer to "what's the SOTA way to do X?"

**OPTIONALLY before:**

- Onboarding a new pattern across the fleet
- Reviewing a non-trivial PR that introduces something new

If you're tempted to skip — **don't**. The cost of stale advice is days of rework, supply-chain incidents, or convention drift that propagates to 18 repos.

## The fan-out pattern

Spawn **3–5 research agents in parallel** (one Agent tool call per slice, all in a single message so they run concurrently). Each gets a **focused brief**, uses **WebSearch and WebFetch heavily**, and returns a **tight report** (~700 words max). You synthesize.

### Standard 4-agent team for tooling changes

**Agent 1 — SOTA conventions**
> What's the canonical way to do *X* as of *[today's date]*? What patterns have replaced what in the last 12 months? Cite blog posts, conference talks, ThoughtWorks Tech Radar entries, and engineering blogs from Vercel / Cloudflare / Stripe / Anthropic / Shopify. Output: top 3 conventions ranked by adoption + reasoning + URLs.

**Agent 2 — Dependency landscape**
> For each candidate tool/library, fetch:
> - Latest stable version + release date (from GitHub Releases or registry)
> - Active maintenance (commits in last 6 months; open issues; release cadence)
> - npm/PyPI weekly download trend
> - Listed alternatives being replaced or replacing it
>
> Use `gh api repos/<owner>/<repo>/releases/latest` and registry stats. **Verify versions by fetching the actual release pages** — do not trust training-data version numbers.

**Agent 3 — Breaking changes & migration cost**
> For each major version bump in scope, fetch:
> - Major-version release notes
> - Migration guides
> - Common pitfalls reported on StackOverflow / GitHub issues
> - Deprecation timelines
>
> Output: a per-version breaking-change list with severity rating (mechanical / behavioral / architectural).

**Agent 4 — Diligent4 fit**
> Validate candidate tools against existing Diligent4 constraints:
> - **Cost-sensitive**: prefer free/OSS, but paid SaaS is acceptable when it earns its keep (real productivity / safety / time savings vs. its monthly cost). Always quote per-seat or per-month pricing for paid options so user can decide.
> - GAR + WIF auth setup
> - Cloud Run me-west1 deploy
> - `@flingoos/shared` boundary rules (LLM/storage isolation)
> - Reusable workflows in `Diligent4/.github`
> - Coexistence with TS 6 + Node 24 + Python 3.13
>
> Output: pass/fail table per candidate with concrete reasoning. For paid options, always include a `Cost` column with annual estimate for a 5-dev team.

### Optional 5th agent for major decisions

**Agent 5 — Devil's advocate**
> Find what's WRONG with the recommended approach. Search "X is bad", "X considered harmful", "moving away from X". Find the strongest counter-arguments. Surface what the consensus misses. Be skeptical and adversarial — your job is to find weaknesses, not validate.

## Brief template

Every agent prompt MUST include:

- **Today's date** — so they know what "current" means
- **Diligent4 stack context** (1 paragraph): TS+Python fleet, Node 24 LTS, Python 3.13+, pnpm/npm + uv, Biome + Ruff, basedpyright, vitest (jest only in `flingoos-shared`), Cloud Run me-west1, cost-sensitive (prefer free/OSS, paid SaaS acceptable when justified — always quote pricing), GAR for shared packages
- **The specific question** — narrow, not open-ended
- **Output format** — table, ranked list, decision matrix
- **Word cap** — ~700 words
- **"Use WebSearch and WebFetch heavily; do NOT rely on training-data assumptions"**
- **"Be skeptical and adversarial — find what's wrong, don't rubber-stamp"**

## Synthesis after agents return

1. **Cross-reference findings**. Where do agents agree? Where do they disagree?
2. **Verify cited claims**. Agents can hallucinate URLs. Spot-check 2–3 of the most load-bearing links — if a citation 404s, the claim it backs is suspect.
3. **Surface conflicts to the user**. If Agent 1 says X is SOTA but Agent 3 found X has critical breaking changes, **don't decide silently** — bring it to the user.
4. **Compare to existing AGENTS.md**. If findings supersede current rules, **propose a PR** to `Diligent4/.github` with the diff for user review.
5. **Switch to the matching procedure**. If findings recommend a migration, hand off to `procedures/migrate-*.md`.

## Output to user

**Default to tables for comparisons, version data, trade-offs, and pricing.** Prose only for the final one-paragraph recommendation and narrative justification. Bulleted lists are fine for action items.

After synthesis, produce:

1. **Recommendation** (one paragraph, prose): what to do, why, with the strongest evidence link
2. **Trade-offs table** (Markdown table, required): ranked alternatives with `Option | Pros | Cons | Cost` columns. Always include `Cost` even when free — write `Free (OSS)` or `Free up to N seats`.
3. **AGENTS.md diff** (if rules need updating): show the diff for review, **do not commit**
4. **Concrete next step** (1–2 bullets): action the user approves before you proceed

## Worked example: "should we adopt Biome v2?"

Spawned 4 parallel agents:

- **Agent 1** (SOTA): Biome 2.x is the JS/TS lint+format SOTA per Q1 2026 — replaces ESLint+Prettier in greenfield. ESLint flat config still required for plugin-heavy repos (e.g., Next.js).
- **Agent 2** (deps): Biome 2.x stable; 1.5M weekly downloads; active monthly releases; oxlint is rising but still alpha for type-aware rules.
- **Agent 3** (breaking): v1 → v2 was the major migration; type-aware lint rules added in v2. From ESLint+Prettier: most rule equivalents map directly via `npx biome migrate`.
- **Agent 4** (D4 fit): free OSS ✅ (cost-OK), no GAR conflict, single binary (CI win), works with Node 24, can coexist with `eslint.config.js` for the LLM-isolation custom rules until `@flingoos/eslint-plugin` lands.

Synthesis: **Adopt Biome for lint+format; keep `eslint.config.js` only for custom rules until Phase 2.** Documented in `procedures/migrate-ts.md`.

## When findings change AGENTS.md

If the research surfaces a new SOTA that supersedes a current rule (e.g., "Biome v3 has dropped no-default-export" — fictional but illustrative):

1. Open a PR against `Diligent4/.github`
2. Update the relevant section of `AGENTS.md`
3. Update the relevant `procedures/*.md` and `templates/*` if needed
4. Note the change in the PR description with the agent reports as evidence
5. **Don't merge silently** — user reviews evidence, then merges

## Don't

- Don't skip this for "small" changes — small bumps cause supply-chain attacks (axios 2026, tj-actions/changed-files 2025)
- Don't rely on training data — your model cutoff is months stale, tooling moves weekly
- Don't ask 1 agent to do all 4 jobs — focused briefs produce better research than a generalist
- Don't proceed when 2+ agents disagree — escalate to the user
- Don't update AGENTS.md without user approval — open a PR with the agent reports as evidence
- Don't paste raw agent output to the user — synthesize into recommendation + trade-offs + next step
- Don't run agents sequentially when they're independent — parallel only
