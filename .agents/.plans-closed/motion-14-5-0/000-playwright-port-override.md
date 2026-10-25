# Plan 000: Let Playwright's port be overridden per worktree (`PW_PORT`, default 4198)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result. If anything in "STOP conditions" occurs, stop and report. When done, update this plan's row in
> `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you and told you they maintain the index.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- playwright.config.ts CONTRIBUTING.md`
> Expect no output. On a difference, compare against "Current state", and on a mismatch, STOP.

## Status

- **Priority**: P1 (it unblocks running this batch in parallel)
- **Effort**: S
- **Risk**: LOW. The default stays 4198, so every existing workflow is unchanged.
- **Depends on**: none. It runs first, on `feat/motion-14.5.0`, before any lane worktree is created.
- **Category**: dx
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

`playwright.config.ts` hard-codes port 4198 in three places. That was deliberate: vite's default 4173 is shared by
sibling repos, whose e2e runs killed each other's servers. But it also means two worktrees of *this* repo can't run
e2e at the same time, and 4198 is where the maintainer keeps the sign-off browser. A `PW_PORT` override with the
same default keeps the cross-repo protection and lets each parallel lane use its own port (4201, 4202, …).

## Current state

`playwright.config.ts` on `origin/main`:

```ts
    webServer: {
        // Project-specific port: vite's default preview port (4173) is
        // shared by every repo on the machine, ...
        command: 'npm run build && npm run preview -- --port 4198',
        port: 4198,
        ...
        reuseExistingServer: !!process.env.PW_REUSE_SERVER,
        ...
    },
    use: {
        baseURL: 'http://localhost:4198',
```

The comment block under `reuseExistingServer` also mentions 4198 twice. `docs/playwright.config.ts` uses its own
port (5201) and is out of scope.

## Scope

**In scope**: `playwright.config.ts`, and `CONTRIBUTING.md` (one line in the Verification section).
**Out of scope**: `docs/playwright.config.ts`, any spec file, `package.json` scripts.

## Git workflow

On `feat/motion-14.5.0`. One commit: `test(e2e): allow PW_PORT to override the Playwright port`, ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Steps

### Step 1: Read the port from the environment

At the top of `playwright.config.ts`:

```ts
// Default 4198 keeps sibling repos (which share vite's 4173) from killing each
// other's servers. Parallel worktrees of this repo set PW_PORT to a free port.
const port = Number(process.env.PW_PORT) || 4198
```

Use `port` in `command` (`` `npm run build && npm run preview -- --port ${port} --strictPort` ``), in
`webServer.port`, and in `use.baseURL` (`` `http://localhost:${port}` ``). Update the `reuseExistingServer`
comment to say "the configured port (4198 by default)". `--strictPort` makes vite fail instead of silently
moving to another port, which would leave tests pointing at the wrong server.

**Verify**: `grep -n "4198" playwright.config.ts` → only the default in the `const port` line and in comments.

### Step 2: Document it

In `CONTRIBUTING.md`, under "Focused development", add one row: purpose "e2e in a parallel worktree", command
`PW_PORT=4201 pnpm exec playwright test <path>`.

### Step 3: Prove both ports work

Port rule: check `lsof -ti :4198 -sTCP:LISTEN` and `lsof -ti :4201 -sTCP:LISTEN` first. If 4201 is busy, pick
another free port above 4200. If 4198 is busy (the maintainer's browser), skip only the default-port run, say so,
and never kill anything.

**Verify**:
- `PW_PORT=4201 pnpm exec playwright test e2e/motion/keyframes.test.ts` → passes
- `pnpm exec playwright test e2e/motion/keyframes.test.ts` → passes (default 4198), unless skipped per the port rule
- `trunk check playwright.config.ts CONTRIBUTING.md` → clean

## Done criteria

- [ ] `PW_PORT` overrides all three uses; the default is 4198; `--strictPort` is set
- [ ] Both verify runs pass (or the default run is recorded as skipped because 4198 was occupied)
- [ ] Only the two in-scope files changed; README row updated

## STOP conditions

- Vite preview ignores `--strictPort` or the port flag.
- A spec hard-codes `localhost:4198` (`grep -rn "4198" e2e` returns matches). Report them; don't edit specs in this plan.

## Maintenance notes

CI never sets `PW_PORT`, so CI behavior is unchanged. Lane ports for this batch are assigned in the README.
