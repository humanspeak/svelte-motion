# Plan 003: Prove the vanilla `pinch()` re-export with a tester page and upstream's browser tests

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: this lane's Playwright port is **4263**. Prefix every Playwright command with `PW_PORT=4263`. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 82bf6e74..HEAD -- src/routes/tests/pinch e2e/pinch src/routes/+page.svelte src/lib/utils/scopeMotion.svelte.spec.ts`
> Expected: no output. If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (new page, new specs; no library code)
- **Depends on**: 001-bump-motion-14-12-0.md (`pinch` is only exported from `$lib` after it)
- **Wave**: 2
- **Category**: tests
- **Planned at**: commit `82bf6e74`, 2026-11-12

## Why this matters

Motion 14.11 added `pinch()`: a vanilla gesture that scales, rotates and moves any element with two touches, a trackpad pinch (ctrl + wheel) or Safari's gesture events. Plan 001 re-exports it from `@humanspeak/svelte-motion` unchanged. This plan proves the re-export works in a real browser through our package entry: it ports upstream's fixture page and its 11 Playwright tests, checks it composes with our re-typed `drag()`, checks it is cleaned up by `scopeMotion`, and gives the maintainer a page to drive by hand.

## Current state

- After plan 001: `src/lib/index.ts` exports `pinch` (from `motion`) and the types `OnPinchEvent`, `OnPinchStartEvent`, `PinchHandlers`, `PinchInfo`, `PinchLimits`, `PinchOptions`, `PinchProps`, `PinchRotateOptions`. Check with `grep -n "pinch\|Pinch" src/lib/index.ts`. If there is no match, STOP.
- **`pinch()` signature** (`~/Github/motion` at `v14.12.0`, `packages/motion-dom/src/gestures/pinch/index.ts:909-976`):
  ```ts
  pinch(elementOrSelector, options?: PinchOptions): VoidFunction
  pinch(elementOrSelector, onPinchStart?: OnPinchStartEvent, options?: PinchOptions): VoidFunction
  ```
  - `onPinchStart(element, startEvent)` runs once per gesture. It may return nothing, a function (called when the gesture ends, with `(event, info)`), or `{ onPinch, onComplete }`.
  - `PinchInfo` is `{ point, offset, scale, rotate }`.
  - `PinchOptions`: `scale?: boolean | { min?, max? }`, `rotate?: boolean | { min?, max?, snap? }`, `pan?: boolean`, `origin?: 'pointer' | { x, y }`, `elastic?: boolean | number | { min?, max? }` (default 0.35), `snapToOrigin?: boolean`, `transition?: SpringOptions`.
  - It sets `element.style.touchAction = 'none'` and restores the previous value when the returned function is called.
  - It runs inside the active `scopeMotion` scope: the gesture is removed when the scope is cleaned up.
  - It writes the element's `scale`, `rotate`, `x`, `y` motion values: those of its VisualElement if it has one, otherwise the ones `animate()` binds to it.
- **Upstream fixture** `dev/html/public/playwright/gestures/pinch.html` (read with `git -C ~/Github/motion show v14.12.0:<path>`). A 100×100 red `#box` absolutely positioned at (100, 100), body margin 0. Query params: `rotate`, `pan=false`, `min`, `max`, `drag` (also attach `drag(box, { momentum: false })`), `returns` (`object` default, `function`, `none`). It records `window.events` (`"start"`, then `"end:" + event.type`), `window.lastInfo`, `window.startArgs` (`{ isBox, type }`) and `window.stopPinch`. Its `pinch()` call:
  ```js
  window.stopPinch = pinch(box, (element, startEvent) => { … }, {
      rotate: params.has("rotate"),
      pan: params.get("pan") !== "false",
      scale: { min: num("min"), max: num("max") },
  })
  ```
- **Upstream spec** `tests/gestures/pinch.spec.ts` at `v14.12.0`: 10 touch tests (skipped outside Chromium, because touches go through CDP `Input.dispatchTouchEvent`) and 1 trackpad test (ctrl + `page.mouse.wheel`). Its helpers `frames(page, n)` and `rect(page, selector)` are in `tests/gestures/drag-helpers.ts`. All coordinates assume the box's top-left corner is at viewport (100, 100).
- **Our conventions**:
  - Test pages: `src/routes/tests/<area>/<page>/+page.svelte`, importing from `$lib`. Specs: `e2e/<area>/<name>.spec.ts`, loading `/tests/<area>/<page>?@isPlaywright=true`. There is no `pinch` area yet; this plan creates `src/routes/tests/pinch/` and `e2e/pinch/`.
  - A page a human reviews uses `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`), hidden under `?@isPlaywright=true`. Step type: `{ text: string; expected: string; action?: { label?: string; run: () => void } }`. Model the page on `src/routes/tests/drag/vanilla/+page.svelte`, which already drives vanilla `drag()` on plain elements from `onMount` and keeps live verdicts.
  - CDP touch input in our e2e: `e2e/drag/flick-from-standstill.spec.ts:30-50` (`page.context().newCDPSession(page)` and `cdp.send('Input.dispatchTouchEvent', …)`).
  - Index links: `src/routes/+page.svelte` has one `<h2 class="mb-3 text-xl font-medium">…</h2>` per section (for example "Drag" at `:797`) followed by a list of `<a href={resolve('/tests/drag/vanilla') + searchParams}>` items.
  - `scopeMotion` unit tests live in `src/lib/utils/scopeMotion.svelte.spec.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run src/lib/utils/scopeMotion.svelte.spec.ts` | all pass |
| One e2e file | `PW_PORT=4263 pnpm exec playwright test --project=chromium e2e/pinch/vanilla.spec.ts` | all pass |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**In scope:**
- `src/routes/tests/pinch/vanilla/+page.svelte` (create)
- `e2e/pinch/vanilla.spec.ts` (create)
- `e2e/pinch/_helpers.ts` (create: the `frames`, `rect`, `touch`, `twoFinger` helpers; plan 004's spec imports them later)
- `src/lib/utils/scopeMotion.svelte.spec.ts` (one new test)
- `src/routes/+page.svelte` (a new "Pinch (Motion 14.11)" section with one link)

**Out of scope:**
- Any file under `src/lib` other than the one spec. `pinch` is motion's own binding; if a ported test fails, that is a STOP, not a reason to wrap it.
- The `pinch` prop on motion components, `whilePinch`, `pinchFeatures` (plan 004). Do not create `src/routes/tests/pinch/prop/`.
- Docs (plan 005).

## Git workflow

- Lane branch `lane/14120-vanilla-pinch`, cut from `feat/motion-14.12.0` after plan 001 is merged.
- Conventional commits, for example `test(pinch): vanilla pinch() page and upstream e2e port`.
- Do not push.

## Steps

### Step 1: The tester page

Create `src/routes/tests/pinch/vanilla/+page.svelte` as a port of upstream's `pinch.html`.

1. Render `<div id="box" data-testid="box">` with `position: fixed; left: 100px; top: 100px; width: 100px; height: 100px; background: red`. `fixed` keeps the corner at viewport (100, 100) whatever the surrounding layout does. Nothing else may overlap the region from (0, 0) to (450, 450) when `?@isPlaywright=true` is set.
2. In `onMount`, read the same query params as upstream and call `pinch` and (with `?drag`) `drag`, both imported from `$lib`, with exactly upstream's options. Record `window.events`, `window.lastInfo`, `window.startArgs` and `window.stopPinch` as upstream does. Return a cleanup that calls the stop functions.
3. Human layer, outside the (0,0)-(450,450) region and hidden under `@isPlaywright` where it would overlap: a readout of the last `PinchInfo` (`scale`, `rotate`, `offset`) with `data-testid="info"`, the event log, a "Reset" button that sets the box's values back (`animate(box, { scale: 1, rotate: 0, x: 0, y: 0 }, { duration: 0 })` from `$lib`), and links that reload the page with `?rotate`, `?drag`, `?min=0.5&max=2`.
4. `TesterPanel` with `eyebrow="tests/gestures/pinch.spec.ts"`, title "Vanilla pinch()", and steps:
   - "On a trackpad, put the cursor over the box and pinch outward." Expected: "The box grows around the cursor; the page itself does not zoom. The log shows start, then end:wheel."
   - "On a touch screen (or Chrome DevTools device mode with shift-drag), spread two fingers on the box." Expected: "The box scales around the point between the fingers and follows them."
   - "Open `?rotate` and twist two fingers." Expected: "The box rotates with the fingers." Say in the text that a Mac trackpad in Chrome reports no rotation; rotation needs touches or Safari.
   - "Open `?drag`, drag the box with one finger, add a second finger and pinch, lift the second finger and keep dragging." Expected: "No jump when the pinch starts or ends."
   - "Open `?min=0.5&max=2` and pinch far past the limit, then let go." Expected: "The box resists past 2× and springs back to 2×."

**Verify**: `pnpm check` → 0 errors.

### Step 2: Helpers and the ported spec

1. Create `e2e/pinch/_helpers.ts` exporting `frames(page, count = 2)`, `rect(page, selector)` (rounded to 2 decimals, as upstream's `drag-helpers.ts:38-52`), `touch(cdp, type, points)` and `twoFinger(page, from, to, { steps = 5, lift = true })`, ported from upstream's `pinch.spec.ts:11-60`. `touch` must accept an optional `id` per point (upstream's `tests/react/pinch.spec.ts:24-34` form: `id: id ?? index`), because plan 004 reuses it.
2. Create `e2e/pinch/vanilla.spec.ts`. The header comment cites upstream `tests/gestures/pinch.spec.ts` at v14.12.0. `open(page, query)` goes to `/tests/pinch/vanilla?@isPlaywright=true` plus the query (join with `&`, since upstream's queries start with `?`), waits for `window.stopPinch` to exist, then `frames(page, 2)`.
3. Port all 11 tests with upstream's names, coordinates and assertions:
   - "two touches scale the box around the point between them"
   - "two touches move and rotate the box"
   - "the browser doesn't take over the gesture"
   - "pinches when the second touch lands beside the box"
   - "with drag(), points under the touches stay under them"
   - "with drag(), a touch that starts dragging can then pinch"
   - "calls the start callback once per gesture, with the element and event"
   - "a returned function is called when the gesture ends"
   - "pinches when the start callback returns nothing"
   - "ctrl + wheel zooms around the cursor"
   - plus one of ours: "stop() removes the gesture and restores touch-action": call `window.stopPinch()`, run `spread2x`, expect the box width still 100 and `getComputedStyle(box).touchAction` no longer `none`.
   Keep upstream's `test.skip(browserName !== 'chromium', 'Touch input needs CDP')` in the touch describe.

**Verify**: `PW_PORT=4263 pnpm exec playwright test --project=chromium e2e/pinch/vanilla.spec.ts` → 11 passed. Run it three times in a row; all three runs must pass.

### Step 3: `scopeMotion` cleans up a pinch

In `src/lib/utils/scopeMotion.svelte.spec.ts`, add a test modelled on the nearest existing test that starts a gesture or listener inside a scope: inside a `scopeMotion` callback call `pinch(element)` (import `pinch` and `scopeMotion` from `'../index.js'`), assert `element.style.touchAction === 'none'`, clean up the scope, and assert `element.style.touchAction` is back to `''`.

**Verify**: `pnpm exec vitest run src/lib/utils/scopeMotion.svelte.spec.ts` → all PASS.

### Step 4: Link the page

In `src/routes/+page.svelte`, add a new section directly before the "Drag" section (`<h2 class="mb-3 text-xl font-medium">Drag</h2>`, around `:797`). Copy the Drag section's wrapper markup exactly, with the heading "Pinch (Motion 14.11)" and one list item: `href={resolve('/tests/pinch/vanilla') + searchParams}`, text "Vanilla pinch()". Plan 004 adds a second link to the same section in another lane; a merge conflict there is expected and resolved by keeping both links under one heading.

**Verify**: `pnpm check` → 0 errors; `grep -n "tests/pinch/vanilla" src/routes/+page.svelte` → one match.

### Step 5: Gate

Run `pnpm check`, the unit file, the e2e file, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all pass; trunk reports no new issues.

## Test plan

- No red-first test: this plan adds no runtime behaviour (net-new upstream API, re-exported unchanged by plan 001).
- New e2e: `e2e/pinch/vanilla.spec.ts`, 11 tests (10 ported, 1 ours). Pattern for CDP touches: `e2e/drag/flick-from-standstill.spec.ts`.
- New unit test: one in `scopeMotion.svelte.spec.ts`.

## Done criteria

- [ ] `PW_PORT=4263 pnpm exec playwright test --project=chromium e2e/pinch/vanilla.spec.ts` → 11 passed, three runs in a row
- [ ] `pnpm exec vitest run src/lib/utils/scopeMotion.svelte.spec.ts` → all pass
- [ ] `pnpm check` → 0 errors
- [ ] `git diff --name-only <lane base>..HEAD` lists only in-scope files
- [ ] The page imports `pinch` and `drag` from `$lib`, not from `motion` or `motion-dom`: `grep -n "from 'motion" src/routes/tests/pinch/vanilla/+page.svelte` → no match

## STOP conditions

- `pinch` is not exported from `$lib` (plan 001 has not landed in your base).
- A ported test fails after two fix attempts on the page or helpers. Report the test name, upstream's expected numbers and the measured ones. In particular, report (do not work around) a failure of either `with drag()` test: it would mean our re-typed `drag()` (`src/lib/utils/vanillaDrag.ts`) does not share state with `pinch()` the way upstream's does.
- The box cannot be kept at viewport (100, 100) under `@isPlaywright` without editing a layout file.

## Maintenance notes

- `e2e/pinch/_helpers.ts` is shared with plan 004's `e2e/pinch/prop.spec.ts`.
- Sign-off needs an upstream twin: upstream's own `dev/html/public/playwright/gestures/pinch.html` served from `~/Github/motion` at v14.12.0, with the same query links. The dispatcher sets it up; see the batch README.
- The trackpad test depends on Chromium reporting ctrl + wheel deltas unchanged. Upstream fixed a WebKit variant of it (`9df533983`); we only run Chromium.
