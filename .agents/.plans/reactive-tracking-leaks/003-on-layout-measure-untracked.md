# Plan 003: `onLayoutMeasure` may read and write `$state` without looping

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/html/_MotionContainer.svelte src/routes/+page.svelte src/routes/tests/layout e2e/layout`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (Reorder registers its item slots through this callback)
- **Depends on**: 012 (`012-reorder-item-reregister.md`)
- **Wave**: 2
- **Category**: bug
- **Planned at**: commit `4665b907`, 2026-11-13

## Revision notes

- **2026-11-21, Step 2b item 5 (guard, round 3).** With items 1–4, `keyboard-grid` and the sequential-reorder unit spec passed, but `e2e/reorder/basic.spec.ts` "keeps a held item pinned during upward swaps after earlier reversals" failed 3/3 with about 19px of drift. With Step 2 alone it passed 3/3. The old leak only restarted items in groups without an `axis` prop, because `updateDetectedAxis` reads `values` only then. Item 5 sends the key only in those groups.
- **2026-11-21, Step 2b (guard, maintainer chose to fix in this release).** The first executor stopped at Step 3. With Step 2, `e2e/reorder/keyboard-grid.spec.ts` failed 3/3: a grid keyboard move sent an item to the wrong slot. Without Step 2 it passed 2/2. `reorder.component.spec.ts` "projects each newly displaced sibling…" also failed 3/3, because its commits came from the MutationObserver path instead of the restart path. The removed leak was what restarted every Reorder item's layout observer on each reorder. Step 2b restores that restart explicitly, for Reorder only, with an internal `__layoutRemeasureKey` prop following the `__motionKind` pattern, so neither spec should need an edit.
- **2026-11-20, depends on 012**: while writing plan 012, we found that a `Reorder.Item` that gets a new value object under a stable key is only re-registered in the group's layout slots today because of the leak this plan removes. The seed call runs tracked and re-runs whenever `value` or the group's `values` change. If this plan landed alone, dragging and keyboard-moving such items would silently break, and no existing Reorder spec would catch it. Plan 012 re-registers both the element and the slot explicitly, so land 012 first. Step 3 already covers 012's tests, because it runs `e2e/reorder`, where 012 adds `immutable-values.spec.ts`, and `src/lib/components/Reorder`, where 012 adds `objectValues.component.spec.ts`. Before starting, confirm both files exist on your branch. If they don't, 012 has not landed: STOP.
- **2026-11-20, pre-flight against `a33531a2`** (Motion 14.14.0, v2.14.0): the code quoted here is unchanged, but the 14.14.0 work shifted the line numbers. `_MotionContainer.svelte` is now 4155 lines: the subscription effect is at 3078–3096 and `setLastRect(...)` is at 3170. The adapter calls its listeners at `motionDomProjection.ts:1651` and `:1719`, and `onMeasure` is at `:1740`. The drift check is now based on `a33531a2`. The 14.14.0 changes to `_MotionContainer.svelte` (the `layoutTransition` derived, the `fx` attribute) don't touch this effect.

## Why this matters

`onLayoutMeasure` is a public prop on every `motion.*` element that mirrors
framer-motion's `onLayoutMeasure`: it reports the element's layout box at
mount and after each layout change. In svelte-motion the consumer's callback
is called synchronously from inside the library's own `$effect`s. Any `$state`
the callback reads therefore becomes a dependency of a library effect, and a
callback that reads and writes the same state (`count += 1`,
`boxes[id] = box` on a `$state` record, `log.push(box)`) re-runs that effect,
which measures and calls the callback again, until Svelte throws
`effect_update_depth_exceeded`. The repo's own test page works around it with
a non-reactive object on `window`. Upstream fires the callback from the
projection update, outside any render, so setting state there is safe. After
this plan the callback runs untracked and the workaround is unnecessary.

## Current state

- `src/lib/html/_MotionContainer.svelte`: the component behind every
  `motion.*` element (4155 lines). `untrack` is already imported at line 56
  (`import { untrack, type Snippet } from 'svelte'`) and used throughout.
  The subscription effect, lines 3078–3096:

  ```svelte
  // Subscribe the consumer's `onLayoutMeasure` callback to the adapter's
  // stripped page-space measurements. The measure-then-subscribe order
  // matters: the seed read below would otherwise ALSO notify the fresh
  // subscription and double-fire the initial slot. Consumers like
  // `Reorder.Item` need that initial slot to register with their group
  // before the first layout change.
  $effect(() => {
      if (!(element && onLayoutMeasureProp && motionDomProjection)) return
      // Seed from the adapter's cache (mount() already ran seedLayout());
      // fall back to a fresh read only when no cached rect exists yet.
      const seed = motionDomProjection.lastMeasuredRect ?? measureLayoutRect()
      const off = motionDomProjection.onMeasure((rect) => onLayoutMeasureProp(boxFromRect(rect)))
      if (seed) {
          onLayoutMeasureProp(boxFromRect(seed))
      }
      return () => {
          off()
      }
  })
  ```

  Two leaks:
  1. The seed call `onLayoutMeasureProp(boxFromRect(seed))` runs directly in
     this effect's tracking scope.
  2. The `onMeasure` listener is called synchronously by the adapter from
     whichever effect asked for a measurement. One such caller is the layout
     observer effect at about line 3138, whose line 3170 is
     `setLastRect(motionDomProjection?.refreshLayout() ?? measureLayoutRect())`.

- `src/lib/utils/motionDomProjection.ts`: the adapter. Listeners are invoked
  synchronously at lines 1651 and 1719:
  `for (const listener of this.measureListeners) listener(rect)`.
  `onMeasure` is defined at line 1740. Do not edit this file.

- Upstream reference (`~/Github/motion`, tag `v14.12.0`,
  `packages/motion-dom/src/projection/node/create-projection-node.ts:1085-1092`):

  ```ts
  this.notifyListeners("measure", this.layout.layoutBox)

  const { visualElement } = this.options
  visualElement?.notify(
      "LayoutMeasure",
      this.layout.layoutBox,
      prevLayout?.layoutBox
  )
  ```

  It runs in the projection update, not during a React render, so `setState`
  in the callback is allowed.

- The in-repo workaround, `src/routes/tests/layout-dependency/+page.svelte:51-57`:

  ```ts
  // Deliberately NON-reactive (a plain object on `window`, read by the e2e
  // via `page.evaluate`): `onLayoutMeasure` fires from inside layout effects,
  // and writing `$state` there re-enters the measure cycle.
  const rowLayoutMeasures: Record<string, number> = {}
  ```

  Leave this page as it is.

- The internal consumer, `src/lib/components/Reorder/Item.svelte:307`:
  `onLayoutMeasure={(box: LayoutMeasurePayload) => context.registerItem(value, box)}`,
  and `src/lib/components/Reorder/Group.svelte:140-143`:

  ```ts
  registerItem: (value, layout) => {
      itemLayouts.set(value, layout)
      updateDetectedAxis()
  },
  ```

  `updateDetectedAxis()` reads the group's reactive `values`. Today that read
  is tracked by each item's layout effects, by accident. This plan removes the
  accident, so the Reorder suites are part of the gate.

- Test page conventions:
  - Pages live under `src/routes/tests/<area>/<name>/+page.svelte` and are
    linked from `src/routes/+page.svelte` with this shape (lines 270–277):

    ```svelte
    <li>
        <a
            class="text-blue-300 hover:underline"
            href={resolve('/tests/layout-dependency') + searchParams}
        >
            layoutDependency
        </a>
    </li>
    ```

  - Specs live under `e2e/<area>/<name>.spec.ts` and open the page with
    `?@isPlaywright=true`, for example `e2e/layout/layout-dependency.spec.ts`:

    ```ts
    const URL = '/tests/layout-dependency?@isPlaywright=true'
    const waitForMotionReady = async (page: Page, testId: string) => {
        await expect(page.getByTestId(testId)).toHaveAttribute('data-is-loaded', 'ready')
    }
    ```

  - A page a human may open gets a guided tester panel (numbered steps, the
    expected result, a live pass/fail verdict), rendered only when the URL does
    not contain `@isPlaywright=true`. `src/routes/tests/pinch/prop/+page.svelte`
    is the exemplar: it sets
    `isTester = !window.location.search.includes('@isPlaywright=true')` in
    `onMount` and wraps the panel in `{#if isTester}`.

## Commands you will need

| Purpose             | Command                                                              | Expected on success |
| ------------------- | -------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`        | exit 0              |
| Browsers            | `pnpm exec playwright install chromium`                              | exit 0              |
| Build (needed once) | `pnpm build`                                                         | exit 0              |
| Typecheck           | `pnpm check`                                                         | 0 errors            |
| All unit tests      | `pnpm test:only`                                                     | all pass            |
| e2e (own port)      | `PW_PORT=4213 pnpm exec playwright test <paths> --project=chromium`  | see steps           |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                       | no issues           |

Notes:

- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it. Always pass `PW_PORT=4213` (or another free port).
- Playwright builds and previews the app itself; you do not start a server.
- Trunk is the lint and format authority; do not use `pnpm lint` or `prettier`.
- Never use `git stash`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/html/_MotionContainer.svelte` (only the effect at lines 3078–3096,
  plus Step 2b's internal prop: its declaration, its destructure, and one read
  at the top of the layout observer effect)
- `src/lib/components/Reorder/Item.svelte` (Step 2b only: one `$derived` and
  one prop on its `MotionContainer`)
- `src/lib/components/Reorder/Group.svelte` and
  `src/lib/components/Reorder/context.ts` (Step 2b item 5 only: one getter
  and its type member)
- `src/routes/tests/layout/measure-state/+page.svelte` (create)
- `e2e/layout/measure-state.spec.ts` (create)
- `src/routes/+page.svelte` (one new link)
- `.changeset/on-layout-measure-untracked.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/utils/motionDomProjection.ts`. The adapter's fan-out stays
  synchronous; the fix belongs at the subscription.
- `src/lib/components/Reorder/*` other than Step 2b's `Item.svelte` edit.
  Outside Step 2b item 5, don't touch `Group.svelte` or `context.ts`, and
  don't touch any Reorder spec.
- `src/routes/tests/layout-dependency/+page.svelte` and its spec.
- Other user callbacks in `_MotionContainer.svelte` (`onProjectionUpdate`,
  `onLayoutAnimationStart`, gesture callbacks). They were not audited for this
  problem; do not wrap them here.

## Git workflow

- Branch: `advisor/003-on-layout-measure-untracked` from `origin/main`.
- Conventional commits, for example
  `fix(layout): call onLayoutMeasure outside the layout effects' tracking scope`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a test page and a failing e2e spec

Create `src/routes/tests/layout/measure-state/+page.svelte`:

- Import `motion` from `$lib` the same way the neighbouring pages under
  `src/routes/tests/layout/` do.
- State: `let measures = $state(0)`, `let lastBox = $state<string>('none')`,
  `let wide = $state(false)`.
- One element:

  ```svelte
  <motion.div
      layout
      data-testid="box"
      style="width: {wide ? 240 : 120}px; height: 80px;"
      onLayoutMeasure={(box) => {
          measures += 1
          lastBox = `${Math.round(box.x.max - box.x.min)}x${Math.round(box.y.max - box.y.min)}`
      }}
  />
  ```

  `measures += 1` both reads and writes `$state` inside the callback. That is
  the pattern that loops today.

- Render `<output data-testid="measures">{measures}</output>` and
  `<output data-testid="last-box">{lastBox}</output>`, and a button
  `data-testid="toggle"` that flips `wide`.
- Add a guided tester panel, shown only when the URL lacks
  `@isPlaywright=true` (copy the `isTester` mechanism from
  `src/routes/tests/pinch/prop/+page.svelte`). Content: step 1 "Load the
  page", step 2 "Press Toggle a few times"; expected "The count goes up by a
  small number per press and the size reads 120x80 or 240x80. The page never
  freezes"; a live verdict that shows PASS while `measures` is between 1 and
  50 and FAIL above 50. No upstream twin page is needed: this is a regression
  page, not a visual sign-off page.

Link it from `src/routes/+page.svelte`, directly after the `layoutDependency`
item (lines 269–277), with the text
`onLayoutMeasure writing $state` and
`href={resolve('/tests/layout/measure-state') + searchParams}`.

Create `e2e/layout/measure-state.spec.ts` with one `test.describe` and these
tests. Collect page errors and console errors from before `page.goto`:

```ts
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
})
```

1. **mounts without an effect loop**: go to
   `/tests/layout/measure-state?@isPlaywright=true`, wait for
   `data-is-loaded="ready"` on `box`, then use `expect.poll` to wait until
   `measures` is at least 1. Assert no collected error contains
   `effect_update_depth_exceeded`, and `measures` is at most 5.
2. **a layout change reports once or twice, not unbounded**: read `measures`,
   click `toggle`, poll until `last-box` reads `240x80`, assert the count grew
   by at least 1 and at most 5, and again no `effect_update_depth_exceeded`.

Do not use `waitForTimeout`; use `expect.poll` and locator assertions.

**Verify**:
`PW_PORT=4213 pnpm exec playwright test e2e/layout/measure-state.spec.ts --project=chromium`
→ test 1 FAILS, either because an error containing
`effect_update_depth_exceeded` was collected or because `measures` exceeds 5.

If both tests pass on the unmodified library, the reproduction is wrong: STOP
and report what `measures` read and which errors were collected.

### Step 2: Call the consumer's callback under `untrack`

In `src/lib/html/_MotionContainer.svelte`, change only the effect quoted in
"Current state" so both call paths run the consumer's callback untracked:

```svelte
$effect(() => {
    if (!(element && onLayoutMeasureProp && motionDomProjection)) return
    const notify = onLayoutMeasureProp
    // Seed from the adapter's cache (mount() already ran seedLayout());
    // fall back to a fresh read only when no cached rect exists yet.
    const seed = motionDomProjection.lastMeasuredRect ?? measureLayoutRect()
    // Untracked on both paths: the adapter calls listeners synchronously from
    // whichever effect measured, and a consumer that reads and writes `$state`
    // here would otherwise re-run that effect. Upstream notifies from the
    // projection update, outside any render
    // (create-projection-node.ts:1085-1092 @ v14.12.0).
    const off = motionDomProjection.onMeasure((rect) =>
        untrack(() => notify(boxFromRect(rect)))
    )
    if (seed) {
        untrack(() => notify(boxFromRect(seed)))
    }
    return () => {
        off()
    }
})
```

Keep the existing explanatory comment above the effect. Keep the
measure-then-subscribe order exactly as it is. The effect must still depend on
`element`, `onLayoutMeasureProp` and `motionDomProjection`, so read them in the
tracked part as shown.

**Verify**:
`PW_PORT=4213 pnpm exec playwright test e2e/layout/measure-state.spec.ts --project=chromium`
→ both tests PASS.

### Step 2b: Make Reorder's re-measure on reorder explicit (2026-11-21 amendment)

**Why.** Before this plan, the observer effect's reads inside the
`onMeasure` listener included `Reorder.Group`'s `values`, through
`registerItem` → `updateDetectedAxis` → `getMeasuredOrder()`. So every
`Reorder.Item`'s layout observer effect restarted on every reorder. That
re-measured every slot synchronously: it called `refreshLayout()`, then the
listener, then `registerItem`. The keyed-move code in that effect is written
around this restart; see its comment "A keyed each update reassigns every
child's props … restarts this effect".

Upstream gets the same result explicitly. A reorder re-renders every item,
and each item's projection re-measures in that commit. With Step 2 alone,
slots only update on the later MutationObserver commit.
`e2e/reorder/keyboard-grid.spec.ts` "arrows move the item the way they
point" then fails 3/3, because a grid move reads a stale slot.

Restore the restart explicitly, for Reorder only:

1. **Declare the internal prop.** In `src/lib/html/_MotionContainer.svelte`,
   in the props type, directly after the `__motionKind` member, add:

   ```ts
           /**
            * @internal Set by `Reorder.Item`: a value that changes whenever its
            * group's order changes. The layout observer effect reads it, so
            * every item re-measures its slot in the same flush as a reorder, as
            * upstream re-measures every re-rendered item in that commit.
            */
           __layoutRemeasureKey?: unknown
   ```

2. **Destructure it.** In the `let { … } = $props()` destructure, directly
   after `__motionKind: motionKindProp = 'motion',`, add
   `__layoutRemeasureKey: layoutRemeasureKeyProp,`.

3. **Read it in the observer effect.** In the layout observer `$effect`
   (the one whose body starts with `const observedElement = element`, about
   line 3141), add this line immediately before `const observedElement = element`:

   ```ts
           // Reorder.Item's order key (Step 2b): a reorder restarts this effect
           // so the slot is re-measured now, not on the next MutationObserver.
           void layoutRemeasureKeyProp
   ```

4. **Pass the key from the item.** In `src/lib/components/Reorder/Item.svelte`,
   add a derived near the other context-derived values:

   ```ts
       /**
        * A fresh object whenever the group's order changes (`trackOrder` reads
        * every entry of `values`), passed to `MotionContainer` so this item
        * re-measures its slot in the same flush as the reorder.
        */
       const layoutRemeasureKey = $derived.by(() => {
           context.trackOrder()
           return {}
       })
   ```

   Then add `__layoutRemeasureKey={layoutRemeasureKey}` to its
   `<MotionContainer …>`, directly after `__motionKind={context.kind}`.

5. **(Round 3, 2026-11-21) Key only groups that auto-detect their axis.**
   The leak only ever restarted items in a group without an `axis` prop:
   `updateDetectedAxis()` reads `values` only `if (axisOverride === undefined)`
   (`Group.svelte` about line 114). Restarting items in an `axis`-locked group
   is new, and it makes a held item drift about 19px on each swap in
   `e2e/reorder/basic.spec.ts` "keeps a held item pinned during upward swaps
   after earlier reversals" (`axis="y"`). Restore the exact old condition:
   - In `src/lib/components/Reorder/context.ts`, in `ReorderContextProps`,
     after `readonly axis: ReorderAxis`, add:

     ```ts
         /**
          * Whether the group detects its axis from its items' layouts (no
          * `axis` prop). Items only re-measure on a reorder then (plan 003).
          */
         readonly detectsAxis: boolean
     ```

   - In `src/lib/components/Reorder/Group.svelte`, in the `context` object,
     after the `get axis()` getter, add:

     ```ts
             get detectsAxis() {
                 return axisOverride === undefined
             },
     ```

   - In `Item.svelte`, change the derived to:

     ```ts
         const layoutRemeasureKey = $derived.by(() => {
             if (!context.detectsAxis) return undefined
             context.trackOrder()
             return {}
         })
     ```

     and update its JSDoc: it changes on every order change only in a group
     that detects its axis, matching which items the old accidental
     dependency restarted.

   - Fake contexts in specs that build a `ReorderContextProps` with a cast
     (`as unknown as ReorderContextProps`) need no change. If `pnpm check`
     reports a typed fake context missing `detectsAxis`, STOP and report it.
     Don't edit specs.

`trackOrder` already exists.

**Verify**:

- `PW_PORT=4213 pnpm exec playwright test e2e/reorder/basic.spec.ts --project=chromium --repeat-each=3`
  → all pass. It failed 3/3 with items 1–4 alone.
- `PW_PORT=4213 pnpm exec playwright test e2e/reorder/keyboard-grid.spec.ts --project=chromium`
  → all pass. It failed 3/3 with Step 2 alone.
- `pnpm exec vitest run src/lib/components/Reorder` → all pass, including
  `reorder.component.spec.ts` "projects each newly displaced sibling across
  sequential keyed reorders", unchanged. With the restart back, its commits
  come from the restart path again.
- `PW_PORT=4213 pnpm exec playwright test e2e/layout/measure-state.spec.ts --project=chromium`
  → still passes. The key is a prop, so the consumer's callback stays
  untracked.

If either Reorder spec still fails, STOP and report it. Don't edit the
specs.

### Step 3: Prove Reorder and layout still work

Reorder registers every item's slot through this callback, and until now each
item's layout effects re-ran whenever the group's `values` changed.

```bash
pnpm exec vitest run src/lib/components/Reorder src/lib/utils/motionDomProjection.spec.ts src/lib/utils/layout.spec.ts
PW_PORT=4213 pnpm exec playwright test e2e/reorder e2e/layout e2e/layout-id e2e/projection --project=chromium
```

**Verify**: all pass. For an e2e failure, re-run that one spec alone once. If a
Reorder spec fails again (a drag no longer swaps items, keyboard reordering
stalls, a slot is stale after `values` changes), STOP and report the spec name
and assertion. Do not edit Reorder and do not loosen the spec. Plan 012 is meant to make
Reorder independent of this leak, so a failure here means 012 missed a path.

### Step 4: Changeset

Create `.changeset/on-layout-measure-untracked.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`onLayoutMeasure` now runs outside the library's internal effects, as in Motion. A callback that reads and writes `$state` (for example a counter or a record of boxes) no longer triggers `effect_update_depth_exceeded`.
```

### Step 5: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, the two e2e commands from Steps 2
and 3 once more, then `trunk fmt` and `trunk check` on the six in-scope files,
then `git diff --check`.

**Verify**: every command exits 0; `trunk check` reports no issues.

## Test plan

- Red first: `e2e/layout/measure-state.spec.ts` test 1 fails on current code
  with `effect_update_depth_exceeded` (or an unbounded count) and passes after
  Step 2. An e2e spec is used because the loop needs a real projection adapter
  and real layout, which jsdom does not provide.
- New tests: the two cases in `e2e/layout/measure-state.spec.ts`.
- Regression guard for the internal consumer: the existing Reorder unit and
  e2e suites (Step 3).
- Pattern: `e2e/layout/layout-dependency.spec.ts` for URL and readiness;
  `src/routes/tests/pinch/prop/+page.svelte` for the tester panel.

## Done criteria

- [ ] `PW_PORT=4213 pnpm exec playwright test e2e/layout/measure-state.spec.ts --project=chromium` exits 0
- [ ] `PW_PORT=4213 pnpm exec playwright test e2e/reorder e2e/layout e2e/layout-id e2e/projection --project=chromium` exits 0
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `grep -c "measure-state" src/routes/+page.svelte` prints `1`
- [ ] `grep -c "waitForTimeout" e2e/layout/measure-state.spec.ts` prints `0`
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the six in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 spec passes on the unmodified library.
- The effect at lines 3078–3096 does not match the excerpt.
- Any Reorder, layout, layoutId or projection spec fails after Step 2 and
  passes without it.
- The fix seems to need a change in `motionDomProjection.ts`, or in Reorder
  beyond Step 2b.

## Maintenance notes

- Related finding, not fixed here: a `Reorder.Item` registers its element once
  at init (`Reorder/Item.svelte:162-163`), so replacing an item's value object
  under a stable key drops it from keyboard navigation. If Step 3 exposes a
  Reorder regression, that finding and this one should be planned together.
  Both are in the batch README.
- Reviewer: confirm the tracked reads (`element`, `onLayoutMeasureProp`,
  `motionDomProjection`) are still outside `untrack`, so swapping the callback
  prop still re-subscribes.
- Once this lands, the `window`-object workaround in
  `src/routes/tests/layout-dependency/+page.svelte` could become plain
  `$state`. That is optional cleanup and was left out to keep the diff small.
- The Motion 14.14.0 bump does not touch this effect, but it edits
  `_MotionContainer.svelte` often; expect a rebase, not a conflict in these
  lines.
