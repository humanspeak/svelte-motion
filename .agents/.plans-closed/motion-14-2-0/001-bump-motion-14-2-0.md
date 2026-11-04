# Plan 001: Run svelte-motion on Motion 14.2.0, with hardware-accelerated independent transforms covered by tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update this plan's status row in
> `.agents/.plans/motion-14-2-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Revision 2026-10-13 (guard pre-flight, maintainer decision)**: npm already has `2.0.1`, which shipped the
> Motion 14.1.0 work as a patch because the manual release run failed. The maintainer wants the 2.x minor line
> to mirror Motion again: set `package.json` `"version"` to **`2.1.0`** (the 14.1 line), and keep the
> `minor` changeset so the release becomes **2.2.0** (Motion 14.2). This replaces every "do not change
> `"version"`" instruction below. Still never add PR labels. The branch `feat/motion-14.2.0` already exists
> (off `origin/main` `962a56df`) and is checked out in `/Users/jasonkummerl/Github/svelte-motion-1420`; work
> there and skip the `git switch -c` in "Git workflow". The drift-check baseline is now `origin/main` (`962a56df`): expect no differences at all, so the
> `"version"` note under it no longer applies.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Drift check (run first)**: `git diff --stat origin/main..HEAD -- package.json pnpm-lock.yaml src/lib/__tests__/motionDependencies.spec.ts src/routes/+page.svelte src/routes/tests/independent-transforms e2e/independent-transforms docs/src/routes/docs/transform-template .changeset`
> The only expected difference is `package.json` `"version"` (`2.0.0` on the
> planning branch, `2.0.1` on `origin/main`). Any other change: compare the
> "Current state" excerpts below against live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED. The dependency bump changes how every `x`/`y`/`scale`/`rotate` animation renders in Chromium.
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `b9e59066` (branch base `origin/main` `962a56df`), 2026-10-13; re-stamped at the plan commit on `feat/motion-14.2.0`, 2026-10-13

## Why this matters

Upstream Motion shipped 14.1.1 and 14.2.0 on 2026-10-13. svelte-motion mirrors
upstream and is pinned to exactly `14.1.0`. Most of the change lives in
`motion-dom` / `motion-utils` and arrives with the pin bump. That includes the
headline 14.2.0 feature: independent transforms (`x`, `y`, `scale`, `rotate`
and so on) on an HTML element are composed into **one hardware-accelerated
WAAPI `transform` animation per element**, so they no longer tick on the main
thread.

This is a real behavior change for svelte-motion, because svelte-motion drives
its motion elements through motion-dom's `HTMLVisualElement`. While a transform
group is accelerated:

1. the element's **inline `style.transform` is NOT updated every frame**. The
   browser composites the animation, and inline style is only written when the
   group commits (finish/demote).
2. MotionValue `"change"` events for those values do **not** fire every frame.
   `value.get()` still returns the live sampled value (new `liveValue()` hook).

Any svelte-motion code or e2e assertion that reads inline `style.transform`
mid-animation will now see a stale value. This plan bumps the pins, ports
upstream's own parity test for the feature, and triages the full e2e suite.

## Current state

- `package.json:148-149`, the two exact pins (no caret, enforced by a spec):
  ```json
          "motion": "14.1.0",
          "motion-dom": "14.1.0"
  ```
- `src/lib/__tests__/motionDependencies.spec.ts` asserts both pins are the same
  exact version and that one motion-dom copy is shared with `motion → framer-motion`.
- `pnpm-workspace.yaml` has `minimumReleaseAge: 2880` but excludes
  `motion`, `motion-dom`, `motion-utils`, `framer-motion`, so same-day upstream
  versions install without a workaround.
- `.changeset/motion-14-1-0.md` is the exemplar changeset for a Motion bump:
  ```md
  ---
  '@humanspeak/svelte-motion': minor
  ---

  Update Motion and motion-dom to 14.1.0. Fixes that arrive with the update:

  - Animations no longer jump ahead when ...
  ```
- Unit tests (`pnpm test`) run in **jsdom** (`vitest.config.ts`). jsdom has no
  WAAPI, so acceleration never engages there. Only Playwright (Chromium)
  exercises the new path.
- Playwright: `playwright.config.ts` builds and previews on **port 4198**,
  `reuseExistingServer` only with `PW_REUSE_SERVER=1`. Specs live in `e2e/<area>/*.spec.ts`
  and load `/tests/<area>/<page>?@isPlaywright=true`.

### Upstream facts (verified in `~/Github/motion` at tag `v14.2.0`; cite these in comments)

- Upstream CHANGELOG `14.2.0`: "Hardware accelerated independent transforms like `x`, `y`, `scaleX` etc."
  `14.1.1`: velocity hand-off for accelerated springs; `cubicBezier` accuracy; Reorder click fix (plan 003);
  `useTransform` Strict Mode desync (React-only, see README "rejected").
- Eligibility, `packages/motion-dom/src/animation/waapi/transforms/TransformAnimation.ts`:
  `canGroupTransform` requires a transform key, `motionValue.owner.current instanceof HTMLElement`,
  WAAPI support and `linear()` easing support. `canAccelerateTransform` additionally requires
  no handoff, no `onUpdate` prop, no transition `onUpdate`, no `transformTemplate`,
  `type !== "inertia"`, no literal `transform` / `pathRotation`, and the projection not projecting.
- Demotion back to the main thread happens in `create-projection-node.ts` (`willUpdate()`,
  `resetTransform()`), in `VisualElement.ts` (value change on a transform key → `check()`,
  `transformTemplate`/`onUpdate` added → `demote()`), and in `effects/style/index.ts`.
- `transformGroups` is **not** exported from motion-dom's public index.
- Upstream parity page and spec to port: `dev/react/src/tests/independent-transforms.tsx`
  and `tests/react/independent-transforms.spec.ts` (view with
  `git -C ~/Github/motion show v14.2.0:<path>`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` (if global pnpm refuses the pinned version: `npx -y pnpm@12.6.0 install`) | exit 0 |
| Typecheck | `pnpm check` | 0 errors (existing warnings OK; record the count) |
| Unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm vitest run src/lib/__tests__/motionDependencies.spec.ts` | all pass |
| Lint | `trunk check` (format: `trunk fmt`). Do not use `pnpm lint`/prettier directly | no new issues |
| Package | `pnpm build` (runs `vite build`, `svelte-package` and `publint`) | exit 0 |
| e2e (one spec) | `pnpm playwright test e2e/independent-transforms` | all pass |
| e2e (full) | `pnpm test:e2e` | see Step 5 |

**Port 4198 rule**: before any Playwright run, check `lsof -ti :4198 -sTCP:LISTEN`.
If something is listening, the maintainer's dev server or browser is probably
on it: **STOP and ask**. Never kill it. Never run the bare `lsof -ti :4198 | xargs kill`.
If you run from a separate git worktree, do NOT set `PW_REUSE_SERVER` (it would test the main checkout's server).

## Scope

**In scope**:

- `package.json` (the two pins, and `"version"` → `2.1.0` per the revision note)
- `pnpm-lock.yaml` (regenerated by install)
- `.changeset/motion-14-2-0.md` (create)
- `src/routes/tests/independent-transforms/basic/+page.svelte` (create)
- `e2e/independent-transforms/basic.spec.ts` (create)
- `src/routes/+page.svelte` (add one link section)
- `docs/src/routes/docs/transform-template/+page.svx` (add one short section)
- e2e spec files **only after the maintainer approves each change in Step 5**

**Out of scope**:

- `src/lib/utils/motionDomProjection.ts`: the measurement fix is plan 002.
- `src/lib/components/Reorder/**`: plan 003.
- PR labels: never add `minor`/`major` labels.
- Anything that tries to disable acceleration globally to make tests pass.

## Git workflow

- Branch `feat/motion-14.2.0` from `origin/main` (`git fetch origin && git switch -c feat/motion-14.2.0 origin/main`).
- Conventional commits, matching `git log`: e.g. `chore(deps): bump motion and motion-dom to 14.2.0`,
  `test(transforms): port upstream independent-transforms parity page`.
  End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR. The maintainer signs off on the live demo first.

## Steps

### Step 1: Confirm the upstream release exists

**Verify**: `npm view motion@14.2.0 version && npm view motion-dom@14.2.0 version` → prints `14.2.0` twice.

### Step 2: Bump the pins

Edit `package.json`: `"motion": "14.2.0"` and `"motion-dom": "14.2.0"` (exact, no caret).
pnpm 12 ignores `--save-exact`, so edit the file directly. Then run `pnpm install`.

**Verify**:
- `pnpm why motion-dom | grep -oE "motion-dom@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly one line, `motion-dom@14.2.0`
- `pnpm why motion-utils | grep -oE "motion-utils@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly one line, `motion-utils@14.2.0`
- `pnpm vitest run src/lib/__tests__/motionDependencies.spec.ts` → pass

### Step 3: Static and unit gates

**Verify**: `pnpm check` → 0 errors. `pnpm test:only` → all pass. `trunk check` → no new issues.
If a unit test fails, STOP and report the test name and assertion (jsdom never accelerates, so a
unit failure points to a different upstream change, such as `cubicBezier` output or spring velocity).

### Step 4: Port upstream's independent-transforms parity page and spec

This is net-new coverage, so it should be green on the bumped code. Upstream wrote it to pin this behavior.

1. Create `src/routes/tests/independent-transforms/basic/+page.svelte`, a Svelte port of
   `dev/react/src/tests/independent-transforms.tsx` @ `v14.2.0`. Six boxes with the same ids:
   `accelerated` (`animate={{ x: 100, scale: 1.5 }}`, `whileHover={{ rotate: 45 }}`), `template`
   (`transformTemplate={(_, generated) => generated}`), `late-template` (transformTemplate added after
   300 ms via `$state` + `setTimeout`), `on-update` (`onUpdate={() => {}}`), `external`
   (`style={{ ...box, x: externalX }}` where `externalX = useMotionValue(0)` animated with `animate(externalX, 100, transition)`
   from `$lib`, plus `animate={{ scale: 1.5 }}`), and `layout` (`layout`, width 100 → 200 after 300 ms,
   `transition={{ x: transition, layout: { duration: 0.2 } }}`). `transition = { duration: 1, ease: 'linear' }`.
   Expose `window.countTransformAnimations` exactly as upstream does, inside `onMount`.
   Import `motion`, `useMotionValue`, `animate` from `$lib`, following the existing test pages
   (e.g. `src/routes/tests/transform-template/`). Add a JSDoc-style header comment that cites the upstream file.
   Add the guided human-review panel used by other visually reviewed pages (steps, expected result,
   live verdict), hidden when `@isPlaywright` is in the URL. Copy the panel pattern from
   `src/routes/tests/animate-layout/toggle/+page.svelte`.
2. Create `e2e/independent-transforms/basic.spec.ts`, a port of `tests/react/independent-transforms.spec.ts`
   @ `v14.2.0` (five tests, same thresholds). Navigate to `/tests/independent-transforms/basic?@isPlaywright=true`
   and keep `test.use({ viewport: { width: 500, height: 500 } })`.
3. Add a link section to `src/routes/+page.svelte` modeled on the "animateLayout (vanilla layout)"
   block (around line 386): heading "Independent transforms (Motion 14.2)", one link "Accelerated
   independent transforms (parity)".

**Verify**: `pnpm playwright test e2e/independent-transforms` → 5 passed.
If `animate runs as one accelerated animation` fails with count 0, acceleration is not engaging
under svelte-motion. STOP and report: it means the VisualElement owner, the `onUpdate` wiring
or `transformTemplate` handling in `src/lib/html/_MotionContainer.svelte` diverges from upstream.
Report which box failed; do not patch around it.

### Step 5: Full e2e triage (STOP-and-review gate)

Run `pnpm test:e2e`. Save the list of failing specs.

- If it is fully green, continue to Step 6.
- If anything fails, **do not edit tests or library code**. For each failure, record: spec and test
  name, the assertion, and whether the spec reads inline `el.style.transform` or a MotionValue
  `'change'` event mid-animation. Those are the expected 14.2.0 breakages: grep
  `grep -rlE "style\.transform" e2e` (17 files at plan time). Compare against `origin/main`
  by running the same spec there (in a scratch worktree, not with stash) to separate new failures from
  pre-existing ones. Then STOP and hand the list to the maintainer. The repo's CLAUDE.md requires failures to be
  reviewed one at a time with the maintainer ("is the behavior wrong, or is the test stale?").
  A test that reads inline transform mid-flight is usually stale; the usual fix is switching it to
  `getComputedStyle(el).transform`, which includes WAAPI output. But the maintainer decides per test.

**Verify**: a written failure table (or "0 failures") in your report.

### Step 6: Changeset and docs note

1. Create `.changeset/motion-14-2-0.md` in the 14.1.0 style. Use the `minor` bump type
   (with `"version"` at `2.1.0`, the release becomes 2.2.0). The summary covers: Motion/motion-dom 14.2.0; `x`/`y`/`scale`/`rotate`-style
   animations on motion elements now run as one hardware-accelerated animation per element in browsers with
   `linear()` easing support; they stay on the main thread with `onUpdate`, `transformTemplate`, layout
   animations, drag momentum, or a literal `transform`. Inline `style.transform` is no longer
   updated every frame while accelerated (read `getComputedStyle` instead). Also list the 14.1.1
   fixes users get: accelerated spring velocity hand-off, more accurate `cubicBezier`.
2. In `docs/src/routes/docs/transform-template/+page.svx`, add a short `## Hardware acceleration`
   section stating that a `transformTemplate` keeps the element's transforms on the main thread (link
   Motion's changelog entry). Keep it to 3–5 sentences, matching that page's tone.

**Verify**: `trunk check` → no new issues; `pnpm build` → exit 0.

### Step 7: Final gate

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (pass), `pnpm build` (exit 0),
`pnpm playwright test e2e/independent-transforms` (5 passed), `git status` shows only in-scope files.

## Test plan

- No red-first test: this is a dependency migration plus a net-new upstream feature. The
  observable regressions are captured by the full e2e run (Step 5) and the maintainer triage.
- New: `e2e/independent-transforms/basic.spec.ts` (5 tests), a straight port of upstream's spec.
- Existing guard: `src/lib/__tests__/motionDependencies.spec.ts` (pins).

## Done criteria

- [ ] `package.json` pins `motion` and `motion-dom` to `14.2.0` exactly; `"version"` is `2.1.0`
- [ ] `pnpm vitest run src/lib/__tests__/motionDependencies.spec.ts` passes
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` clean
- [ ] `pnpm playwright test e2e/independent-transforms` → 5 passed
- [ ] Full e2e result reported (green, or failure table handed to the maintainer)
- [ ] `.changeset/motion-14-2-0.md` exists; test page linked from `src/routes/+page.svelte`
- [ ] README status row updated

## STOP conditions

- Port 4198 is occupied before a Playwright run.
- `pnpm why` shows two motion-dom or motion-utils versions.
- Any unit test fails after the bump.
- The parity spec shows acceleration not engaging (count 0 on `#accelerated`).
- Any full-suite e2e failure: report it, do not fix it.
- A fix seems to need `motionDomProjection.ts` or Reorder files (those belong to plans 002 and 003).

## Maintenance notes

- Every future Motion bump moves both pins together (spec-enforced).
- Acceleration only engages in browsers with `linear()` easing (Chromium yes; Safari < 17.2 / Firefox < 112 no),
  so a CI matrix that adds WebKit/Firefox may behave differently on the same spec.
- If svelte-motion ever adds code that writes `el.style.transform` directly while motion values animate, it
  must first demote the element's transform group (see plan 002). Otherwise the WAAPI animation silently wins over inline style.
