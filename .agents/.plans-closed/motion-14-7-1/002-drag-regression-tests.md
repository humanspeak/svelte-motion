# Plan 002: Lock in the Motion 14.7.1 drag fixes with regression pages and tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **This is a two-phase, test-only plan.** Phase A (Steps 1-6) runs on Motion **14.6.0** and must end with the new
> tests failing in the specific ways listed. After Step 6 you **STOP and report "phase A red"** with the per-test
> results table. Do not start Phase B until the dispatcher tells you to.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4212** (`PW_PORT=4212`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **No source changes.** The fixes arrive inside `motion-dom` with plan 001's bump to 14.7.1. You only add test
> pages, specs, links and one unit case. If a test can only be made to pass by editing `src/lib/**`, STOP.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/utils/visualElementCore.ts src/lib/utils/visualElementCore.spec.ts src/routes/tests/drag src/routes/tests/reorder e2e/drag e2e/reorder src/routes/+page.svelte package.json`
> Expected: no output. On any output, compare the "Current state" excerpts with the live code; on a mismatch,
> STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (tests and test pages only; the risk is timing-sensitive specs)
- **Depends on**: 001 (Phase B only: the fixes ship in motion-dom 14.7.1, which 001 pins). Phase A runs on 14.6.0
  and depends on nothing.
- **Wave**: 1 for Phase A; Phase B after 001 is committed on `feat/motion-14.7.1`
- **Category**: tests (upstream parity)
- **Planned at**: commit `f8ac71aa` (main after the 14.6.0 release, `motion`/`motion-dom` pinned `14.6.0`), 2026-10-27

## Why this matters

svelte-motion does not reimplement drag. `DragGestureFeature` and `PanGestureFeature` drive motion-dom's
`VisualElementDragControls` and `PanSession` directly, so four drag fixes in Motion 14.7.1 reach our users the
moment plan 001 bumps the pins:

- **#1747**: a short, fast flick from a standstill released with almost no velocity, so the element stopped dead
  as the finger lifted.
- **#2024**: an item with ref `dragConstraints` inside a scrolled `layoutScroll` container (for example a scrolled
  `Reorder.Group`) jumped by the scroll offset when grabbed.
- **#1831**: releasing a drag on an element whose `animate` is a list of variant labels fired
  `onAnimationComplete` once per label, with nothing animating.
- A guard upstream added while fixing #2024: ref constraints still hold when the page moves the element and its
  constraints together without a re-measure.

Nothing in our suite would notice if a later change (ours or upstream's) broke them again. This plan ports
upstream's own regression fixtures, proves they fail on 14.6.0 (Phase A) and pass on 14.7.1 (Phase B). It also
makes the existing #2248 spec deterministic the way upstream did in 14.7.1.

## Current state

### Our drag wiring (verified at `f8ac71aa`)

- `src/lib/utils/visualElementCore.ts:23-54` imports `PanSession` and `VisualElementDragControls` from
  `motion-dom`. `DragGestureFeature` (`:309-420`) does `this.controls = new VisualElementDragControls(node)`
  (`:319`). `PanGestureFeature` (`:500-…`) does `this.session = new PanSession(pointerDownEvent, …)` (`:511`).
- **Svelte deviation 2** in `DragGestureFeature.update()`, `visualElementCore.ts:387-403`:
  ```ts
          // Svelte deviation 2: React re-measures (and so re-fires the projection
          // 'measure' event the controller resolves ref constraints from) on
          // every commit via MeasureLayout. A `dragConstraints` ref bound after
          // mount would otherwise never be measured or observed here.
          const { dragConstraints } = this.node.getProps()
          const { dragConstraints: prevConstraints } = (this.node.prevProps ?? {}) as {
              dragConstraints?: unknown
          }
          const projection = this.node.projection as /* … */
          if (dragConstraints !== prevConstraints && projection?.layout) {
              projection.notifyListeners('measure', projection.layout.layoutBox)
          }
  ```
  In Svelte, `bind:this` / `bind:ref` always assigns after the first render, so a constraints element always goes
  `null`/`undefined` → element after mount, and this block always fires once for a ref-constrained draggable. The
  #2024 page below therefore exercises deviation 2 on every load. Its explicit re-bind case proves that
  re-firing `'measure'` while scrolled doesn't fight upstream's fix.
- `onAnimationComplete` is bridged from the VisualElement's `AnimationComplete` event in
  `src/lib/html/_MotionContainer.svelte:1979-1988` (`onAnimationCompleteProp?.(definition)`), so one call per
  motion-dom notification.
- `src/lib/utils/visualElementCore.spec.ts`: `createMotionVisualElement({ props })`, then `ve.mount(element)` and
  `ve.updateFeatures()` give a VE with a real motion-dom `animationState` (see the `ExitAnimationFeature` block at
  `:201-217` and `createMotionVisualElement` tests at `:731-790`). There is no animation-state block yet.
- `e2e/drag/stale-velocity.spec.ts` covers the opposite of #1747 (fast drag, hold, release → ~0 velocity). Keep it
  untouched; it must keep passing in both phases.
- `e2e/drag/disable-from-ondrag.spec.ts:61-96`, the onDrag test, samples the animation with one round trip after
  the card closes:
  ```ts
          const slot = await getBox(page, 'slot-1')
          const box = await getBox(page, 'card-1')
          expect(Math.abs(box.width - slot.width)).toBeGreaterThan(40)        // :79
          …
          const child = await getBox(page, 'child-1')
          expect(Math.abs(child.x - box.x)).toBeLessThan(20)                   // :86
          expect(Math.abs(child.y - box.y)).toBeLessThan(20)                   // :87
  ```
  Whether those reads land mid-animation depends on Playwright's timing. Its page,
  `src/routes/tests/drag/disable-from-ondrag/+page.svelte`, uses `data-testid="slot-{id}"`, `card-{id}`,
  `child-{id}` and a 600px wide wrapper. The open card is `width: 50%` of a fixed inset, so 640px at the default
  1280px viewport.
- Conventions: pages at `src/routes/tests/<area>/<name>/+page.svelte`, specs at `e2e/<area>/<name>.spec.ts`,
  loaded with `?@isPlaywright=true`. Selectors are `data-testid` (`playwright.config.ts` sets
  `strictSelectors: true`). Only the `chromium` project (Desktop Chrome, 1280×720) is enabled, so CDP sessions
  are available. Every new page gets a `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`) with
  steps, expected results and a live verdict, rendered only when the URL lacks `@isPlaywright=true`. Copy the
  structure of `src/routes/tests/drag/disable-from-ondrag/+page.svelte:20-60,146-180` (imports, `onMount` guard,
  `TesterPanel` with `eyebrow`/`title`/`status`/`steps`, `summary` and `checks` snippets). Links go in
  `src/routes/+page.svelte`: drag links run `:631-790` (last one is `/tests/drag/disable-from-ondrag` at `:783`),
  reorder links `:522-625`. Each link is
  `<li><a class="text-blue-300 hover:underline" href={resolve('/tests/…') + searchParams}>…</a></li>`.
- Reorder API: `Reorder.Group` / `Reorder.Item` from `$lib`. Both accept `bind:ref` and forward any other prop
  (`layoutScroll`, `dragConstraints`, `style`) to the underlying motion element
  (`src/lib/components/Reorder/Group.svelte:236-246`, `Item.svelte:30-42,176-181`). `useMotionValue` is exported
  from `$lib`. See `src/routes/tests/reorder/scrollable/+page.svelte` for a `layoutScroll` Reorder page.

### Upstream (read with `git -C ~/Github/motion show v14.7.1:<path>`)

| Fix | motion-dom change | Fixture / spec to port |
| --- | --- | --- |
| #1747 | `749cc1360`: `packages/motion-dom/src/gestures/pan/PanSession.ts` stamps the pointer-down history point with `time.now()` instead of `frameData.timestamp` (stale while the frameloop is idle) | `dev/react/src/tests/issue-1747.tsx`, `tests/react/issue-1747.spec.ts` (from `713ac2631`, extended in `749cc1360`) |
| #2024 | `cc260d322` → `cc84e31ad` → `8e2a53308` → `a04f5e6ee` → `6e56b3883`: `VisualElementDragControls.ts` gains `measureScroll(projection)` (`:48-63` @ v14.7.1). `resolveConstraints()` re-measures ref constraints when the `layoutScroll` ancestors' scroll key changed (`:403-416`). `resolveRefConstraints()` records the key and passes `projection.removeElementScroll(constraintsBox)` (`:484-499`) | `dev/react/src/tests/issue-2024.tsx`, `tests/react/issue-2024.spec.ts` (from `cec8113c1`, reworked in `8e2a53308`) |
| ref constraints shift | guard for `6e56b3883` (only re-measure when a `layoutScroll` ancestor scrolled) | `dev/react/src/tests/drag-ref-constraints-shift.tsx`, `tests/react/drag-ref-constraints-shift.spec.ts` (`337c7de73`; its commit message says it **passes on main**, i.e. pre-#2024 code like 14.6.0) |
| #1831 | `a280595ea`: `packages/motion-dom/src/render/utils/animation-state.ts` moves `if (activeDelta === false) removedVariantIndex = i` below the "type has no prop" early return | `dev/react/src/tests/issue-1831.tsx`, `tests/react/issue-1831.spec.ts` (`d850bb38b`), unit case "Deactivating a type with no prop doesn't re-animate variants" in `packages/framer-motion/src/render/utils/__tests__/animation-state.test.ts` (end of file @ v14.7.1) |
| #2248 flake | none (spec only): `ecae6b93c`, `085517e01` | `tests/react/issue-2248.spec.ts` @ v14.7.1 |

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install (Phase B) | `pnpm install --frozen-lockfile` | exit 0 |
| One unit file | `pnpm exec vitest run src/lib/utils/visualElementCore.spec.ts` | all pass (Phase B) |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| One e2e spec | `PW_PORT=4212 pnpm exec playwright test <spec>` | see each step |
| Drag + reorder suites | `PW_PORT=4212 pnpm exec playwright test e2e/drag e2e/reorder` | all pass (Phase B) |

Playwright's `webServer` runs `npm run build && npm run preview` on `PW_PORT`, so each run rebuilds. Batch
several specs into one command where you can.

## Scope

**In scope** (create unless noted):

- `src/routes/tests/drag/flick-from-standstill/+page.svelte`, `e2e/drag/flick-from-standstill.spec.ts`
- `src/routes/tests/reorder/ref-constraints-scroll/+page.svelte`, `e2e/reorder/ref-constraints-scroll.spec.ts`
- `src/routes/tests/drag/ref-constraints-shift/+page.svelte`, `e2e/drag/ref-constraints-shift.spec.ts`
- `src/routes/tests/drag/release-animate-variants/+page.svelte`, `e2e/drag/release-animate-variants.spec.ts`
- `src/lib/utils/visualElementCore.spec.ts` (modify: one new `describe` with one case)
- `e2e/drag/disable-from-ondrag.spec.ts` (modify: the onDrag test only)
- `src/routes/+page.svelte` (modify: three drag links, one reorder link)

**Out of scope**:

- Everything under `src/lib/**` except the one spec file. The fixes are motion-dom's. Deviation 2 stays as is
  unless a Phase B test proves it conflicts, which is a STOP.
- `package.json`, `pnpm-lock.yaml` (plan 001 owns the bump; you only receive it via merge).
- `src/routes/tests/drag/disable-from-ondrag/+page.svelte` (the page is fine; only its spec changes).
- `e2e/drag/stale-velocity.spec.ts`, `e2e/reorder/scrollable.spec.ts` (existing guards, keep them unchanged).
- A changeset. This plan ships no behaviour and stays changeset-free. Plan 001's bump changeset carries the
  user-facing bullets for #1747 (flick release velocity), #2024 (ref constraints in scrolled `layoutScroll`
  containers), #1831 (no `onAnimationComplete` per label on drag release) and the inertia-origin fix. Don't
  create, edit or duplicate them. If those bullets are missing from 001's changeset after the Phase B merge, say so
  in your report.
- Porting motion-dom's own unit tests (`PanSession.test.ts`, `ref-constraints-scroll.test.ts`). They test
  motion-dom internals, which upstream already covers.

## Git workflow

- Lane branch `lane/1471-dragtests` in `../svelte-motion-1471-dragtests`, created by the dispatcher from the
  wave-0 SHA (Motion 14.6.0).
- Conventional commits, one per fix area in Phase A, e.g.
  `test(drag): fast flick from a standstill keeps its release velocity (#1747)`,
  `test(reorder): ref dragConstraints follow a scrolled layoutScroll group (#2024)`,
  `test(drag): ref constraints hold when the page moves both boxes`,
  `test(drag): drag release doesn't fire onAnimationComplete per animate label (#1831)`,
  `test(drag): record the #2248 close animation per frame`. Phase B: the merge commit plus at most a
  `test(...)` fix-up commit. End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Phase A — on Motion 14.6.0

First confirm `grep -n '"motion-dom": "14.6.0"' package.json` prints a line. If not, STOP. Phase A must run on
14.6.0.

### Step 1: #1747 flick from a standstill

1. Create `src/routes/tests/drag/flick-from-standstill/+page.svelte`, a port of `issue-1747.tsx`. In `onMount`,
   set `window.__moves = []` and `window.__dragEnd = []`. Add capture-phase `pointerdown` and `pointermove`
   listeners on `window` that push `{ y: e.clientY, t: e.timeStamp }`, and remove them on destroy. Declare the two
   globals in a `declare global { interface Window { … } }` block in the page's `<script lang="ts">` (or cast via
   `window as unknown as {…}` if svelte-check rejects `declare global` in a component). Render a root
   `div style="position: fixed; inset: 0; overflow: hidden"` (not upstream's `height: 100vh` alone). The app
   layout centres every page with flex (`src/routes/app.css:105-122`, `#sandbox` / `.container`), which would
   move the box away from x=0, and the spec's pointer at (150, 500) would then miss it. Fixed-inset puts the box's
   top-left at (0, 0) as in upstream's fixture. The root contains one `motion.div` with `data-testid="box"`,
   `drag="y"`, `onDragEnd={(_, info) => window.__dragEnd.push({ velocity: info.velocity.y, t: performance.now() })}`,
   and style `width: 300px; height: 3000px; background: repeating-linear-gradient(#f00 0 50px, #00f 50px 100px); touch-action: none`.
   Under `@isPlaywright=true` the page must contain **no other motion elements or rAF loops**: the bug only shows
   when motion-dom's frameloop is idle. The TesterPanel is the only exception and is not rendered under
   `@isPlaywright=true`. Its steps: "Hold still for a second, then flick the stripes up fast and short", expected
   "the stripes keep gliding at flick speed instead of stopping dead". Its live verdict shows the last `onDragEnd`
   velocity and the measured pointer speed, and reads "OK" when `|reported| >= 0.5 × |actual|`. Its `rAF`
   sampling runs only after a drag ends, so the frameloop stays idle beforehand. Header comment cites #1747,
   `749cc1360`, `713ac2631`.
2. Create `e2e/drag/flick-from-standstill.spec.ts`, a port of `tests/react/issue-1747.spec.ts` @ v14.7.1. Keep the
   `pointer`, `flick` and `setup` helpers, the `for (const input of ['mouse', 'touch'])` loop, both tests
   ("control: fast flick while inertia is animating", "fast flick from a standstill"), and the thresholds
   (`reported < -500`, `inertia < -400`). Changes: `page.goto('/tests/drag/flick-from-standstill?@isPlaywright=true')`,
   `page.getByTestId('box')`, and in-page `document.querySelector('[data-testid="box"]')` instead of `#box`.
   Keep the upstream doc comment and add one line: "svelte-motion drives motion-dom's PanSession directly, so the
   fix arrives with the motion-dom bump."
3. Link it from the drag section of `src/routes/+page.svelte`, after the `disable-from-ondrag` link (`:783`):
   "Drag: fast flick from a standstill keeps its velocity (#1747)".

**Verify**: `PW_PORT=4212 pnpm exec playwright test e2e/drag/flick-from-standstill.spec.ts e2e/drag/stale-velocity.spec.ts`
→ both **"fast flick from a standstill"** cases (mouse, touch) **FAIL** on `expect(result.reported).toBeLessThan(-500)`
(a value near 0). Both **control** cases **PASS**. `stale-velocity` passes.

- If a standstill case passes, re-run that spec alone once. If it still passes, check that nothing on the page
  keeps the frameloop awake (no other motion element, TesterPanel absent). If it still passes, keep it as a guard
  test and record "not red on 14.6.0: <reason>" for the report. Don't weaken thresholds to force a failure.
- If a control case fails, STOP: the harness, not the bug, is wrong.

Commit.

### Step 2: #2024 ref constraints after a `layoutScroll` group scrolls

1. Create `src/routes/tests/reorder/ref-constraints-scroll/+page.svelte`, a port of `issue-2024.tsx` @ v14.7.1:
   - Query params (read from `page.url.searchParams` via `$app/state`, or `window.location.search` in
     `onMount`; it must be known before the items render, so prefer `$app/state`): `constraints=ref|object|none`
     (default `ref`), `layoutScroll`, `outer`.
   - `let items = $state(Array.from({ length: 12 }, (_, i) => i))` and `let groupEl = $state<HTMLElement | null>(null)`.
   - `constraints = mode === 'ref' ? groupEl : mode === 'object' ? { top: 0, bottom: 0 } : undefined` (`$derived`).
   - `Reorder.Group` with `bind:ref={groupEl}`, `data-testid="group"`, `id="group"`, `layoutScroll={hasLayoutScroll}`,
     `axis="y"`, `values={items}`, `onReorder={(next) => (items = next)}`, style
     `position: relative; width: 300px; height: 300px; overflow-y: auto; margin: 0; padding: 0; background: #eee`.
   - Each `Reorder.Item` has `value={item}`, `id="item-{item}"`, `data-testid="item-{item}"`,
     `dragConstraints={constraints}`, style
     `position: relative; height: 60px; margin-bottom: 10px; border-radius: 10px; background: white; list-style: none; display: flex; align-items: center; padding-left: 20px`,
     plus `y` from a per-item `useMotionValue(0)`, like upstream's `Item` (a small `Item.svelte` next to the page
     is fine, and in scope).
   - With `outer`: wrap in `motion.div` `id="outer"` `data-testid="outer"` `layoutScroll` style
     `height: 400px; overflow-y: auto`, with a 200px spacer `div` before the group and a 300px one after.
   - **Deviation-2 hook (Svelte-only)**: in `onMount`, unless the mode is `none`, expose
     `window.rebindConstraints = async () => { const el = groupEl; groupEl = null; await tick(); groupEl = el; await tick() }`.
     Each assignment changes the items' `dragConstraints` prop identity, so `DragGestureFeature.update()`
     re-fires `'measure'` (deviation 2) while the group is scrolled.
   - TesterPanel: "Scroll the list down a bit, then drag item 5 down about 20px and back up". Expected: "it
     stays under your pointer; it never jumps by the scrolled distance". Live verdict: on drag, compare the item's
     movement with the pointer's (track `pointerdown`/`pointermove` on the group and the item's
     `getBoundingClientRect()` in rAF while dragging) and show "FOLLOWS ✓" within 3px, otherwise "JUMPED ✗ (Npx)".
     Header comment cites #2024 and the five commits in the table above.
2. Create `e2e/reorder/ref-constraints-scroll.spec.ts`, a port of `tests/react/issue-2024.spec.ts` @ v14.7.1. Keep
   `scrollTo`, `drag`, the five-row parameter table and its assertions, and the "drag again after reordering in a
   scrolled group" test. Use `page.getByTestId('item-N')`, and `document.getElementById` in-page (`id`s are on
   the elements for this). URL `/tests/reorder/ref-constraints-scroll?@isPlaywright=true&<query>`. Add one
   Svelte-specific test, **"deviation 2 re-measure while scrolled still follows the pointer"**: query
   `constraints=ref&layoutScroll`, scroll the group to 200, `await page.evaluate(() => window.rebindConstraints())`,
   `waitForTimeout(200)`, then drag item 5 by 20 and assert `|dy - 20| <= 2` and `|dyUp + 20| <= 2`, exactly like
   the parameterised case. Its doc comment explains that it fires `'measure'` from `DragGestureFeature.update()`
   (`visualElementCore.ts` "Svelte deviation 2") after the scroll, and so proves the two re-measure paths agree.
3. Link it from the reorder section of `src/routes/+page.svelte`, after `/tests/reorder/keyboard`: "Reorder: ref
   dragConstraints in a scrolled layoutScroll group (#2024)".

**Verify**: `PW_PORT=4212 pnpm exec playwright test e2e/reorder/ref-constraints-scroll.spec.ts e2e/reorder/scrollable.spec.ts`
→
- **FAIL**: `constraints=ref&layoutScroll scrollTop=200` and `constraints=ref&layoutScroll&outer scrollTop=200 outer=150`
  (upstream saw the item move ~65px up for a 20px drag, so `|dy - 20| <= 2` fails). The "drag again after
  reordering" test is expected to fail too.
- **PASS**: `constraints=ref scrollTop=0`, `constraints=none`, `constraints=object`, and `scrollable.spec.ts`.
- The deviation-2 test: record whatever it does. It is a guard for Phase B and may pass or fail on 14.6.0.

If either `layoutScroll` row or the "drag again after reordering" test passes, re-run it alone once. If it still
passes, keep it as a guard and record "not red on 14.6.0". If a control row fails, STOP. Commit.

### Step 3: ref constraints hold when the page moves both boxes (guard)

1. Create `src/routes/tests/drag/ref-constraints-shift/+page.svelte`, a port of `drag-ref-constraints-shift.tsx`.
   Read `?sticky` via `$app/state`. Without `sticky`: a spacer `div` `data-testid="spacer"` whose height is a
   `$state` (0), with `window.grow = () => (height = 200)` set in `onMount`, followed by the draggable block. With
   `sticky`: `<div style="height: 3000px"><div style="height: 100px"></div><div style="position: sticky; top: 0">…block…</div></div>`.
   The block (a small `Draggable.svelte` beside the page is fine and in scope) is a `div` `data-testid="constraints"`
   300×300 `#eee` bound with `bind:this` to a `$state`, containing `motion.div` `data-testid="box"` `drag`
   `dragElastic={0}` `dragMomentum={false}` `dragConstraints={constraintsEl}`, 50×50 red. The block must not
   re-render when `grow()` runs. Keep the spacer's state out of it. The spec asserts exact page positions
   (`constraints.y === 200` after `grow()`, `0` in sticky mode). The app layout flex-centres every page
   (`src/routes/app.css:105-122`, `#sandbox` / `.container`), which would put the box at y≈210 before growing (≈110
   after), not at 0 → 200. Make the page root `position: absolute; top: 0; left: 0; width: 100%` (no margin or
   padding) so the spacer starts at the document's top-left. In sticky mode, the root must still let the document
   scroll: the 3000px child gives it height. Comment why in the page. TesterPanel: "Click 'grow' (shown only to testers),
   then drag the red square to the far bottom-right". Expected: "it follows the pointer and stops exactly at the
   grey box's corner". Live verdict: after a drag ends, the square's bottom-right sits within 1px of the grey
   box's bottom-right.
2. Create `e2e/drag/ref-constraints-shift.spec.ts`, a port of `tests/react/drag-ref-constraints-shift.spec.ts` @
   v14.7.1 (both tests, the `dragBox` helper and its tolerances), with `getByTestId` selectors and URLs
   `/tests/drag/ref-constraints-shift?@isPlaywright=true` and `…&sticky`.
3. Link it from the drag section: "Drag: ref constraints hold when the page moves both boxes".

**Verify**: `PW_PORT=4212 pnpm exec playwright test e2e/drag/ref-constraints-shift.spec.ts` → **both PASS** on
14.6.0. This is a guard, not a red test: upstream added it to stop the #2024 fix from re-measuring on every drag
start, and it passes on pre-#2024 code. If either fails on 14.6.0, re-run alone once, then STOP and report (that
would be an existing svelte-motion bug, outside this plan). Commit.

### Step 4: #1831 drag release fires `onAnimationComplete` per animate label

1. Unit (red): in `src/lib/utils/visualElementCore.spec.ts`, add after the `ExitAnimationFeature` describe:
   ```ts
   describe('animation state (motion-dom)', () => {
       it("doesn't re-animate animate's labels when a type with no prop is deactivated (#1831)", () => {
           // Port of framer-motion animation-state.test.ts "Deactivating a type
           // with no prop doesn't re-animate variants" @ v14.7.1 (a280595ea).
           const element = document.createElement('div')
           const ve = createMotionVisualElement({
               props: { animate: ['a', 'b'], variants: { a: { x: 1 }, b: { opacity: 1 } } }
           })
           ve.mount(element)
           ve.updateFeatures()
           const state = ve.animationState!
           // svelte-motion's AnimationFeature.mount()/update() never call
           // animateChanges() (visualElementCore.ts:94-136), so run the initial
           // pass here with a no-op animator, mirroring upstream's first
           // state.update(). Otherwise setActive('whileDrag', true) would be the
           // first animateChanges and animate every label on any version.
           state.setAnimateFunction(() => () => Promise.resolve())
           state.animateChanges()
           const mockAnimate = () => {
               const mocked = vi.fn()
               state.setAnimateFunction(() => (animations: { animation: unknown }[]) => {
                   mocked(animations.map(({ animation }) => animation))
               })
               return mocked
           }
           let animate = mockAnimate()
           state.setActive('whileDrag', true)
           expect(animate).not.toHaveBeenCalled()
           animate = mockAnimate()
           state.setActive('whileDrag', false)
           expect(animate).not.toHaveBeenCalled()
           ve.unmount()
           visualElementStore.delete(element)
       })
   })
   ```
   Adjust types to what compiles (`setAnimateFunction` is typed `(fn: any) => void`). Keep the two
   `not.toHaveBeenCalled` assertions exactly.
2. Create `src/routes/tests/drag/release-animate-variants/+page.svelte`, a port of `issue-1831.tsx`:
   `variants = { base: { x: 300, opacity: 0 }, exiting: { x: -300, opacity: 0 }, center: { x: 0, opacity: 1 } }`,
   `?single=true` (via `$app/state`) selects `animate="center"`, otherwise `animate={['base', 'exiting', 'center']}`.
   One `motion.div` `data-testid="box"` with `initial="base"`, `transition={{ duration: 0.2 }}`, `drag="x"`,
   `dragConstraints={{ left: 0, right: 0 }}`, `dragElastic={1}`,
   `onAnimationComplete={(definition) => window.completed.push(String(definition))}`, and style
   `position: absolute; top: 100px; left: 200px; width: 200px; height: 200px; background: red`. Initialise
   `window.completed = []` in the script body (client only, guarded by `typeof window !== 'undefined'`), before the
   element mounts, so the mount animation's completion is recorded. The spec relies on that. The box must sit at
   page coordinates (200,100)-(400,300), because the spec presses at (300,200). Make sure the layout adds no
   offset. TesterPanel: steps "Drag the box sideways a little and let go", expected "it springs back; the
   completion log below stays empty". Show the live `window.completed` log (copy it into `$state` from the
   callback) with a verdict: "OK" when nothing new arrived since the last release, "FIRED ✗ ×N" otherwise.
3. Create `e2e/drag/release-animate-variants.spec.ts`, a port of `tests/react/issue-1831.spec.ts` @ v14.7.1 (the
   `settle` and `dragAndRelease` helpers and all three tests), URL
   `/tests/drag/release-animate-variants?@isPlaywright=true&single=${single}`, `getByTestId('box')`.
4. Link it from the drag section: "Drag: release doesn't fire onAnimationComplete per animate label (#1831)".

**Verify**:
- `pnpm exec vitest run src/lib/utils/visualElementCore.spec.ts` → the new #1831 case **FAILS** on the second
  `expect(animate).not.toHaveBeenCalled()`. Every other case passes. If it fails on the first assertion instead,
  STOP (the harness differs from upstream's).
- `PW_PORT=4212 pnpm exec playwright test e2e/drag/release-animate-variants.spec.ts` → the control test
  **PASSES**. "for every variant" **FAILS** with received `['base', 'exiting', 'center']` (order may differ).
  "for a single variant" is expected to **FAIL** with `['center']`. If the single case passes, re-run alone once,
  then keep it as a guard and record it. If the control fails or `settle` times out (no mount completion
  recorded), STOP.

Commit.

### Step 5: #2248 per-frame recording (flake fix, not red-first)

Rewrite only the "card closed from onDrag animates back to its slot while the pointer is down" test in
`e2e/drag/disable-from-ondrag.spec.ts` (`:61-96`) to match upstream `tests/react/issue-2248.spec.ts` @ v14.7.1
(`ecae6b93c`, `085517e01`):

1. Right after `openAndGrab(page, 1)`, start an in-page recorder:
   `page.evaluate(() => { const frames = (window as any).closeFrames = []; const record = () => { const card = document.querySelector('[data-testid="card-1"]')!; if (card.getAttribute('data-selected') === 'false') frames.push([card.getBoundingClientRect().toJSON(), document.querySelector('[data-testid="child-1"]')!.getBoundingClientRect().toJSON()]); requestAnimationFrame(record) }; requestAnimationFrame(record) })`.
   Keep upstream's comment ("Record the card and its child every frame from the one it closes on, in the page, so
   assertions don't depend on when Playwright's round trips happen to sample the animation.").
2. Keep the `while` loop that moves until `data-selected` flips.
3. Delete the single-sample blocks at `:73-87`. Move the "returns to its slot without the pointer being
   released" move + `expectBoxToSettle(page, 1)` up to directly after the loop.
4. Then read `[maxWidth, maxChildOffset]` from `closeFrames` (max card width; max of `|child.x - card.x|` and
   `|child.y - card.y|`) and assert `expect(maxWidth).toBeGreaterThan(610)` and
   `expect(maxChildOffset).toBeLessThan(100)`, with upstream's two comments (open 640px vs slot 600px; the child's
   own layout animation moves it up to ~60px from the card's corner, while a jump-ahead would be 320px left and
   144px down).
5. Keep the final `mouse.up()` + `expectBoxToSettle(page, 1)`. Update the file header to say it is a port of the
   Motion **14.7.1** spec.

This is a determinism fix for a behaviour that already passes on 14.6.0 (the #2248 fix shipped in 14.6.0), so there
is no red phase.

**Verify**: `PW_PORT=4212 pnpm exec playwright test e2e/drag/disable-from-ondrag.spec.ts --repeat-each=5` → 10/10
pass. Commit.

### Step 6: Phase A gate, then STOP

Run `trunk fmt` and `trunk check` on every file you created or changed, `pnpm check` (0 errors), and
`pnpm test:only` (exactly one failure: the #1831 unit case). Then run
`PW_PORT=4212 pnpm exec playwright test e2e/drag e2e/reorder`. The only failures allowed are the red tests
recorded in Steps 1, 2 and 4. Re-run any other failing spec alone once. If it still fails, STOP and report it as
pre-existing or caused by your pages.

**STOP and report "phase A red"** with a table of every new test → PASS / FAIL (with the failure value) /
"not red on 14.6.0: reason", plus the commit SHAs.

### Phase B — after the dispatcher says 001 is merged

### Step 7: Merge the bump and go green

1. `git merge --no-ff feat/motion-14.7.1`, then `pnpm install --frozen-lockfile`. Confirm
   `grep -n '"motion-dom": "14.7.1"' package.json` prints a line (and `"motion": "14.7.1"`), and
   `grep -m1 '"version"' node_modules/motion-dom/package.json` shows `14.7.1`. If not, STOP.
2. Confirm upstream's fixes are in the installed build:
   `grep -n "measureScroll" node_modules/motion-dom/dist/es/gestures/drag/VisualElementDragControls.mjs` (≥1
   match) and `grep -n "this.history = \[{ ...point, timestamp: time.now() }\]" node_modules/motion-dom/dist/es/gestures/pan/PanSession.mjs`
   (1 match; at 14.6.0 this line reads `this.history = [{ ...point, timestamp }];` after
   `const { timestamp } = frameData;`, around `:109-110`). If a path differs, find the file with `grep -rln measureScroll node_modules/motion-dom/dist/es`. If
   either fix is missing, STOP.
3. `pnpm exec vitest run src/lib/utils/visualElementCore.spec.ts` → all pass, including #1831.
4. `PW_PORT=4212 pnpm exec playwright test e2e/drag/flick-from-standstill.spec.ts e2e/reorder/ref-constraints-scroll.spec.ts e2e/drag/ref-constraints-shift.spec.ts e2e/drag/release-animate-variants.spec.ts e2e/drag/disable-from-ondrag.spec.ts`
   → **all pass**, including the deviation-2 re-measure test.

If a new test is still red, re-run it alone once. If it is still red, STOP and report: which test, the value, and
whether reverting nothing but the deviation-2 block locally would change it. Answer that last question by reading
the code, not by editing `visualElementCore.ts`.

### Step 8: Phase B gate

`pnpm check` (0 errors), `pnpm test:only` (all pass),
`PW_PORT=4212 pnpm exec playwright test e2e/drag e2e/reorder` (all pass; re-run a failing spec alone once before
reporting, and say it was re-run), `trunk check` on changed files (clean), and `git status` shows only in-scope
files. Report the results.

## Test plan

- Red-first anchors (fail on 14.6.0, pass on 14.7.1): #1747 standstill (mouse, touch); #2024 `layoutScroll` and
  `outer` rows and drag-again-after-reorder; #1831 list and single e2e; #1831 unit case.
- Guards (pass in both phases): #1747 controls, #2024 `ref scrollTop=0` / `none` / `object` rows,
  ref-constraints-shift (both), #1831 control, `stale-velocity`, `reorder/scrollable`, the rewritten #2248 spec.
- Svelte-specific: the deviation-2 re-measure test must pass in Phase B. It is the evidence that
  `DragGestureFeature.update()`'s `'measure'` re-fire doesn't fight motion-dom's scroll-keyed re-measure.
- Patterns: `e2e/drag/disable-from-ondrag.spec.ts` (helper style), `e2e/drag/stale-velocity.spec.ts`,
  `src/routes/tests/drag/disable-from-ondrag/+page.svelte` (TesterPanel).

## Done criteria

- [ ] Phase A report lists every new test with its 14.6.0 result; the red ones fail for the stated reasons
- [ ] After Phase B: all new specs pass; `e2e/drag` and `e2e/reorder` pass; `pnpm test:only` passes; `pnpm check` 0 errors
- [ ] `grep -n "closeFrames" e2e/drag/disable-from-ondrag.spec.ts` → matches; `grep -n "toBeGreaterThan(40)" e2e/drag/disable-from-ondrag.spec.ts` → none
- [ ] Four new pages, each with a TesterPanel hidden under `@isPlaywright=true`, linked from `src/routes/+page.svelte`
- [ ] `git diff --stat <wave-0 SHA>..HEAD -- src/lib` shows only `src/lib/utils/visualElementCore.spec.ts` (merge excluded: compare against `feat/motion-14.7.1` with `git diff --stat feat/motion-14.7.1...HEAD -- src/lib`)
- [ ] `trunk check` clean on changed files; no out-of-scope files modified

## STOP conditions

- Phase A isn't on motion-dom 14.6.0, or Phase B isn't on 14.7.1 after the merge and install.
- A **control** case fails in Phase A (#1747 control, #2024 controls, #1831 control). The harness is wrong.
- `ref-constraints-shift` fails on 14.6.0 (an existing bug, outside this plan).
- The #1831 unit case fails on the first assertion, or the e2e `settle` never sees the mount completion.
- Any new test is still red in Phase B after one solo re-run, especially the deviation-2 test. Don't edit
  `visualElementCore.ts` to fix it; report it.
- Making a test pass seems to need a `src/lib/**` change, a changed upstream threshold, or a skipped test.

## Maintenance notes

- Deviation 2 (`visualElementCore.ts:387-403`) and motion-dom's scroll-keyed re-measure (`measureScroll` in
  `VisualElementDragControls.ts` @ v14.7.1) both resolve ref constraints. If either changes, re-run
  `e2e/reorder/ref-constraints-scroll.spec.ts` and `e2e/drag/ref-constraints-shift.spec.ts`. The re-bind test is
  the one that catches a conflict.
- The #1747 page must stay free of anything that keeps the frameloop running under `@isPlaywright=true`, or the
  standstill test silently stops testing the bug.
- The #2248 thresholds (610px, 100px) assume the 1280px default viewport (open card 640px). A viewport change in
  `playwright.config.ts` needs them revisited.
- Deferred: motion-dom's own unit tests for `PanSession` and `ref-constraints-scroll`. Upstream covers them, and
  ours would test the dependency, not our code.

## Amendments (operator-approved 2026-10-27)

### A1 (Step 2): prove the rebind reaches the items

`Item.svelte` counts changes to its `constraints` prop on `window` (for example `window.__constraintsChanges`). The
deviation-2 spec asserts that the count went up by at least 2 after `rebindConstraints()`. No `src/lib` changes.
Confirm the assertion passes on 14.6.0: it is a guard, not a red test.

### A2 (Step 7): first exercise of `:123`

If "drag again after reordering" (`e2e/reorder/ref-constraints-scroll.spec.ts`) goes green in Phase B, note in the
report that its final dy check (`:123`) is exercised for the first time. On 14.6.0 the test fails earlier, at the
reorder check (`:117`).
