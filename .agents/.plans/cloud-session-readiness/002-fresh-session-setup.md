# Plan 002: Give fresh agent sessions reproducible setup and scoped fetch permissions

> **Executor instructions:** Follow the steps and checks in order. Keep this contributor tooling separate from animation-runtime changes. Update the sibling README status/evidence unless a reviewer owns it. Stop on the conditions below.
>
> Revision 2026-10-05 (dispatch pre-flight): The operator selected Claude Sonnet 5.5. T3 delegated children inherit this thread's current checkout; this batch will use the dispatch skill's serial, otherwise-idle shared-checkout exception. Only one executor writes at a time. Guard will not modify repo files while an executor runs, and owns all commits/index updates. This supersedes the isolated-worktree wording below for this dispatch; there is no worktree binding override or parallel implementation. Source baseline remains d40a038f because no in-scope source drift was found.
>
> **Drift check first:** `git diff --stat d40a038f..HEAD -- CLAUDE.md README.md CONTRIBUTING.md .claude/settings.json .gitignore src/testing/claudeProjectSettings.spec.ts`. Compare the current-state excerpts against live files. Expected predecessor Plan 001 changes are outside this scope; do not rewrite them.

## Status

- Priority: P2
- Effort: S
- Risk: LOW — shared allow rules change fetch approvals for contributors
- Depends on: 001-portable-chromium.md for documenting the completed browser fallback
- Category: docs / dx
- Planned at: commit `d40a038f`, 2026-10-05

## Why this matters

A fresh cloud checkout lacks the developer's local settings, installed browsers, and implicit setup knowledge. Existing contributor instructions require tests and package checks but do not supply their prerequisites. Add a provider-neutral setup guide and tightly scoped Claude WebFetch rules, with clear limits on which cloud sessions read them. Keep the existing Motion 14.0.0 dependencies unchanged.

## Current state

- `CLAUDE.md:15-29` names the end-to-end feature checklist, including:

```md
- Add focused unit and Playwright e2e coverage when the behavior is testable.
- Create unit tests for each new function.
- Run formatting, checks, package validation, and targeted tests.
```

Retain the full checklist, wait-mode notes, MultiStateBadge parity instructions, and failed-e2e page-by-page review workflow. Add setup guidance without weakening these requirements.

- `README.md:20-24` tells users `npm install @humanspeak/svelte-motion`; it has no dedicated fresh-contributor setup section. Preserve the public consumer install; add a short link to the contributor guide. Do not repair unrelated historical counts/parity claims in this plan.
- `package.json` and `docs/package.json` declare pnpm 12.6.0 and Node 24.18.0 in Volta. Root scripts: `check`, `package`, `build`, `test`, `test:e2e`. Docs scripts: `build`, `check`, `test`; docs use Cloudflare deployment. Do not deploy.
- `.trunk/trunk.yaml:58-74` enables Trunk-managed ESLint, Prettier and other linters. The package's `lint`/`format` scripts are not the comprehensive authority.
- `.husky/pre-commit:5-9` explicitly skips formatting/lint if Trunk is absent. A successful hook therefore is not proof that all checks ran. Preserve hook behavior in this plan; explain the limitation.
- `.github/workflows/pr-build.yml` builds package before checks and builds docs before docs check. Docs build creates prerequisites; an isolated docs typecheck is not the reliable fresh-checkout sequence.
- `.github/workflows/run-tests.yml:143-144` installs browsers; `docs-browser-tests.yml:51-55` installs Chromium and Firefox.
- No `.claude/settings.json` is tracked at baseline (`git ls-files '.claude/*'` is empty). `.gitignore:44-46` currently ignores a Claude task lock and worktrees, but not an explicit settings.local.json entry.
- Testing exemplar: `src/lib/__tests__/motionDependencies.spec.ts:1-5,17-20` reads JSON using Node `readFileSync`, resolves paths relative to `import.meta.url`, and uses Vitest. Match this for the shared-permissions contract test. Use four spaces, single quotes, no semicolons in TypeScript; normal JSON in settings; concise Markdown. Google-style JSDoc for any new named exported helper (none should be needed).

This plan adds contributor documentation/configuration, not a product feature; no public animation demos, package API or runtime changeset are needed.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Confirm versions | `node --version` and `pnpm --version` | Node 24.x and pnpm 12.6.0; guide records exact project Volta pin |
| Workspace setup | `pnpm install --frozen-lockfile --config.engine-strict=false` | Exit 0, no tracked dependency drift |
| Required tool | `trunk --version` | Trunk installed; missing executable is reported, not counted as lint success |
| Focused settings tests | `pnpm exec vitest run src/testing/claudeProjectSettings.spec.ts` | All new configuration contract cases pass |
| Root preparation/types | `pnpm build` then `pnpm check` | Exit 0; zero check errors; build includes package/publint |
| Standalone package validation | `pnpm package` | Exit 0, publint passes |
| Full root units | `pnpm test` | Exit 0 |
| Vite 6 consumer | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | Exit 0 after package build |
| Docs preparation/types | `pnpm --dir docs build` then `pnpm --dir docs check` | Exit 0, zero check errors |
| Docs units | `pnpm --dir docs exec vitest run --browser.headless` | Exit 0 |
| Root focused browser | `pnpm exec playwright test e2e/text/exact-text.spec.ts --project=chromium` | SSR/hydration pass |
| Docs browser projects | `pnpm exec playwright test --config docs/playwright.config.ts` | Chromium/Firefox pass |
| Format/lint | `trunk fmt CONTRIBUTING.md CLAUDE.md README.md .claude/settings.json .gitignore src/testing/claudeProjectSettings.spec.ts` then `trunk check CONTRIBUTING.md CLAUDE.md README.md .claude/settings.json .gitignore src/testing/claudeProjectSettings.spec.ts` | Formatting stable, no new findings |
| Integrity | `git diff --check` | Exit 0 |

Commands in the guide must distinguish setup, focused development verification, and final integrated release verification. Existing recent successful verification can be reused for unchanged runtime code; no need to rerun a full browser suite solely for prose or shared JSON edits. The table supplies exact commands for contributors and future integrated candidates, not permission to mark unexecuted checks passed.

## Scope

Only modify:

- `CONTRIBUTING.md` (create, provider-neutral setup and verification guide).
- `CLAUDE.md` (short bootstrap section linking to the guide; preserve existing instructions).
- `README.md` (short contributor-guide link only).
- `.claude/settings.json` (create, the exact scoped fetch configuration below).
- `.gitignore` (add an explicit repository-local Claude settings.local.json ignore).
- `src/testing/claudeProjectSettings.spec.ts` (create, permission/config contract).
- This batch's README status/evidence.

Out of scope: manifests/lockfile/version updates; animation code; package exports; hooks/CI permissions; Bash allow rules or permission bypass; MCP installation/configuration; account credentials/session logs; runtime documentation cleanup; hosted issues/PRs, release, deploy or publication. Do not inspect or copy personal settings or `.env` values.

## Git workflow

If dispatched, use an isolated executor worktree from the reviewed branch after Plan 001. Example branch `docs/fresh-agent-session-setup`, conventional commit `docs: document fresh agent session verification`. Preserve the existing #498 fix. Do not push/open PR/merge/commit unless authorized by the operator.

## Steps

### Step 1: Write provider-neutral bootstrap and verification instructions

Create `CONTRIBUTING.md`, link it from README, and add a brief setup section to CLAUDE.md. Explain:

1. Start from repository root. Use Node 24 (project Volta pin 24.18.0) and pnpm 12.6.0; verify versions first. Provide the exact frozen install command in the table. Do not advise installing latest tools globally or upgrading lockfiles as setup repair.
2. Install Trunk using its official platform instructions (https://docs.trunk.io/cli). Run `trunk --version`; run `trunk fmt` and `trunk check` as appropriate. A hook may skip them when Trunk is missing, so a successful commit alone is insufficient.
3. Standard supported browser setup: `pnpm exec playwright install --with-deps chromium firefox`. Linux system-library installation may require image provisioning; report denied prerequisites rather than silently weakening checks.
4. Plan 001 fallback semantics: pinned Chromium wins whenever installed. If missing, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` supplies an explicit regular executable; otherwise the cloud-image convention `PLAYWRIGHT_BROWSERS_PATH/chromium` may be used. The latter is an executable path convention, not arbitrary cache discovery. Invalid explicit paths fail clearly. External Chromium is supplementary evidence with recorded version, not a supported-browser guarantee or a Firefox substitute. Explain all three consumers: root e2e, docs e2e, docs browser units.
5. Prerequisites/order: root build emits package consumed by docs and consumer fixture; normal docs build generates inputs before docs check. Provide all command-table checks, the client smoke command `pnpm --dir docs exec vitest run --project=client --browser.headless`, and final root e2e command `pnpm exec playwright test --project=chromium`.
6. Describe root Vitest/JSDOM versus docs browser/server projects. Docs browser Vitest defaults to headed outside detected CI; always include `--browser.headless` in the cloud client and full docs verification commands, avoiding reliance on DISPLAY or an implicit CI variable. Docs client test inclusion requires `.svelte.test.ts`/`.svelte.spec.ts`; root testing files under `src/testing` are not public library exports. State that screenshot failure artifacts do not imply platform screenshot baselines.
7. Preserve the existing failed-e2e review policy verbatim in CLAUDE.md. In the guide link to it: full-run failures are reviewed one page at a time with the maintainer; do not bulk-update snapshots or loosen assertions.
8. Cloud environment network policy and credentials are separate prerequisites. No instruction to copy local auth/settings/secrets to the clone. Docs build fetches GitHub stats; report missing network as environment evidence, not a runtime regression or a reason to disable checks.

**Verify:** manually reconcile every guide command with package manifests/configs and CI ordering. `rg -n 'CONTRIBUTING.md' README.md CLAUDE.md` → link appears in each; `rg -n 'pnpm|trunk|playwright|14.0.0' CONTRIBUTING.md` → setup and verification sections present. Scoped `trunk check CONTRIBUTING.md CLAUDE.md README.md` → no new findings. Review diff to confirm the existing instruction sections and public consumer install remain intact.

### Step 2: Commit narrow shared Claude fetch defaults with documented boundaries

Create `.claude/settings.json` with exactly:

```json
{
    "permissions": {
        "allow": [
            "WebFetch(domain:codesandbox.io)",
            "WebFetch(domain:*.codesandbox.io)",
            "WebFetch(domain:*.csb.app)",
            "WebFetch(domain:raw.githubusercontent.com)"
        ]
    }
}
```

These let agents fetch common bug-reproduction/code sources. Do not add Shell/Bash/Write/tool-global rules, hooks, env, plugins, MCP servers, authentication, or defaultMode. Apex CodeSandbox and its wildcard are separate because a leading `*.` wildcard excludes the apex. Keep all other domains at host/user defaults.

Add `/.claude/settings.local.json` to `.gitignore`; do not blanket-ignore shared settings or undo lock/worktree ignores. Do not read any existing personal file to produce the shared config.

In CONTRIBUTING.md explain:

- Committed shared settings travel with a fresh single-repository Claude cloud clone; local/user settings do not. Start at the repo root. Current multi-repository cloud sessions do not read each repo's permission rules, so this config is not a promise of approval-free fetching everywhere.
- Tool allow rules do not confer trust on fetched contents or authorize executing a reproduction. Organization/host/network policy still applies. Other agents do not consume Claude settings; the provider-neutral verification guide remains useful to them.
- No session-start hooks, remote-browser bridge or animation-runtime Claude integration is being added.
- Validate sources against current official docs: https://code.claude.com/docs/en/settings#settings-in-cloud-sessions and https://code.claude.com/docs/en/permissions#webfetch. If semantics differ at execution, update only the descriptive explanation after reconciling the four-rule intent; do not broaden permissions to compensate.

**Verify:** `node -e "const fs=require('node:fs'); const s=JSON.parse(fs.readFileSync('.claude/settings.json','utf8')); console.log(s.permissions.allow.length)"` → `4` and exit 0. `git check-ignore --no-index .claude/settings.local.json` → prints that path and exit 0. `git check-ignore --no-index .claude/settings.json` → no output, exit 1 (shared file is not ignored). Scoped `trunk check .claude/settings.json .gitignore CONTRIBUTING.md` → no new findings.

### Step 3: Protect the shared configuration contract

Create `src/testing/claudeProjectSettings.spec.ts`, patterned after the existing Node/JSON dependency-contract tests. Resolve repository root relative to `import.meta.url`, not process.cwd(). Read only the shared committed file, never user/local settings. Assert valid JSON; exactly four expected WebFetch allow entries with no duplicates; only `permissions` top-level key; only `allow` inside permissions; no broader tool/domain wildcards, defaultMode, hooks or env. Keep expectations explicit as the reviewed permission boundary, not a snapshot of incidental indentation/order. Use one failure message identifying the unauthorized field/rule rather than dumping arbitrary file contents.

**Verify:** `pnpm exec vitest run src/testing/claudeProjectSettings.spec.ts` → all new tests pass. `pnpm check` → zero errors. Scoped Trunk format/check → no new findings.

### Step 4: Review setup against the integrated candidate and record evidence

Confirm Plan 001 is reviewed before marking its browser fallback as available in published contributor guidance. Run settings tests, root typecheck, scoped Trunk and diff checks. Run the full root unit suite once for the newly included contract tests. Reuse recorded Plan 001 package/docs/browser checks for unchanged runtime/config files rather than rerunning them solely for documentation. On a fresh disposable environment, execute setup and the guide's command sequence if available; record which commands actually ran and which environment prerequisites prevented execution. Never claim a cloud test was run from a local mock or from a browser executable-selection unit test.

**Verify:** focused settings tests and `pnpm test` green; `pnpm check` zero errors; scoped Trunk/diff checks clean; `git diff --name-only` contains only scope paths. `git diff -- package.json docs/package.json pnpm-lock.yaml` is empty. Record versions, checks performed, predecessor evidence reused and environment limits; update README status. No install or deploy on the user's main/shared checkout under advisory execution.

## Test plan

No red runtime test is required: this plan creates contributor docs and new static tool configuration, neither changing animation behavior nor replacing existing shared settings. The permission contract tests guard an intentional configuration boundary; they must fail on added broader rules or forbidden fields, not on formatting. A JSON parser/ignore check validates the setup independent of Claude availability. Human review checks exact command ordering against current manifests and existing CI. A real single-repository cloud fetch smoke is optional additional evidence, not a unit-test substitute or a prerequisite for useful documentation.

## Done criteria

- [ ] CONTRIBUTING.md contains versioned setup, standard browser install, fallback precedence/limits, exact verification commands/order, Trunk authority and cloud settings boundaries.
- [ ] README and CLAUDE link to guide without losing existing consumer/instruction content.
- [ ] Shared JSON parses and its contract tests pass with exactly four scoped fetch rules.
- [ ] Shared settings not ignored; local settings explicitly ignored; no personal secrets/config copied.
- [ ] Settings tests, full root units, root check, scoped Trunk and diff integrity pass.
- [ ] Browser fallback documentation refers to reviewed Plan 001 behavior; cloud/platform verification limits are stated.
- [ ] No dependency/runtime/out-of-scope edits; index status/evidence updated.

## STOP conditions

- Existing shared Claude settings appear after baseline; reconcile without overwriting operator configuration.
- Completing setup requires credentials, copying a personal settings file, broad Bash permissions, disabling Trunk, removing lint, or upgrading packages.
- Plan 001 is not completed/reviewed, yet documentation would describe fallback as shipped. Keep this plan TODO until dependency resolved or request an explicit reduced docs scope.
- Current official Claude docs contradict the proposed rule syntax or described single-repository behavior; report and reconcile before creating config.
- Two verification failures after reasonable in-scope corrections, or need to edit out-of-scope source/CI/hook files.

## Maintenance notes

Claude settings semantics and Playwright browser requirements can change independently of Motion. Recheck this guide on Node/pnpm/Playwright changes and when new verification commands enter CI. Do not drift the four-rule fetch set without intentional review; tests make that change explicit. Changing shared settings affects contributors only after their host applies project trust/policy. Docs don't replace actual CI evidence. Keep Motion14.0.1 delayed-start/SVG runtime parity deferred to a separate initiative.
