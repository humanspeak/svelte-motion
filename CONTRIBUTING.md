# Contributing

This guide gets a fresh checkout (a laptop, a container, or a cloud agent session) to a verified state. It is provider-neutral: any human or agent can follow it. Claude-specific settings are covered in [Claude project settings](#claude-project-settings).

## Prerequisites

Work from the repository root.

| Tool    | Version                                    | Check             |
| ------- | ------------------------------------------ | ----------------- |
| Node.js | 24 (Volta pin `24.18.0` in `package.json`) | `node --version`  |
| pnpm    | 12.6.0                                     | `pnpm --version`  |
| Trunk   | 1.25.0 (CLI pin in `.trunk/trunk.yaml`)    | `trunk --version` |

Verify versions before installing. Do not install the latest tools globally or upgrade the lockfile as a way to repair setup; report a version mismatch instead.

Install Trunk with its [official instructions](https://docs.trunk.io/cli); the repository configures CLI `1.25.0` in `.trunk/trunk.yaml`. Trunk owns formatting and linting (Prettier, ESLint, markdownlint and others in `.trunk/trunk.yaml`); the package `lint` and `format` scripts are not the comprehensive check. The pre-commit hook skips formatting and lint when `trunk` is missing, so a successful commit alone does not prove they ran. Run `trunk --version` and report a missing executable rather than counting it as a pass.

## Setup

```bash
pnpm install --frozen-lockfile --config.engine-strict=false
pnpm exec playwright install --with-deps chromium firefox
```

The workspace installs the root package, `docs/`, and `tests/consumer-vite6`. Linux hosts may need system libraries that `--with-deps` installs with elevated privileges; if that is denied, report the missing prerequisite instead of weakening the checks.

### Browser fallback

Playwright's pinned Chromium wins whenever it is installed. If it is missing, the Playwright configs choose an external Chromium in this order (`scripts/chromium-launch-options.ts`):

1. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, an explicit path to a runnable regular file. An invalid value fails with a clear error; no other browser is substituted.
2. `$PLAYWRIGHT_BROWSERS_PATH/chromium`, a cloud-image convention for an actual executable. This is a path convention, not discovery of Playwright's cache layout.

All three browser consumers use this helper: the root e2e config (`playwright.config.ts`), the docs e2e config (`docs/playwright.config.ts`), and docs browser unit tests (`docs/vite.config.ts`). Firefox has no substitute. An external Chromium has no Playwright compatibility guarantee, so treat results from it as supplementary evidence, record its version, and do not report it as a supported-browser or pinned-CI result.

## Verification

Run commands in this order. Each step prepares what the next one needs.

### Focused development

| Purpose                 | Command                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| One root unit file      | `pnpm exec vitest run <path>`                                              |
| Format and lint changes | `trunk fmt <files>` then `trunk check <files>`                             |
| Docs client smoke       | `pnpm --dir docs exec vitest run --project=client --browser.headless`      |
| Root SSR/hydration      | `pnpm exec playwright test e2e/text/exact-text.spec.ts --project=chromium` |

### Full verification

| Step | Purpose               | Command                                                        |
| ---- | --------------------- | -------------------------------------------------------------- |
| 1    | Build the package     | `pnpm build`                                                   |
| 2    | Root types            | `pnpm check`                                                   |
| 3    | Package validation    | `pnpm package`                                                 |
| 4    | Root unit tests       | `pnpm test`                                                    |
| 5    | Vite 6 consumer       | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`  |
| 6    | Build docs            | `pnpm --dir docs build`                                        |
| 7    | Docs types            | `pnpm --dir docs check`                                        |
| 8    | Docs units            | `pnpm --dir docs exec vitest run --browser.headless`           |
| 9    | Docs browser projects | `pnpm exec playwright test --config docs/playwright.config.ts` |
| 10   | Root e2e              | `pnpm exec playwright test --project=chromium`                 |
| 11   | Format and lint       | `trunk fmt <files>` then `trunk check <files>`                 |
| 12   | Whitespace integrity  | `git diff --check`                                             |

Ordering matters. The root build emits the package that `docs/` and the consumer fixture import, and `pnpm check` runs after it for the same reason. The docs build generates inputs (GitHub stats, registry) that `pnpm --dir docs check` relies on, so an isolated docs typecheck on a fresh checkout is unreliable. CI (`.github/workflows/pr-build.yml`) follows the same order. Passing `--browser.headless` explicitly keeps docs browser unit tests off any display and independent of a `CI` variable.

### Test layout

- Root Vitest runs a `client` project in JSDOM and a `server` project in Node. Files under `src/testing` are tests and helpers, not public library exports.
- Docs Vitest has a browser `client` project (files matching `src/**/*.svelte.{test,spec}.{js,ts}`) and a Node `server` project. Vitest skips the docs mirror and full-reference generators; normal `dev` and `build` still produce them.
- Failure screenshots are artifacts only. They do not imply platform screenshot baselines.

### Failed e2e runs

When a full e2e run fails, review failures one page at a time with the maintainer, following the "Failed e2e review workflow" in [CLAUDE.md](CLAUDE.md). Do not bulk-update snapshots or loosen assertions.

## Environment limits

- Cloud network policy and credentials are separate prerequisites. Never copy local authentication, settings, or secrets into a clone.
- The docs build fetches GitHub statistics. If the network blocks it, report that as environment evidence, not as a runtime regression, and do not disable the check.
- Docs and CI do not replace each other: a local pass is not CI evidence. Record which commands actually ran and which prerequisites prevented others.
- Motion dependencies (`motion`, `motion-dom`) stay on their pinned 14.0.0 versions; do not change them as part of setup.

## Claude project settings

`.claude/settings.json` is committed and allows four `WebFetch` domains so agents can read common bug-reproduction sources:

- `codesandbox.io`
- `*.codesandbox.io`
- `*.csb.app`
- `raw.githubusercontent.com`

A leading `*.` matches subdomains at any depth but not the apex domain, which is why CodeSandbox has two rules. Wildcard `WebFetch` rules need Claude Code v2.1.172 or later.

Boundaries:

- A Claude cloud session with one repository reads the committed `.claude/settings.json` from the clone. A session with several repositories reads only `enabledPlugins` and `extraKnownMarketplaces` from each repository, not permission rules, so this file does not promise approval-free fetching everywhere. User settings and `.claude/settings.local.json` are never read in the cloud; the latter is git-ignored and stays personal.
- Allow rules skip the approval prompt for matching fetches, and a `domain:` rule may also widen the sandbox network allowlist. They do not make fetched content trustworthy or authorize executing a reproduction. Organization, host, and network policy still apply.
- Other agents do not read Claude settings; the rest of this guide applies to them unchanged.
- No session-start hooks, remote-browser bridge, MCP configuration, or Bash allow rules are shipped. This guide has not been exercised in a real Claude cloud session.

Sources: [settings in cloud sessions](https://code.claude.com/docs/en/settings#settings-in-cloud-sessions) and [WebFetch permission rules](https://code.claude.com/docs/en/permissions#webfetch). Recheck them when changing the rule set. A change to the four rules should be deliberate: `src/testing/claudeProjectSettings.spec.ts` fails on any addition.
