# Plan 001: Pin Motion 14.10.1, set the version to 2.10.0, and pin the free fixes with regression tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat f93a1d92..HEAD -- package.json pnpm-lock.yaml src/lib/html/motionDomSsr.spec.ts src/lib/index.ts src/lib/index.spec.ts src/lib/__tests__/motionExportAllowlist.ts src/lib/utils/gestures.spec.ts src/routes/tests/drag src/routes/+page.svelte e2e/drag`
> The only expected change is this batch folder (`.agents/.plans/motion-14-10-1/`). If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (a dependency bump can surface e2e regressions anywhere)
- **Depends on**: none
- **Wave**: 1
- **Category**: migration
- **Planned at**: commit `f93a1d92`, 2026-11-06

## Why this matters

`@humanspeak/svelte-motion` is a Svelte 5 port of Motion. It depends on the `motion` and `motion-dom` npm packages, both pinned to one exact version (currently 14.9.1). Upstream has released 14.10.0 and 14.10.1. Most of their fixes are in `motion-dom`/`motion`, and we get them just by moving the pin, because our code calls that code instead of copying it.

This plan does five things:
1. Moves the pin.
2. Sets the package version so the release lands on **2.10.1**. The publish workflow patch-bumps `2.10.0` to `2.10.1`, and the maintainer asked for exactly that.
3. Fixes the one unit-test mock that the bump breaks.
4. Adds regression tests that fail on 14.9.1 and pass on 14.10.1, so a later bump can't silently lose these fixes.
5. Re-exports the new press types so later plans (and users) can name them.

## Current state

- `package.json:3`: `"version": "2.9.1",`
- `package.json:152-153` holds the runtime pins. They are exact, with no caret, and `src/lib/__tests__/motionDependencies.spec.ts` enforces that they are equal:
  ```json
  "motion": "14.9.1",
  "motion-dom": "14.9.1"
  ```
- **Installed `node_modules` are stale.** `node_modules/motion-dom/package.json` reports `14.1.0`. Run `pnpm install` before you trust any baseline. Step 0 does this.
- **Upstream source** is a local clone at `~/Github/motion`, with tags `v14.9.1` and `v14.10.1`. Read files with `git -C ~/Github/motion show v14.10.1:<path>`.
- **The one known break.** `src/lib/html/motionDomSsr.spec.ts:4-13` builds a fake MotionValue that has `start` but no `run`:
  ```ts
  function createValue() {
      return {
          get: () => 0,
          set: () => undefined,
          isAnimating: () => false,
          start: () => undefined,
          stop: () => undefined,
          animation: undefined
      }
  }
  ```
  At v14.10.1, `packages/motion-dom/src/animation/interfaces/visual-element-target.ts:153` calls `value.run(` (upstream commit `2a0b47e1a`, "Make fewer objects for each animated value"). At v14.9.1 the same line called `value.start(`. The test at `:41` (`expect(() => animateTarget(...)).not.toThrow()`) is therefore expected to fail after the bump with `value.run is not a function`. Upstream's own mock in `visual-element-target.test.ts` changed from `start` to `run`.
- **Upstream fixes that come free with the bump.** We call these without changing anything (`src/lib/utils/animateValue.ts` casts motion's `animate` and `createScopedAnimate`; `src/lib/utils/animate.svelte.ts:120-180` builds `useAnimate` on `createScopedAnimate`). They get regression pins in Step 1:
  - `e257e1b0e`: `animate()` recognises a sequence made only of nested `{ sequence, at }` objects. Before this, it treated it as a list of subjects. Upstream test: `packages/framer-motion/src/animation/animate/__tests__/animate.test.tsx` "animates a sequence made only of nested sequences".
  - `a90c0532f`: a timeline re-registers with its `useAnimate` scope each time it gets a new `finished`. So a timeline played again after finishing is stopped when the scope unmounts. Upstream test: `packages/framer-motion/src/animation/hooks/__tests__/use-animate.test.tsx` "Stops an animation played again after finishing on unmount".
  - `4cf2f4a01`: timeline `call()` callbacks no longer fire extra times when a frame lands on a repeat boundary. Upstream test: `packages/framer-motion/src/animation/timeline/__tests__/repeat-frames.test.ts` "a frame on a repeat boundary doesn't fire callbacks extra". It drives frames by hand with `MotionGlobalConfig.useManualTiming = true` and `processFrame(t)`, and stubs `window.requestAnimationFrame` so it never fires.
- **Press behaviour change (characterise it, don't fix it).** At v14.9.1, `motion-dom/src/gestures/press/index.ts` returned early on pointerup when `!isValidPressEvent(endEvent)`, which includes `isDragActive()`. A press released while the drag lock was held therefore never called its end callback. At v14.10.1 (`press/index.ts:232-237`), the press always ends, and `if (isDragActive()) success = false` turns it into a cancel. Our `src/lib/utils/gestures.ts:139-145` end callback runs `setGestureActive(visualElement, 'whileTap', false)` and fires `onTapCancel` when `success` is false. For a `motion.div` with `drag` plus `whileTap`/`onTap*`, releasing a drag should now fire `onTapCancel` once and release `whileTap`. Upstream test: `packages/motion-dom/src/gestures/drag/__tests__/press-interop.test.ts` (expects `["start","cancel"]`).
- **Existing unit test that may need updating.** `src/lib/utils/gestures.spec.ts`, test "ignores press while a drag holds the global lock" (around line 190), asserts that pointerdown under `setDragLock(true)` doesn't activate `whileTap`. At v14.10.1, `startPress` still returns early on `!isValidPressEvent(startEvent)`, so this should still pass. Leave it alone unless it fails.
- **New public types in 14.10.1.** `motion-dom` exports `PressOptions`, `PressHandlers`, `OnPressStartEvent` and `PointerEventOptions` (via `export * from "./gestures/press/types"`). We re-export the runtime `press` at `src/lib/index.ts:36` but no press types. The existing type re-export block for drag is `src/lib/index.ts:46-51`:
  ```ts
  export type {
      DragConstraintsContext,
      DragConstraintsFunction,
      DragOptions,
      DragPointConstraint
  } from 'motion-dom'
  ```
- **Export tripwire.** `src/lib/index.spec.ts` ("re-exports or deliberately skips every runtime export of motion") fails when `motion` gains a runtime export that we neither re-export nor allowlist in `src/lib/__tests__/motionExportAllowlist.ts`. The audit found **no** runtime export changes between 14.9.1 and 14.10.1: `framer-motion/src/dom.ts` and all index files are unchanged, and `magnetic` was never in either version. Expect this test to stay green.
- Conventions:
  - Unit tests use Vitest (`describe`/`it`/`expect`/`vi`). Copy the imports and the fake rAF setup in `src/lib/utils/animate.spec.ts:1-20`. `useAnimate()` can be called outside a component, and calling `scope(node)` returns the detach cleanup (see that file's "stops in-flight animations and clears the list when the parent detaches", around line 70).
  - Tester pages use `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`), which is hidden under `?@isPlaywright=true`. Each step has an `expected` text and an action button. Copy the structure of `src/routes/tests/drag/disable-from-ondrag/+page.svelte` and its spec `e2e/drag/disable-from-ondrag.spec.ts`.
  - Index links in `src/routes/+page.svelte` look like `href={resolve('/tests/drag/vanilla') + searchParams}`. Put the new link next to the other `/tests/drag/*` links.
  - Changesets: `.changeset/motion-14-9-1.md` is the model (frontmatter `'@humanspeak/svelte-motion': minor`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` | exit 0 |
| Types | `pnpm check` | `0 ERRORS` |
| All unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| Build | `pnpm build` | exit 0, publint "All good!" |
| One e2e file | `PW_PORT=4241 pnpm exec playwright test --project=chromium <path>` | as stated per step |
| Full e2e | `PW_PORT=4241 pnpm exec playwright test --project=chromium` | all pass (known skips only) |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `package.json`: the `"version"` field and the two pins only
- `pnpm-lock.yaml`: regenerated by `pnpm install`
- `src/lib/html/motionDomSsr.spec.ts`: the fake value only
- `src/lib/utils/timelineFixes.spec.ts` (create)
- `src/lib/index.ts`: one new `export type { … } from 'motion-dom'` block for press types
- `src/lib/__tests__/motionExportAllowlist.ts`: only if Step 4 proves it necessary
- `src/routes/tests/drag/tap-during-drag/+page.svelte` (create)
- `e2e/drag/tap-during-drag.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `.changeset/motion-14-10-1.md` (create)

**Out of scope:**
- Any `src/lib` runtime code. If a test only passes with a runtime change, that is a STOP.
- `src/lib/utils/gestures.ts` and the `tap` prop (plan 002), `src/lib/components/Reorder/**` (plans 003, 004, 006, 007), `src/lib/types.ts` and drag docs (plans 002, 005), and docs.
- PR labels. Never add `minor` or `major`.

## Git workflow

- Lane branch `lane/14101-bump`, cut from the wave-0 SHA (the commit that adds this batch folder on `feat/motion-14.10.1`).
- Use conventional commits, as in `git log`. For example: `test: pin the 14.10.1 timeline fixes (red on 14.9.1)` and `chore(deps): pin motion and motion-dom to 14.10.1`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 0: Install the current lockfile

Run `pnpm install --frozen-lockfile`.

**Verify**: `node -p "require('motion-dom/package.json').version"` → `14.9.1`. If it prints anything else, STOP.

### Step 1: Write the regression tests (red on 14.9.1)

1. Create `src/lib/utils/timelineFixes.spec.ts`. Its header comment cites the three upstream commits and test files listed in "Current state". Add three tests:
   - **"animates a sequence made only of nested sequences"**:
     - Port the upstream test, using `animate` from `'../index.js'` and `motionValue` from `'motion'`. `Timeline` is a **type-only** export of `motion` (`framer-motion/src/dom.ts:5-10` at v14.10.1), so replace upstream's `toBeInstanceOf(Timeline)` with `expect(typeof animation.add).toBe('function')`. Keep `expect(animation.duration).toBeCloseTo(0.15)` and the final values.
     - Then repeat the call through `useAnimate()`'s scoped `animate` (`const [, scopedAnimate] = useAnimate()`) and assert both values reach 100.
     - Use the fake rAF `beforeEach` from `animate.spec.ts:12-20`.
   - **"useAnimate stops a timeline played again after finishing when the scope detaches"**:
     - `const [scope, animate] = useAnimate()` and `const detach = scope(document.createElement('div'))`.
     - Run `const tl = animate(x, 100, { duration: 0.05 })` and `await tl`.
     - Then `tl.time = 0; tl.play()`, wait one frame (20 ms), and call `detach()`.
     - Wait 150 ms and expect `x.get()` to be less than 100.
     - Model it on upstream's use-animate test of the same name.
   - **"a frame on a repeat boundary doesn't fire timeline callbacks extra"**:
     - Port upstream's `repeat-frames.test.ts` `run()` helper and its first test.
     - Use `MotionGlobalConfig` and `processFrame` from `'../index.js'` (both re-exported, `src/lib/index.ts:25-40`), and `motionValue` from `motion`.
     - Build the timeline with our `animate([[v, 100, { duration: 0.1 }]], { repeat: 2, defaultTransition: { ease: 'linear' } })` instead of `new Timeline(...)`.
     - Stub `window.requestAnimationFrame = vi.fn(() => 0)` in `beforeEach` and restore it in `afterEach`. Also reset `useManualTiming` in `afterEach`.
     - Expect `callback.mock.calls` to equal `[[1], [1], [1]]`.
2. Create `src/routes/tests/drag/tap-during-drag/+page.svelte`:
   - A `motion.div` with `data-testid="card"`, `drag="x"`, `whileTap={{ scale: 0.9 }}` and `transition={{ duration: 0.1 }}`, 160×100 px.
   - Counters for `onTapStart`, `onTap` and `onTapCancel`, rendered as `<span data-testid="tap-start">`, `tap`, `tap-cancel`.
   - A `TesterPanel` with two steps:
     - "Drag the card 150 px right and release". Expected: "tap-cancel goes to 1, tap stays 0, the card returns to full size".
     - "Click the card without moving". Expected: "tap goes to 1".
3. Create `e2e/drag/tap-during-drag.spec.ts`. The header comment cites upstream `press-interop.test.ts` at v14.10.1 and `press/index.ts:232-237`. Two tests:
   - Use `page.mouse` to press on the card centre, move 150 px in 10 steps, and release. Then expect `tap-cancel` to read `1`, `tap` to read `0`, and, within 1 s, the card's computed transform scale back to 1. Read the scale with the `readScale` helper pattern from `e2e/motion/rapid-tap.test.ts`.
   - A plain click: expect `tap` to read `1` and `tap-cancel` to read `0`.
4. Add the page link to `src/routes/+page.svelte` next to the other `/tests/drag/*` links.

**Verify**:
- `pnpm exec vitest run src/lib/utils/timelineFixes.spec.ts` → the nested-sequence test and the repeat-boundary test FAIL on 14.9.1. Record the result of the replay/detach test. If it passes on 14.9.1, keep it as a guard and say so in the commit message.
- `PW_PORT=4241 pnpm exec playwright test --project=chromium e2e/drag/tap-during-drag.spec.ts` → record the result. The expected red is the drag test failing on `tap-cancel` (reads `0`). If it passes on 14.9.1, keep it as a guard and say so in the commit message. Listener order may already have released the lock before press ended.

Commit the red tests: `test: pin the 14.10.1 timeline and press-during-drag fixes (red on 14.9.1)`.

### Step 2: Set the version

In `package.json`, change `"version": "2.9.1"` to `"version": "2.10.0"`. Change nothing else in this step.

**Verify**: `node -p "require('./package.json').version"` → `2.10.0`

### Step 3: Move the pins

In `package.json`, set `"motion": "14.10.1"` and `"motion-dom": "14.10.1"`, then run `pnpm install`. pnpm 12 ignores `--save-exact`, so edit the file by hand and keep the versions without a caret.

**Verify**:
- `grep -n '"motion\(-dom\)\?": ' package.json` → both show `14.10.1`, no caret.
- `node -p "require('motion/package.json').version + ' ' + require('motion-dom/package.json').version"` → `14.10.1 14.10.1`
- `pnpm exec vitest run src/lib/__tests__/motionDependencies.spec.ts` → PASS

### Step 4: Fix the SSR mock and check the export tripwire

1. Run `pnpm exec vitest run src/lib/html/motionDomSsr.spec.ts`. Expect it to FAIL with `value.run is not a function`, or similar. In `createValue()`, add `run: () => undefined` next to `start`, keeping `start`. Add a one-line comment citing motion-dom 14.10.1 `visual-element-target.ts:153`.
2. Run `pnpm exec vitest run src/lib/index.spec.ts`. Expect PASS. If it lists unaccounted names, that is a STOP (see STOP conditions). Do not guess where to allowlist them.

**Verify**: both files PASS.

### Step 5: Re-export the press types

In `src/lib/index.ts`, directly after the drag `export type { … } from 'motion-dom'` block (`:46-51`), add:
```ts
// Motion 14.10: press() count/hold/repeat options and handlers.
export type {
    OnPressStartEvent,
    PointerEventOptions,
    PressHandlers,
    PressOptions
} from 'motion-dom'
```

**Verify**: `pnpm check` → 0 errors. Then run `grep -n "PressOptions" src/lib/index.ts` → one match.

### Step 6: Flip the red tests green

**Verify**:
- `pnpm exec vitest run src/lib/utils/timelineFixes.spec.ts` → all PASS
- `PW_PORT=4241 pnpm exec playwright test --project=chromium e2e/drag/tap-during-drag.spec.ts` → all PASS

### Step 7: Changeset

Create `.changeset/motion-14-10-1.md` with frontmatter `'@humanspeak/svelte-motion': minor`. The body starts with "Update Motion and motion-dom to 14.10.1. What arrives with the update:" and then lists one line each:
- `press()` gains `count`, `countTimeout`, `hold` and `repeat` options and `onActive`/`onHold`/`onRepeat` handlers. Its types are now exported.
- `drag()` accepts `x`/`y` motion values, and `dragControls.start(event, { immediate: true })` starts a drag without waiting for movement.
- `animate()` recognises a timeline made only of nested sequences.
- Timeline callbacks no longer fire extra times on repeat, and a timeline played again after finishing is stopped when its `useAnimate` scope unmounts.
- Releasing a press while dragging now counts as a tap cancel (`onTapCancel`), and `whileTap` ends.
- Various animation performance improvements.

Do not mention plans.

### Step 8: Full gate

Run `pnpm check`, then `pnpm test:only`, then `pnpm build`, then the full e2e. Then run `trunk fmt` and `trunk check` on the changed files. In zsh, pass the file list through `xargs`.

**Verify**:
- `pnpm check` → 0 errors
- `pnpm test:only` → all pass
- `pnpm build` → exit 0
- full e2e → all pass except known skips. Triage failures one at a time. A failure the bump causes outside this plan's scope is a STOP: report the spec, the assertion and the upstream commit you suspect (`git -C ~/Github/motion log --oneline v14.9.1..v14.10.1 -- <path>`).
- trunk → no new issues

Revert any change `pnpm build` makes to `docs/static/r/animated-tabs.json`.

## Test plan

- **Red-first anchors**:
  - In `timelineFixes.spec.ts`, the nested-sequence and repeat-boundary tests fail on 14.9.1 and pass on 14.10.1.
  - The replay/detach test and `tap-during-drag.spec.ts` are expected red. If either is green on 14.9.1, record it and keep it as a guard.
- `motionDomSsr.spec.ts` is the "bump breaks it" check. It fails after Step 3 and passes after Step 4.
- `index.spec.ts` stays the tripwire for new upstream runtime exports.

## Done criteria

- [ ] `grep -c '"14.10.1"' package.json` → `2`, and `node -p "require('./package.json').version"` → `2.10.0`
- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass, including the 3 new tests in `src/lib/utils/timelineFixes.spec.ts`
- [ ] `PW_PORT=4241 pnpm exec playwright test --project=chromium e2e/drag/tap-during-drag.spec.ts` → 2 passed
- [ ] Full chromium e2e → no new failures
- [ ] `git diff --name-only <wave-0 SHA>..HEAD` lists only in-scope files
- [ ] `.changeset/motion-14-10-1.md` exists

## STOP conditions

- After Step 0, `motion-dom` is not 14.9.1.
- The nested-sequence or repeat-boundary test passes on 14.9.1. The reproduction is wrong.
- After the bump, `index.spec.ts` reports unaccounted runtime exports.
- After the bump, any test fails that is outside this plan's new files and `motionDomSsr.spec.ts`. In particular, report (don't edit) failures in `gestures.spec.ts`, `e2e/armed-buttons/*`, `e2e/motion/*tap*` or `e2e/drag/*`.
- `pnpm install` changes dependencies other than `motion`, `motion-dom`, `framer-motion` and `motion-utils`.

## Maintenance notes

- Every future bump will trip `src/lib/index.spec.ts` when upstream adds runtime exports. Allowlist internals and re-export public API.
- The `"version"` edit is a one-off the maintainer asked for. No other plan in this batch touches `"version"`.
- `tap-during-drag` documents a behaviour change. If an upstream release reverts it, this spec is what will tell you.
- Reviewer: check that `motionDomSsr.spec.ts` keeps `start` in the mock (older motion-dom paths may still call it) and only adds `run`.
