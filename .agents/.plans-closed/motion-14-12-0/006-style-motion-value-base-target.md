# Plan 006: A `while*` gesture restores a value bound through a style motion value

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md` or any other plan file.
>
> **Never use `git stash`.** Never use or kill port 4198. Never set `PW_REUSE_SERVER`. This lane's Playwright port is **4266**: prefix every Playwright command with `PW_PORT=4266`.
>
> **Drift check (run first)**: `git diff --stat e4449617..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/visualElementCore.ts src/lib/components`
> Expected: no output.

## Status

- **Priority**: P1 (plan 004 cannot finish until this lands)
- **Effort**: S
- **Risk**: MED. The edit is in the block that creates every motion component's VisualElement.
- **Depends on**: plan 004 steps 1-5 (merged at `e4449617`; they supply three red tests this plan turns green)
- **Category**: bug (upstream parity)
- **Planned at**: commit `e4449617` (`feat/motion-14.12.0`), 2026-11-12, by the guard after plan 004's executor stopped at its step 5.

## Why this matters

`@humanspeak/svelte-motion` is a Svelte 5 port of Motion. A motion component can bind a CSS value to a motion value through `style`, for example `<motion.div style={{ opacity }} whileHover={{ opacity: 0.5 }} />` where `opacity = motionValue(1)`.

Today, when the gesture ends, the value stays at 0.5. It should animate back to 1, as it does upstream. The bug affects `whileHover`, `whileTap`, `whileFocus`, `whileInView`, `whileDrag` and the new `whilePinch`. It is not new in this batch; plan 004's ported upstream tests exposed it.

The maintainer's standing rule: where this library diverges from upstream Motion, adopt upstream's behaviour.

## Current state

- **Upstream** (`~/Github/motion`, tag `v14.12.0`, read with `git -C ~/Github/motion show v14.12.0:<path>`):
  - `packages/motion-dom/src/render/VisualElement.ts`: the constructor sets `this.baseTarget = { ...latestValues }`. `getBaseTarget(key)` falls back to `this.baseTarget[key]`. When a `while*` state ends, `animateChanges` (`packages/motion-dom/src/render/utils/animation-state.ts`) animates each removed key back to `getBaseTarget(key)`.
  - Upstream's `makeLatestValues` (`packages/framer-motion/src/motion/utils/use-visual-state.ts`) scrapes the `style` motion values and puts each one's current value into `latestValues` before the VisualElement is constructed. So upstream's `baseTarget` holds the mount-time value of every style motion value.
- **Ours**: `src/lib/html/_MotionContainer.svelte`, function `createNodes(late)`, calls `createMotionVisualElement({ … props: buildMotionNodeProps(false), … })`. `buildMotionNodeProps(false)` omits `style` on purpose: the JSDoc above `buildMotionNodeProps` and the comment inside `createNodes` explain that scraping style motion values into `latestValues` at creation changes FLIP/projection behaviour. The style motion values are bound later, by the "Keep the node's props in sync" `$effect`, through `visualElement.update(buildMotionNodeProps(), …)`.
  - Result: `visualElement.baseTarget` has no entry for a style motion value's key. The value is already bound, so motion-dom's `readValue` (which would call `setBaseTarget` after reading the DOM) never runs for it. `getBaseTarget(key)` returns `undefined`, and the gesture's end has nothing to animate back to.
- **Red tests that already exist** in `src/lib/components/pinch.spec.ts` (run `pnpm exec vitest run src/lib/components/pinch.spec.ts` → 20 passed, 3 failed, each `expected 0.5 to be 1`):
  - "animates while pinching and back on release"
  - "variant labels propagate to children"
  - "pinch={false} mid-gesture ends whilePinch"
- `src/lib/utils/visualElementCore.ts` holds `createMotionVisualElement` and `makeLatestValues`.
- motion-dom's `VisualElement` has a public `setBaseTarget(key, value)` method.
- Conventions: Vitest for unit tests; component tests render a probe from `src/lib/components/__tests__/`. Trunk is the only lint/format authority (`trunk fmt <files>`, `trunk check <files>`); do not run prettier or eslint directly. Public functions need Google-style JSDoc.

## Scope

**In scope:**
- `src/lib/html/_MotionContainer.svelte`: the `createNodes` function only
- `src/lib/utils/visualElementCore.ts`: only if the seeding is cleaner as an option of `createMotionVisualElement`, plus its spec `src/lib/utils/visualElementCore.spec.ts`
- `src/lib/components/styleMotionValueBaseTarget.spec.ts` (create)
- `src/lib/components/__tests__/StyleBaseTargetProbe.svelte` (create)
- `.changeset/style-motion-value-base-target.md` (create, `patch`)

**Out of scope:**
- Passing `style` into the creation props, or putting style motion values into `latestValues` at creation. If the fix seems to need that, STOP.
- `src/lib/components/pinch.spec.ts`, `src/lib/utils/pinchFeature.ts` and every other plan 004 file. Do not edit them.
- Any existing spec. If one fails after the fix, STOP and report it.
- Plan 004's steps 6-8.

## Steps

### Step 1: Red tests for the gestures that already ship

Create `StyleBaseTargetProbe.svelte`: one `motion.div` with `data-testid="box"` taking `style`, `whileHover`, `whileTap`, `whileFocus`, `transition` and `initial` props. Create `styleMotionValueBaseTarget.spec.ts`. Reuse the `beforeEach` fake-rAF setup and the `settle`/`nextFrame` helpers from `src/lib/components/pinch.spec.ts` (copy them; do not import from a spec).

Tests, each with `const opacity = motionValue(1)`, `style: { opacity }` and `transition: { duration: 0 }`:
1. `whileHover={{ opacity: 0.5 }}`: after a hover start, `opacity.get()` is 0.5; after the hover end it is 1. Look at `src/lib/utils/gestures.ts` and an existing hover spec for the pointer events motion-dom's `hover()` needs in jsdom.
2. The same for `whileTap` (pointer down, then pointer up).
3. The same for `whileFocus` (focus, then blur), if jsdom can drive it; if it cannot, say so in the report and leave the test out.
4. Guard: a transform key. `const x = motionValue(20)`, `style: { x }`, `whileHover={{ x: 100 }}`: back to 20 after the hover ends.
5. Guard: with `initial={{ opacity: 0.2 }}` and `animate` unset, plus `style: { opacity }`, record what upstream does (read `getBaseTarget` in upstream's `VisualElement.ts`: a key present in `initial` returns the `initial` value) and assert that.

**Verify**: `pnpm exec vitest run src/lib/components/styleMotionValueBaseTarget.spec.ts` → tests 1, 2, 4 (and 3 if present) FAIL with the value stuck at the `while*` value. If they pass, the diagnosis is wrong: STOP.

Commit: `test: while* gestures restore style motion values (red)`. The pre-commit hook does not run unit tests, so it should pass.

### Step 2: Seed the base target at creation

In `createNodes`, right after the VisualElement is created (and, for a late node, after its style motion values have been reset to the first-render snapshot), seed the node's base target from the style motion values: for each key of the `style` prop whose value is a motion value, if `visualElement.baseTarget[key]` is `undefined`, call `visualElement.setBaseTarget(key, value.get())`.

- Use the same key mapping the scrape uses, so a transform shorthand ends up under the key motion-dom animates. Read `scrapeHTMLMotionValuesFromProps` and `scrapeSVGMotionValuesFromProps` in motion-dom to see which keys they claim. SVG components bind motion values as top-level attribute props (`svgMotionValueAttrs` in the container); seed those keys too if the same bug reproduces for them, and say in the report whether it did.
- Do not write to `latestValues`. Do not call `visualElement.update` earlier than it runs today.
- Seed once, at creation, as upstream's constructor does. Do not re-seed when the motion value changes later.
- Add a code comment citing upstream `VisualElement.ts` (the `baseTarget = { ...latestValues }` line) and stating why we seed separately (style is omitted from the creation props).
- If it is cleaner, put the loop in `createMotionVisualElement` behind a new option and unit-test it in `visualElementCore.spec.ts`.

**Verify**:
- `pnpm exec vitest run src/lib/components/styleMotionValueBaseTarget.spec.ts` → all PASS.
- `pnpm exec vitest run src/lib/components/pinch.spec.ts` → 23 passed.
- `pnpm check` → 0 errors.

### Step 3: Gate

Run `pnpm test:only`, then `pnpm build`, then the full chromium e2e: `PW_PORT=4266 pnpm exec playwright test --project=chromium`. Then `trunk fmt` and `trunk check` on the changed files.

**Verify**: all unit tests pass (0 failures, including the three pinch tests); build exit 0; e2e all pass except known skips. Re-run a failing e2e spec alone once before reporting it, and say that it was re-run. A failure this change causes is a STOP: report the spec, the assertion and what the page shows. Layout and shared-layout specs under `e2e/layout*/` and `e2e/animate-layout/` are the ones to watch.

### Step 4: Changeset

Create `.changeset/style-motion-value-base-target.md` with frontmatter `'@humanspeak/svelte-motion': patch` and one sentence: a value bound through a `style` motion value now animates back when a `whileHover`, `whileTap`, `whileFocus`, `whileInView`, `whileDrag` or `whilePinch` state ends. Do not mention plans.

Commit: `fix: restore style motion values when a while* gesture ends`.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/components/styleMotionValueBaseTarget.spec.ts` → all pass; tests 1, 2 and 4 were red before Step 2
- [ ] `pnpm exec vitest run src/lib/components/pinch.spec.ts` → 23 passed
- [ ] `pnpm test:only` → 0 failures
- [ ] `pnpm check` → 0 errors; `pnpm build` → exit 0
- [ ] Full chromium e2e → no failures (or a STOP report)
- [ ] `git diff --name-only e4449617..HEAD` lists only in-scope files
- [ ] `grep -n "style: styleProp" src/lib/html/_MotionContainer.svelte` is unchanged from `e4449617` (style is still omitted at creation)

## STOP conditions

- The Step 1 tests pass before the fix.
- The fix only works by passing `style` at creation or by writing style values into `latestValues`.
- The three pinch tests are still red after the fix. Report what `visualElement.getBaseTarget('opacity')` returns at the release.
- Any existing unit or e2e test fails after the fix.

## Maintenance notes

- Reviewer: check that `latestValues` at creation is unchanged (no style keys), and that no existing spec was edited.
- If style is ever passed at creation again, this seeding becomes redundant and should be removed with it.
