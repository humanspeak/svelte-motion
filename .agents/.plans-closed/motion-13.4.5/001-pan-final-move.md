# Plan 001: Apply a pointermove that arrives in the same frame as pointerup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.5/README.md`.
>
> **Drift check (run first)**: `git diff --stat 67815169..HEAD -- src/lib/utils/pan.ts src/lib/utils/pan.spec.ts src/lib/utils/drag.spec.ts e2e/drag src/routes/tests/drag src/routes/+page.svelte`
> If `pan.ts` changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (upstream parity)
- **Planned at**: commit `67815169`, 2026-09-28
- **Upstream reference**: Motion 13.4.5, commits `1eecdef3a` (tests) and `b16457cec` (fix) in `~/Github/motion`, file `packages/framer-motion/src/gestures/pan/PanSession.ts`

## Why this matters

Browsers flush a coalesced `pointermove` immediately before `pointerup`, so the
final move and the release often land in the same animation frame. Our
`PanSession` throttles moves to one per frame via `frame.update(updatePoint)`,
and `handlePointerUp` calls `end()` — which cancels that pending frame — before
the final move is ever processed. Result: a dragged element rests where the
*previous* frame left it (e.g. +10px) while `onDragEnd`'s `info.offset` reports
the release point (+100px), and release velocity ignores the last segment.
Upstream Motion 13.4.5 fixed this by flushing the pending move on pointerup.
svelte-motion's policy is to match upstream framer-motion behavior exactly.

## Current state

- `src/lib/utils/pan.ts` — our own port of framer-motion's `PanSession`
  (class `PanSession`, ~lines 373–500). Used by `src/lib/utils/drag.ts` via
  `attachPan` and by pan gestures.

Imports (`pan.ts:38`):

```ts
import { cancelFrame, frame, frameData, isPrimaryPointer } from 'motion-dom'
```

Move/up/update handling (`pan.ts:440-491`):

```ts
    private handlePointerMove = (event: PointerEvent): void => {
        this.lastMoveEvent = event
        this.lastRawMovePoint = extractEventPoint(event)
        this.lastMovePoint = this.transformPoint(this.lastRawMovePoint)
        // Per-frame throttle so a 1000hz mouse doesn't drown handlers.
        frame.update(this.updatePoint, true)
    }

    private handlePointerUp = (event: PointerEvent): void => {
        this.end()
        if (this.terminalDispatched) return
        if (!(this.lastMoveEvent && this.lastMovePoint)) {
            ...
            return
        }
        const finalPoint = ...
        const info = getPanInfo(finalPoint, this.history)
        if (this.startEvent) this.handlers.onEnd?.(event, info)
        this.handlers.onSessionEnd?.(event, info)
        this.terminalDispatched = true
    }

    private updatePoint = (): void => {
        if (!(this.lastMoveEvent && this.lastRawMovePoint)) return

        this.lastMovePoint = this.transformPoint(this.lastRawMovePoint)
        ...
        this.history.push({ ...this.lastMovePoint, timestamp: frameData.timestamp })
        ...
    }
```

Velocity helper (`pan.ts:161-167`) uses a local named `time`:

```ts
    const time = millisecondsToSeconds(lastPoint.timestamp - timestampedPoint.timestamp)
    if (time === 0) return { x: 0, y: 0 }
    ...
        x: (lastPoint.x - timestampedPoint.x) / time,
        y: (lastPoint.y - timestampedPoint.y) / time
```

Upstream 13.4.5 change (verbatim intent, from `PanSession.ts`):

```ts
    private hasPendingMove?: boolean                       // new field

    private updatePoint = () => {
        if (!(this.lastMoveEvent && this.lastMoveEventInfo)) return
        this.hasPendingMove = false                        // new
        ...
        this.history.push({ ...point, timestamp: time.now() })   // was frameData.timestamp
        ...
    }

    private handlePointerMove = (event, info) => {
        ...
        this.hasPendingMove = true                         // new
        frame.update(this.updatePoint, true)
    }

    private handlePointerUp = (event, info) => {
        // Browsers flush a coalesced pointermove immediately before
        // pointerup, so the final move can still be waiting for a frame.
        this.hasPendingMove && this.updatePoint()          // new — BEFORE end()
        this.end()
        ...
    }
```

and in `getVelocity` the local `time` was renamed `seconds` (because `time` is
now imported from `motion-dom`). `time` is exported by the installed
`motion-dom` 13.4.4 already (verify: `grep -c "declare const time" node_modules/motion-dom/dist/index.d.ts` → `1`).

Conventions: comments in `pan.ts` cite upstream files by path (see the
`motion#3731` comment near line 412). Match that style — cite
`packages/framer-motion/src/gestures/pan/PanSession.ts` (Motion 13.4.5).

Existing unit test pattern: `src/lib/utils/pan.spec.ts` (helpers `pointer()`,
`flushFrame()`, `attach()` inside `describe('attachPan transformPagePoint')`).
Existing e2e page pattern: `src/routes/tests/drag/single-frame/+page.svelte`
and spec `e2e/drag/single-frame.spec.ts`.

## Commands you will need

| Purpose       | Command | Expected on success |
| ------------- | ------- | ------------------- |
| Install       | `pnpm install --frozen-lockfile` | exit 0 |
| Focused unit  | `pnpm exec vitest run src/lib/utils/pan.spec.ts src/lib/utils/drag.spec.ts` | all pass |
| Full unit     | `pnpm test` | all pass |
| Typecheck     | `pnpm check` | 0 errors (existing warnings allowed) |
| Build+package | `pnpm build` | exit 0 |
| Focused e2e   | `pnpm exec playwright test e2e/drag/release-before-frame.spec.ts --project=chromium` | all pass |
| Lint          | `trunk check` | no new issues |
| Format        | `trunk fmt` | exit 0 |

E2E server note: Playwright serves on port **4198**. If something is already
listening there (the maintainer's sign-off browser often is), DO NOT kill it —
run with `PW_REUSE_SERVER=1` prefixed instead. If the list of projects differs,
run `pnpm exec playwright test --list | head` to see project names.

## Scope

**In scope**:

- `src/lib/utils/pan.ts`
- `src/lib/utils/pan.spec.ts`
- `src/lib/utils/drag.spec.ts` (one new test only)
- `src/routes/tests/drag/release-before-frame/+page.svelte` (create)
- `e2e/drag/release-before-frame.spec.ts` (create)
- `src/routes/+page.svelte` (add one link next to the other `/tests/drag/*` links)
- `.changeset/pan-final-move.md` (create)

**Out of scope**:

- `src/lib/utils/drag.ts` — the drag layer consumes `onMove`; no change needed.
  If the drag e2e still fails after the pan fix, STOP (see below).
- `e2e/drag/single-frame.spec.ts` — its `test.fixme` is a separate issue; leave it.
- Any other part of `PanSession` (scroll tracking, threshold, pointercancel).

## Git workflow

- Work on the existing branch `chore/motion-13.4.5` (the maintainer's shared
  branch for this batch). Do not create another branch.
- Conventional commits, e.g. `test(pan): cover a pointermove in the same frame as pointerup`
  then `fix(pan): flush the pending pointermove before pointerup`.
- Do NOT push or open a PR. The maintainer signs off visually first.

## Steps

### Step 1: Failing unit tests (pan + drag)

In `src/lib/utils/pan.spec.ts`, inside the existing
`describe('attachPan transformPagePoint', ...)`, add:

`it('applies a pointermove that arrives in the same frame as pointerup', ...)`

Model: use `vi.spyOn(performance, 'now')` controlled clock (as in the existing
test `'matches the recorded corrected-frame velocity sequence deterministically'`
at ~line 264), attach `{ onMove, onEnd }`:

1. `element.dispatchEvent(pointer('pointerdown', 0, 0, 11))`, `await flushFrame()`.
2. clock → 1000; `window.dispatchEvent(pointer('pointermove', 10, 0, 11))`; `await flushFrame()`.
3. clock → 1050; `window.dispatchEvent(pointer('pointermove', 60, 0, 11))` and
   **immediately, with no await in between**, `window.dispatchEvent(pointer('pointerup', 60, 0, 11))`.
4. `await flushFrame()`.
5. Assert: the last `onMove` call's info has `offset.x === 60` (the final move
   was delivered), and `onEnd` info has `offset.x === 60` and
   `velocity.x === 1000` (50px over 50ms).

In `src/lib/utils/drag.spec.ts`, add a test next to the other `attachDrag`
tests (search for `it('attachDrag: attaches pointerdown and animates during move'`
and copy its setup): drag on `axis: 'x'`, `momentum: false`, bound
`x = motionValue(0)`; pointerdown at (0,0); move to (10,0); `await flushFrame()`;
expect `x.get()` toBe 10; then move to (100,0) and pointerup at (100,0)
synchronously; `await flushFrame()`; expect `x.get()` toBe **100** and
`onDragEnd` called once with `info.offset.x === 100`.

**Verify**: `pnpm exec vitest run src/lib/utils/pan.spec.ts src/lib/utils/drag.spec.ts -t "same frame"`
→ both new tests FAIL: pan test's last `onMove` offset is 10 (or velocity ≠ 1000);
drag test `x.get()` is 10, expected 100. If either passes, STOP — the
reproduction is wrong.

### Step 2: Port the upstream fix

In `src/lib/utils/pan.ts`:

1. Import `time` from `motion-dom` alongside the existing imports.
2. Add a private field `private hasPendingMove = false` with a JSDoc line
   "Whether a pointermove has arrived since the last updatePoint."
3. `handlePointerMove`: set `this.hasPendingMove = true` before `frame.update(...)`.
4. `updatePoint`: set `this.hasPendingMove = false` right after the early-return guard.
5. `updatePoint`: change the history timestamp from `frameData.timestamp` to `time.now()`.
6. `handlePointerUp`: as the **first** statement, before `this.end()`:
   ```ts
   // Browsers flush a coalesced pointermove immediately before pointerup,
   // so the final move can still be waiting for a frame
   // (Motion 13.4.5 `PanSession.handlePointerUp`).
   if (this.hasPendingMove) this.updatePoint()
   ```
7. In `getVelocity`, rename the local `time` to `seconds` (all three uses).
8. Leave `frameData.timestamp` in the constructor's initial history entry
   (upstream also keeps it there) — only if `frameData` becomes unused would
   you remove its import; it will not.

**Verify**: `pnpm exec vitest run src/lib/utils/pan.spec.ts src/lib/utils/drag.spec.ts`
→ all pass, including the two new tests and the pre-existing
`'matches the recorded corrected-frame velocity sequence deterministically'`.

### Step 3: E2E demo page + spec (port of upstream `drag-release-before-frame`)

Create `src/routes/tests/drag/release-before-frame/+page.svelte`, modeled on
`src/routes/tests/drag/single-frame/+page.svelte`:

- A doc comment explaining: browsers flush the final pointermove right before
  pointerup; the element must come to rest at the release point, matching
  `onDragEnd`'s offset.
- `<div style="padding: 100px">` containing
  `<motion.div drag dragElastic={0} dragMomentum={false} data-testid="draggable" onDragEnd={(_, info) => (offset = \`${info.offset.x},${info.offset.y}\`)} style="width:50px;height:50px;background:red" />`
  and `<div id="drag-end-offset">{offset}</div>` (`let offset = $state('')`).

Create `e2e/drag/release-before-frame.spec.ts` porting upstream's Cypress spec
(`~/Github/motion/packages/framer-motion/cypress/integration/drag-release-before-frame.ts`):

- Helper `pointer(type, x, y)` via `page.evaluate` dispatching a real
  `PointerEvent` on the element (`isPrimary: true, bubbles: true, pointerId: 1,
  button: 0, pointerType: 'mouse'`) — both events must be dispatched **inside one
  `page.evaluate` call** so no frame can run between them.
- Helper `nextFrame()` = `page.evaluate(() => new Promise(r => requestAnimationFrame(() => r(null))))`.
- Test 1 "applies a pointermove followed by pointerup within the same frame":
  goto `/tests/drag/release-before-frame?@isPlaywright=true`; wait 2 frames;
  record start rect; pointerdown at start+5, move to start+15 (one evaluate);
  2 frames; assert element moved (10,10); then in ONE evaluate: move to
  start+105 and pointerup at start+105; 2 frames; assert `#drag-end-offset`
  has text `100,100` and rect offset is exactly (100,100).
- Test 2 "applies a pointermove when a frame runs before pointerup": same, but
  `nextFrame()` between the final move and pointerup; same expectations.

Add a link to the page in `src/routes/+page.svelte` next to the existing
`/tests/drag/single-frame` link, copying that entry's markup exactly.

**Verify**: `pnpm exec playwright test e2e/drag/release-before-frame.spec.ts --project=chromium`
→ 2 passed. (Optional red check: `git stash` the pan.ts change, rerun → test 1
fails with rest offset 10; `git stash pop`.)

### Step 4: Changeset + full gate

Create `.changeset/pan-final-move.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

Apply a pointermove that arrives in the same frame as pointerup, so dragged elements rest at the release point and release velocity includes the final movement (Motion 13.4.5 parity).
```

**Verify** (all):
- `trunk fmt` → exit 0; `trunk check` → no new issues
- `pnpm check` → 0 errors
- `pnpm test` → all pass
- `pnpm exec playwright test e2e/drag --project=chromium` → all pass except pre-existing `fixme`/skips

## Test plan

- Red anchors: pan unit test (last move offset 10 → 60, velocity 1000) and
  drag unit test (`x` 10 → 100). Both fail on the current code.
- E2E: two cases ported from upstream Cypress `drag-release-before-frame.ts`.
- Regression: all existing `pan.spec.ts` / `drag.spec.ts` / `e2e/drag/*` pass.

## Done criteria

- [ ] `grep -n "hasPendingMove" src/lib/utils/pan.ts` shows ≥3 lines
- [ ] `grep -n "timestamp: frameData.timestamp" src/lib/utils/pan.ts` matches only the constructor line
- [ ] `pnpm test` exits 0; new "same frame" tests exist and pass
- [ ] `pnpm exec playwright test e2e/drag/release-before-frame.spec.ts --project=chromium` → 2 passed
- [ ] `pnpm check` 0 errors; `trunk check` no new issues
- [ ] `git status` shows only in-scope files
- [ ] README status row updated

## STOP conditions

- Step 1 tests pass on unmodified code.
- The existing deterministic velocity test changes values after Step 2
  (`time.now()` behaves differently from `frameData.timestamp` under the fake
  clock) — report the new numbers; don't just rewrite the expectations.
- The drag e2e still rests at +10 after the pan fix (means `drag.ts` has its own
  pending-state that also needs flushing — out of scope; report).
- Port 4198 is busy and `PW_REUSE_SERVER=1` runs fail for reasons unrelated to
  this change (known: a handful of specs fail against `vite dev` but pass via
  build+preview) — report instead of killing the server.

## Maintenance notes

- Any future re-port of `PanSession` must keep the flush in `handlePointerUp`
  *before* `end()`, because `end()` cancels the pending frame.
- `time.now()` returns `frameData.timestamp` inside a frame batch and
  `performance.now()` otherwise, so pointerup-time samples now carry a real time.
