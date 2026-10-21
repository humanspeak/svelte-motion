# Plan 001: Run svelte-motion on Motion 14.5.0, with `arc()` moved to the new `animateValues` hook

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, update this plan's status row in `.agents/.plans/motion-14-5-0/README.md`,
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- package.json pnpm-lock.yaml src/lib/utils/arc.ts src/lib/utils/arc.spec.ts src/lib/index.spec.ts src/lib/html/_MotionContainer.svelte src/routes/+page.svelte src/routes/tests/arc src/routes/tests/motion docs/src/routes/docs/arc .changeset e2e/motion`
> Expected: no output except the batch's own `.agents/.plans/motion-14-5-0/` commit (not in that path list).
> If any listed file changed, compare the "Current state" excerpts below with the live code; on a mismatch, STOP.

## Status

- **Priority**: P1 (every other plan in this batch depends on it)
- **Effort**: M
- **Risk**: MED. The dependency bump changes runtime behavior in several places (listed below), and the `arc()`
  wrapper breaks at compile time without Step 4.
- **Depends on**: 000
- **Category**: migration
- **Planned at**: commit `f2b5d766` (`origin/main`, v2.1.1, Motion 14.2.0), 2026-10-21

## Why this matters

svelte-motion mirrors upstream Motion and pins `motion` + `motion-dom` to one exact version (spec-enforced).
Upstream shipped 14.3.0, 14.3.1, 14.4.0 and 14.5.0 between 2026-10-15 and 2026-10-20. Most of that range lives
in `motion-dom`/`motion` and arrives with the pin bump, because svelte-motion runs motion-dom's real
`HTMLVisualElement`, `animationState`, `HTMLProjectionNode`, `hover`/`press`, `animate`, `stagger` and transform
builders. One change does NOT arrive cleanly: upstream rewrote the `MotionPath` interface used by
`transition.path`, and svelte-motion's `arc()` wrapper (which adds a numeric-endpoint guard) silently stops
guarding and fails to type-check. This plan bumps the pins, fixes the wrapper, adds coverage for two behaviors
the bump newly fixes, triages the full e2e suite, and writes the release note.

The maintainer chose (2026-10-21) to release this as **svelte-motion 2.5.0**, mirroring Motion 14.5.

## Current state

- `package.json:3` is `"version": "2.1.1"`; `package.json:148-149` are the exact pins (no caret, enforced by
  `src/lib/__tests__/motionDependencies.spec.ts`):
  ```json
          "motion": "14.2.0",
          "motion-dom": "14.2.0"
  ```
- Releases: `.github/workflows/npm-publish.yml` bumps the version from the merged PR's labels: `patch` by default,
  `minor`/`major` labels bump more, `skip-publish` skips. Changeset files under `.changeset/` are kept as
  release-note records. To land on 2.5.0, set `"version"` to `"2.4.0"` here; the PR will need the `minor` label.
  **Never add that label yourself**: the maintainer adds it at PR time.
- `pnpm-workspace.yaml` has `minimumReleaseAge: 2880` but excludes `motion`, `motion-dom`, `motion-utils` and
  `framer-motion`, so same-day upstream versions install.
- `src/lib/utils/arc.ts:71-105`, the wrapper (the module header comment at lines 1-21 explains why it exists):
  ```ts
  export const arc = (options: ArcOptions = {}): MotionPath => {
      const path = upstreamArc(options)
      let warned = false

      return {
          ...path,
          animateVisualElement(visualElement, target, transition, delay, animations) {
              if (!('x' in target || 'y' in target)) return

              const endpointsNumeric = AXES.every((key) => {
                  const raw = (target as Record<string, unknown>)[key]
                  // No default: `getValue(key, default)` would create the value.
                  // Mirror upstream's read order (MotionValue, then latestValues).
                  const current: unknown =
                      visualElement.getValue(key)?.get() ?? visualElement.latestValues[key]
                  return isNumericKeyframe(raw) && isFiniteOrAbsent(current)
              })

              if (!endpointsNumeric) {
                  if (DEV && !warned) {
                      warned = true
                      console.warn(
                          '[svelte-motion] arc() requires numeric x/y endpoints; ' + ...
                      )
                  }
                  return
              }

              path.animateVisualElement(visualElement, target, transition, delay, animations)
          }
      }
  }
  ```
- `src/lib/utils/arc.spec.ts` drives the wrapper through `arc().animateVisualElement(fakeVisualElement, …)`
  (lines 20-28, 85-86, and the "latestValues" case at 75-83).
- `src/lib/index.spec.ts:166-171` asserts `typeof path.animateVisualElement === 'function'`.

### Upstream facts (verified in `~/Github/motion` at tag `v14.5.0`; cite these in code comments)

- `packages/motion-dom/src/animation/types.ts:684-705`: `MotionPath` gains
  `animateValues?(getValue: (key: string) => MotionValue | undefined, target, transition, delay, animations): void`.
  `animateVisualElement` becomes optional and `@deprecated` ("Only called for VisualElements, and only when
  `animateValues` isn't implemented").
- `packages/motion-dom/src/animation/utils/arc.ts:228-262`: upstream `arc()` now returns only
  `interpolateProjection` and `animateValues`. It no longer has `animateVisualElement`. It still casts
  `target.x`/`target.y` to `number` with no unit guard (lines 249-260).
- `packages/motion-dom/src/animation/interfaces/visual-element-target.ts:60-81`: VisualElement animations call
  `path.animateValues(key => visualElement.getValue(key, visualElement.latestValues[key] ?? 0), target, …)`
  when present, otherwise `path.animateVisualElement?.(…)`.
- `packages/motion-dom/src/animation/animate/effects.ts` `animateValues` (around lines 63-80): element animations
  (`animate(el, …)`, `useAnimate`) now honor `transition.path` too, by calling `path.animateValues` on a copy of
  the keyframes. Upstream commit `ae0e8e7e0`, e2e `72a1ee2ec` (`dev/react/src/tests/transition-arc.tsx`, variant
  `use-animate`; Cypress `transition-arc.ts` "deflects y perpendicular when driven by useAnimate()").
- **Consequence for the wrapper**: `{ ...path }` copies upstream's `animateValues`, and motion-dom prefers that
  hook, so the wrapper's guard never runs. `path.animateVisualElement(...)` at line 103 calls an optional method
  that no longer exists, which fails `svelte-check` (TS2722) and would throw at runtime.
- `packages/framer-motion/src/motion/__tests__/dynamic-layout.test.tsx` (#2567, commit `550d03223`): a `layout`
  prop turned on after mount now registers the projection's layout listener (`create-projection-node.ts`
  `addLayoutListener()`, called from `mount()` and `setOptions()`). svelte-motion forwards `layout` changes to
  `projection.setOptions` (`src/lib/utils/motionDomProjection.ts:401-408`, called from
  `src/lib/html/_MotionContainer.svelte:2100-2109`), so this fix should arrive with the pin. No svelte-motion
  page mounts with `layout={false}` and turns it on later.
- Other things that arrive with the pin and need no code here (for the changeset): keyboard `press` no longer
  leaks listeners on every focus/Enter (14.5.0); `stagger` gains `grid` and `from: "edges" | "random"`
  (14.3.0); `scaleZ` support (14.3.0); `matrix3d(...)` strings animate correctly (14.3.0); axis `rotate`/`skew`
  interpolate during shared layout animations (14.3.1); empty shared-layout stacks are freed (14.3.1);
  accelerated transform round trips no longer vanish from a float residue, and `stop()` no longer overwrites the
  caller's transform (14.3.1). The `useSpring` catch-up fix (14.3.0) does not apply: svelte-motion attaches its
  follow synchronously.

### Conventions

- Test pages live in `src/routes/tests/<area>/<page>/+page.svelte` and import from `$lib`. Model the new pages
  on `src/routes/tests/arc/keyframes/+page.svelte` (arc) and `src/routes/tests/motion/layout-align-toggle/+page.svelte`
  (layout). Specs live in `e2e/<area>/<name>.spec.ts` and load `/tests/<area>/<page>?@isPlaywright=true`.
  Model sampling on `e2e/motion/arc-keyframes.spec.ts` and `e2e/motion/layout-align-toggle.spec.ts`.
- Every test page is linked from `src/routes/+page.svelte` (see the "animateLayout (vanilla layout)" block around
  line 386 for the markup pattern).
- Unit tests run in jsdom (`vitest.config.ts`). jsdom has no WAAPI, so acceleration never engages there.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` (if global pnpm refuses the pinned version: `npx -y pnpm@12.6.0 install`) | exit 0 |
| Typecheck | `pnpm check` | 0 errors (record the warning count before and after) |
| Unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Lint/format | `trunk fmt <files>` then `trunk check <files>`; never `pnpm lint`/prettier directly | no new issues |
| Package | `pnpm build` (vite build + svelte-package + publint) | exit 0 |
| One e2e spec | `pnpm exec playwright test <path>` | all pass |
| Full e2e | `pnpm test:e2e` | see Step 7 |

**Port 4198 rule**: Playwright builds and previews on port 4198. Before any Playwright run, check
`lsof -ti :4198 -sTCP:LISTEN`. If anything is listening, it is probably the maintainer's dev server or sign-off
browser: **STOP and ask**. Never kill it. From a separate worktree, do NOT set `PW_REUSE_SERVER` (it would test
the main checkout's server).

## Scope

**In scope**:

- `package.json` (the two pins; `"version"` → `"2.4.0"`)
- `pnpm-lock.yaml` (regenerated by install)
- `src/lib/utils/arc.ts`, `src/lib/utils/arc.spec.ts`, `src/lib/index.spec.ts` (the arc assertion only)
- `src/routes/tests/arc/use-animate/+page.svelte` (create)
- `e2e/motion/arc-use-animate.spec.ts` (create)
- `src/routes/tests/motion/layout-enabled-after-mount/+page.svelte` (create)
- `e2e/motion/layout-enabled-after-mount.spec.ts` (create)
- `src/routes/+page.svelte` (link the two pages)
- `docs/src/routes/docs/arc/+page.svx` (one sentence in "Numeric x/y only")
- `src/lib/html/_MotionContainer.svelte`: **comments only**, the two stale comments named in Step 8
- `.changeset/motion-14-5-0.md` (create)
- e2e spec files **only after the maintainer approves each change in Step 7**

**Out of scope**:

- `src/lib/utils/drag.ts`, `pan.ts`, `components/Reorder/**`: plans 003 and 006.
- `src/lib/components/PresenceChild.svelte`, `src/lib/utils/presence.ts`, `src/lib/utils/layoutId.ts`: plans 002, 004 and 005.
- `src/lib/index.ts`: new exports (`scopeMotion`, `drag`) are plans 007 and 008.
- `src/lib/utils/motionDomProjection.ts`: see Maintenance notes; do not change it here.
- PR labels: never add `minor`/`major`.

## Git workflow

- Branch `feat/motion-14.5.0` from `origin/main` (`git fetch origin && git worktree add ../svelte-motion-1450 -b feat/motion-14.5.0 origin/main`),
  unless the dispatcher already created it. All plans in this batch run serially on that branch, because
  Playwright's port is fixed.
- Conventional commits matching `git log`, for example `chore(deps): bump motion and motion-dom to 14.5.0`,
  `fix(arc): guard upstream's animateValues hook`, `test(arc): cover arc() driven by useAnimate()`.
  End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR. The maintainer drives the live demo first.

## Steps

### Step 1: Confirm the upstream release exists

**Verify**: `npm view motion@14.5.0 version && npm view motion-dom@14.5.0 version` → prints `14.5.0` twice.

### Step 2: Red tests on the current pins (14.2.0)

These capture two behaviors that 14.5.0 fixes. Write them BEFORE bumping and confirm they fail.

1. **`arc()` via `useAnimate()`**. Create `src/routes/tests/arc/use-animate/+page.svelte`, a Svelte port of
   upstream's `UseAnimateArc` (`git -C ~/Github/motion show v14.5.0:dev/react/src/tests/transition-arc.tsx`, the
   `UseAnimateArc` component). Use `const [scope, animate] = useAnimate()` and `const path = arc({ strength: 1 })`
   from `$lib`, created once in `<script>`. Render a plain `<div data-testid="indicator" {@attach scope}>` (not a
   motion element), absolutely positioned at `top: 200px; left: 50px; 100×100`, inside a
   `position: relative; width: 100vw; height: 100vh` container, plus a `<button data-testid="toggle">`. The click
   calls `animate(scope.current!, { x: 400, y: 0 }, freeze ? { duration: 4, ease: () => 0.5, path } : { duration: 1.2, path })`,
   where `freeze = new URLSearchParams(location.search).has('freeze')` (read in `onMount`).
   Add a header comment citing the upstream file and commit `72a1ee2ec`.
2. Create `e2e/motion/arc-use-animate.spec.ts`: go to `/tests/arc/use-animate?@isPlaywright=true&freeze`, click
   `toggle`, wait 100 ms, read `getBoundingClientRect()` of `indicator`, and assert `left` within 25 px of
   `50 + 200` and `Math.abs(top - 200) > 150`. These are upstream's thresholds.
3. **`layout` enabled after mount**. Create `src/routes/tests/motion/layout-enabled-after-mount/+page.svelte`,
   modeled on `layout-align-toggle`. It has `let layoutOn = $state(false)` and `let wide = $state(false)`, a
   button `data-testid="enable-layout"` that sets `layoutOn = true`, a button `data-testid="toggle-width"` that
   flips `wide`, and a `<motion.div data-testid="box" layout={layoutOn} transition={{ duration: 0.6, ease: 'linear' }}>`
   whose width is `wide ? 300 : 100` px via `styleString`. Header comment: a port of upstream #2567
   (`dynamic-layout.test.tsx`, commit `550d03223`).
4. Create `e2e/motion/layout-enabled-after-mount.spec.ts`: load the page, wait for the box to be visible and
   800 ms to settle, click `enable-layout`, wait 100 ms, then sample `box.getBoundingClientRect().width` every
   rAF for 900 ms while clicking `toggle-width`. Same pattern as `layout-align-toggle.spec.ts`. Assert at least
   4 distinct intermediate widths (strictly between 100 and 300 with a 2 px margin). Add a second test that never
   clicks `enable-layout` and asserts the width snaps (no more than 1 intermediate sample), so the page proves
   the prop matters.
5. Link both pages in `src/routes/+page.svelte`, inside the existing arc section (or a new "Motion 14.5" section,
   following the "animateLayout (vanilla layout)" markup).

**Verify** (on 14.2.0, port rule applies):
- `pnpm exec playwright test e2e/motion/arc-use-animate.spec.ts` → **FAILS**: the deflection assertion fails
  (`top` stays ≈ 200, because 14.2.0's element `animate()` ignores `transition.path`).
- `pnpm exec playwright test e2e/motion/layout-enabled-after-mount.spec.ts` → the "enabled after mount" test is
  expected to **FAIL** (0–1 intermediate widths) and the "never enabled" test to pass.
  If the "enabled after mount" test PASSES on 14.2.0, svelte-motion already handled it some other way. Record
  that in your report and continue; it is not a STOP. Keep the test as a regression guard.

Commit the pages and specs (`test: cover arc via useAnimate and layout enabled after mount`).

### Step 3: Bump the pins and the version

Edit `package.json`: `"motion": "14.5.0"`, `"motion-dom": "14.5.0"` (exact, no caret; pnpm 12 ignores
`--save-exact`, so edit the file directly) and `"version": "2.4.0"`. Run `pnpm install`.

**Verify**:
- `pnpm why motion-dom | grep -oE "motion-dom@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly `motion-dom@14.5.0`
- `pnpm why motion-utils | grep -oE "motion-utils@[0-9]+\.[0-9]+\.[0-9]+" | sort -u` → exactly `motion-utils@14.5.0`
- `pnpm exec vitest run src/lib/__tests__/motionDependencies.spec.ts` → pass
- `pnpm check` → **expect at least one error** in `src/lib/utils/arc.ts` (calling the possibly-undefined
  `path.animateVisualElement`). Any error in another file: STOP and report it.

### Step 4: Move the `arc()` guard onto `animateValues` (red unit test first)

1. In `src/lib/utils/arc.spec.ts`, change the harness to the new hook. Replace `fakeVisualElement` with a
   `getValue` stub built from a `Map<string, MotionValue>` (`motionValue` from `motion-dom`), and make `run(...)`
   call `arc().animateValues!(getValue, target, { duration: 0.1 }, 0, animations)`. Convert every case. The
   "reachable only via latestValues" case becomes "guards a px string current value from getValue": motion-dom's
   VisualElement `getValue` callback already falls back to `latestValues` (`visual-element-target.ts:64-70`), so
   the wrapper only needs `getValue`. Keep the `interpolateProjection` case unchanged. Add one case: the returned
   path has no `animateVisualElement` property (`expect('animateVisualElement' in arc()).toBe(false)`).
2. In `src/lib/index.spec.ts`, change the arc assertion to `typeof path.animateValues === 'function'`.

   **Verify**: `pnpm exec vitest run src/lib/utils/arc.spec.ts` → the guard cases FAIL (the wrapper has no
   `animateValues` of its own, so upstream's runs: non-numeric targets get claimed and no warning fires).
3. Rewrite the wrapper in `src/lib/utils/arc.ts`:
   ```ts
   export const arc = (options: ArcOptions = {}): MotionPath => {
       const path = upstreamArc(options)
       // Motion 14.3.1+ (`animation/utils/arc.ts`): upstream implements only
       // `animateValues`, which motion-dom calls for VisualElements AND for
       // elements animated with `animate()` / `useAnimate()`.
       const animateValues = path.animateValues!
       let warned = false

       return {
           ...path,
           animateValues(getValue, target, transition, delay, animations) {
               if (!('x' in target || 'y' in target)) return
               const endpointsNumeric = AXES.every(
                   (key) => isNumericKeyframe(target[key]) && isFiniteOrAbsent(getValue(key)?.get())
               )
               if (!endpointsNumeric) {
                   /* unchanged DEV warn-once block */
                   return
               }
               animateValues(getValue, target, transition, delay, animations)
           }
       }
   }
   ```
   Update the module header (lines 1-21) and the JSDoc so they describe `animateValues` and say the guard now
   also covers `animate()`/`useAnimate()`. If `path.animateValues` is `undefined` at runtime (it should not be at
   14.5.0), STOP.
4. In `docs/src/routes/docs/arc/+page.svx`, section "Numeric x/y only", add one sentence: the same guard applies
   when the path is used with `animate()` or `useAnimate()`.

**Verify**: `pnpm exec vitest run src/lib/utils/arc.spec.ts src/lib/index.spec.ts` → all pass;
`pnpm check` → 0 errors.

### Step 5: Static and unit gates

**Verify**: `pnpm test:only` → all pass. `trunk check` → no new issues. If a unit test outside arc fails, STOP
and report the test name and assertion: jsdom never accelerates, so a failure points at another upstream change
(for example stagger distance caching, `scaleZ` in a transform string, or follow/spring timing).

### Step 6: Green on the new pins

**Verify** (port rule applies):
- `pnpm exec playwright test e2e/motion/arc-use-animate.spec.ts` → passes
- `pnpm exec playwright test e2e/motion/layout-enabled-after-mount.spec.ts` → both tests pass
- `pnpm exec playwright test e2e/motion/arc-keyframes.spec.ts e2e/layout/arc-layout.spec.ts e2e/independent-transforms` → all pass

### Step 7: Full e2e triage (STOP-and-review gate)

Run `pnpm test:e2e` and save the list of failing specs.

- Fully green: continue to Step 8.
- Any failure: **do not edit tests or library code.** For each failure, record the spec, the test name and the
  assertion. Re-run the same spec on `origin/main` in a scratch worktree (never stash) to separate new failures
  from pre-existing ones. Then STOP and hand the table to the maintainer. The repo's CLAUDE.md requires failed
  e2e runs to be reviewed one at a time with the maintainer ("is the behavior wrong, or is the test stale?").
  Specs most likely to move: `e2e/armed-buttons` (keyboard press now cancels on blur only while a key is down),
  `e2e/layout`, `e2e/layout-id` (shared-layout stack release, lazily added layout listener order),
  `e2e/independent-transforms` (synchronous commit on `stop()`).

**Verify**: a written failure table (or "0 failures") in your report.

### Step 8: Fix two stale comments (comments only)

Both comments credit `NativeAnimationExtended`. Since 14.2.0, accelerated independent transforms run through
motion-dom's `TransformAnimation`, and from 14.3.1 its `stop()` syncs the motion value and commits the inline
transform synchronously (`animation/waapi/transforms/TransformAnimation.ts` `release()`/`end()`). The behavior the
comments rely on (an interrupted channel freezes where it is) still holds.

- `src/lib/html/_MotionContainer.svelte` around lines 1416-1432 (the "Prefer each MotionValue's own current
  value over `latestValues`" block)
- the same file around lines 3211-3220 (the `stop:` controls subscriber comment)

Reword each so it names both paths: `NativeAnimationExtended` for opacity-style accelerated values, and
`TransformAnimation` for grouped independent transforms. Change no code.

**Verify**: `git diff -U0 src/lib/html/_MotionContainer.svelte | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*//'` → no output (comment lines only).

### Step 9: Changeset

Create `.changeset/motion-14-5-0.md` in the style of `.changeset/motion-14-2-0.md`, with bump type `minor`. List
what users get: Motion/motion-dom 14.5.0; `arc()` paths now work with `animate()` and `useAnimate()` on plain
elements (and keep the numeric guard); `layout` turned on after mount animates; keyboard `press` no longer leaks
listeners; `stagger` `grid` and `from: 'edges' | 'random'`; `scaleZ`; `matrix3d` strings; axis `rotate`/`skew`
in shared layout animations; unmounted `layoutId` elements are freed by the projection; accelerated transform
fixes (float-residue round trips, `stop()`). Do not mention `scopeMotion` or `drag()` (plans 007/008 add their own
changesets).

**Verify**: `trunk check .changeset/motion-14-5-0.md` → clean.

### Step 10: Final gate

**Verify**: `pnpm build` (exit 0), `pnpm check` (0 errors), `pnpm test:only` (all pass),
`pnpm exec playwright test e2e/motion/arc-use-animate.spec.ts e2e/motion/layout-enabled-after-mount.spec.ts` (all pass),
`git status` shows only in-scope files.

## Test plan

- Red-first anchors (Step 2): `e2e/motion/arc-use-animate.spec.ts` fails on 14.2.0 (no deflection), and
  `e2e/motion/layout-enabled-after-mount.spec.ts` "enabled after mount" is expected to fail on 14.2.0 (snap). Both
  pass after the bump.
- Red-first for the wrapper (Step 4): the rewritten `arc.spec.ts` guard cases fail before the wrapper rewrite.
- Existing guards: `src/lib/__tests__/motionDependencies.spec.ts` (pins), `e2e/motion/arc-keyframes.spec.ts`,
  `e2e/layout/arc-layout.spec.ts`.
- The full e2e run (Step 7) catches other behavior shifts. The maintainer triages them.

## Done criteria

- [ ] `package.json` pins `motion` and `motion-dom` to exactly `14.5.0`; `"version"` is `"2.4.0"`
- [ ] `grep -n "animateVisualElement" src/lib/utils/arc.ts` → only comment mentions, no call
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` clean
- [ ] Both new e2e specs exist, failed (or were recorded as passing) on 14.2.0, and pass on 14.5.0
- [ ] Full e2e result reported (green, or a failure table handed to the maintainer)
- [ ] `.changeset/motion-14-5-0.md` exists; both test pages are linked from `src/routes/+page.svelte`
- [ ] README status row updated

## STOP conditions

- Port 4198 is occupied before a Playwright run.
- `pnpm why` shows more than one motion-dom or motion-utils version.
- After the bump, `pnpm check` reports errors outside `src/lib/utils/arc.ts`.
- `upstreamArc(...).animateValues` is undefined at 14.5.0.
- A unit test outside arc fails after the bump.
- Any full-suite e2e failure: report it, do not fix it.
- A fix seems to need any out-of-scope file.

## Maintenance notes

- Every future Motion bump moves both pins together (spec-enforced). Also check `MotionPath` in
  `motion-dom/src/animation/types.ts` on each bump: if upstream ever adds a unit-aware `arc()`, delete the
  wrapper and re-export upstream's `arc` (the module header already says so).
- **Watch item (no change made here)**: from 14.3.1, stopping the last accelerated transform on an element commits
  its inline `transform` synchronously (`TransformAnimation.end()`). `commitDraggedLayoutChange` in
  `src/lib/utils/motionDomProjection.ts` (around lines 1001-1027) keeps a "strip to base transforms" open across
  microtasks and then restores the pre-strip inline transform (`stripToBaseTransforms`, around lines 1464-1506).
  If an accelerated animation on that element is stopped inside that window, the restore can overwrite the
  freshly committed transform until the next render. It is unlikely in practice (it needs a drag-driven layout
  commit and a stop in the same microtask window). If a stale-transform bug report comes in, make `restore()`
  skip elements whose inline transform changed since the strip.
- New upstream exports that are deliberately not re-exported here: `scopeMotion` (plan 007), `drag` (plan 008),
  `VisualElementDragControls`/`PanSession` (plan 006 spike). Re-exporting `StaggerOptions`/`StaggerOrigin`
  types is optional polish for whoever touches `src/lib/index.ts` next.
