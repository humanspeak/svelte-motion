# Plan 012: A `Reorder.Item` whose value object is replaced stays focusable, the tab stop and reorderable

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/components/Reorder src/routes/tests/reorder src/routes/+page.svelte e2e/reorder`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (`src/routes/+page.svelte` is also
> edited by plan 003; a change there limited to one new `<li>` link in the
> layout section is expected and is not a mismatch.)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (see Maintenance notes for how this interacts with 003)
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

`Reorder.Group` keys its per-item registries by the item's `value`. A
`Reorder.Item` registers its element getter once, at init. The idiomatic
Svelte list is keyed by an id
(`{#each items as item (item.id)}<Reorder.Item value={item}>`), and an
immutable update such as `items = items.map((i) => (i.id === id ? { ...i, done: true } : i))`
keeps the same item component but hands it a new value object. The group
then prunes the old object's entries and never learns about the new one. The
replaced item drops out of arrow-key focus movement (focus skips it). If it
was the first item, the tab stop silently moves to the next item. Upstream
re-registers on every render (`elements.set(value, ref)` in the render body),
so it has none of this.

The item's measured layout slot has the same keying. Today it happens to be
re-registered under the new object only through an accidental reactive
dependency that plan 003 removes. This plan makes both registrations explicit,
so 003 can land without breaking drag or keyboard reordering of replaced items.

## Current state

- `src/lib/components/Reorder/Item.svelte` (313 lines): one draggable entry.
  - Lines 149–163, the one-shot element registration:

    ```ts
    let element = $state<HTMLElement | null | undefined>(undefined)
    const setElement = (node: HTMLElement | null | undefined) => {
        element = node
        ref = node
    }
    // svelte-ignore state_referenced_locally
    context.elements.set(value, () => element)
    ```

    This runs once, during component init, with the value the item was
    created with. Nothing re-runs it when the `value` prop changes.

  - Lines 165–171, teardown. It reads `value` when the item is destroyed,
    so it already uses the latest value; leave it alone:

    ```ts
    $effect(() => {
        return () => {
            context.unregisterItem(value)
            // The tab stop may have been this item (Motion 14.9.1 `Item.tsx`).
            context.checkTabStop()
        }
    })
    ```

  - Line 307, the layout-slot registration, on the `MotionContainer`:

    ```svelte
    onLayoutMeasure={(box: LayoutMeasurePayload) => context.registerItem(value, box)}
    ```

    This only runs when the element is measured.

  - `untrack` is already imported (line 21: `import { untrack } from 'svelte'`).
    `LayoutMeasurePayload` is already imported (line 24).

- `src/lib/components/Reorder/Group.svelte` (363 lines): the container.
  - Lines 56–57 and 68: `itemLayouts` (`Map<V, Box>`) and `elements`
    (`Map<V, () => HTMLElement | null | undefined>`). Both are plain `Map`s on
    purpose (see the comment at lines 50–55).
  - Lines 72–88, the tab stop:

    ```ts
    const valuesSet = $derived(new Set(values))
    const tabStop = $derived(valuesSet.has(active as V) ? active : values[0])
    const isRendered = (value?: V): boolean => !!elements.get(value as V)?.()?.isConnected
    ...
    const checkTabStop = (): void => {
        if (!isRendered(tabStop)) activate(values.find(isRendered))
    }
    ```

  - Lines 140–143, `registerItem`:

    ```ts
    registerItem: (value, layout) => {
        itemLayouts.set(value, layout)
        updateDetectedAxis()
    },
    ```

    `updateDetectedAxis()` (lines 113–117) reads `values` through
    `getMeasuredOrder()` (lines 90–94).

  - Lines 223–232, arrow keys only move focus between rendered items:

    ```ts
    const list = from ? order : order.filter(({ value }) => isRendered(value))
    const index = list.findIndex(({ value }) => value === item)
    ...
    else elements.get(list[target].value)?.()?.focus()
    ```

  - Lines 277–284, pruning when `values` changes:

    ```ts
    $effect(() => {
        for (const map of [itemLayouts, elements]) {
            map.forEach((_, value) => {
                if (!valuesSet.has(value)) map.delete(value)
            })
        }
        updateDetectedAxis()
    })
    ```

  - Line 291: `$effect(checkTabStop)`.

  Group.svelte needs no change. The prune effect is correct (upstream prunes
  the same way, `Group.tsx:130-133` @ v14.14.0). The defect is that nothing
  adds the new object back.

- Upstream (`~/Github/motion`, tag `v14.14.0`):
  - `packages/framer-motion/src/components/Reorder/Item.tsx:138-142`, in the
    render body, so it runs on every render with the current `value`:

    ```tsx
    /**
     * Keep this item's element for the group to focus.
     */
    elements.set(value, ref)
    useEffect(() => checkTabStop)
    ```

  - `Item.tsx:244-246`: `onLayoutMeasure={(measured) => { registerItem(value, measured, ref) }}`.
    In React every re-render of a `layout` component re-measures it
    (`MeasureLayout` `getSnapshotBeforeUpdate` → `willUpdate`), so a new value
    object is re-registered with a fresh slot on the very render that delivers it.
  - `packages/framer-motion/src/components/Reorder/Group.tsx:130-133`: prune
    per render; `:148-151`: `checkTabStop` in `useEffect`, which runs after
    every item rendered and re-registered.

- **How the layout slot is re-registered today (the accident plan 003 removes).**
  `src/lib/html/_MotionContainer.svelte:3078-3096` subscribes the
  `onLayoutMeasure` prop. Its seed call
  `onLayoutMeasureProp(boxFromRect(seed))` runs inside that `$effect`'s
  tracking scope. Through Item.svelte:307 it calls
  `context.registerItem(value, box)`, which reads the item's `value` prop and,
  via `updateDetectedAxis()` → `getMeasuredOrder()`, the group's `values`. So
  today that effect re-runs whenever `value` or `values` changes, and the
  re-run re-seeds `registerItem(<new value>, <cached rect>)`. That is the only
  thing that puts the replaced item back into the group's order. Plan 003 wraps
  both callback paths in `untrack`, after which nothing re-registers the slot
  until the element's layout happens to change. The element-getter
  registration (`elements`) never depended on that accident: it is broken
  today, with or without 003.

- Test conventions:
  - Reorder unit specs are Vitest + jsdom + `@testing-library/svelte`,
    colocated, with fixtures in `src/lib/components/Reorder/__tests__/`.
    Exemplar: `src/lib/components/Reorder/keyboard.component.spec.ts`
    (its harness: `__tests__/KeyboardHarness.svelte`). Copy its setup:
    the `FakeResizeObserver` stub (lines 16–28), the `getBoundingClientRect`
    mock that gives each `LI` a 50 px slot (lines 30–39), `mount()` with
    `await vi.advanceTimersByTimeAsync(1000)` (lines 57–61), and the `press`,
    `focused`, `tabIndexes` helpers (lines 63–85). Fake timers are installed
    globally by `vitest.setup.ts`.
  - Reorder e2e specs are under `e2e/reorder/`. Exemplars:
    `e2e/reorder/keyboard.spec.ts` (`open()`, `focused()`, `press()`), and
    `e2e/reorder/basic.spec.ts:5-20` (`dragVertically`).
  - Test pages are `src/routes/tests/reorder/<name>/+page.svelte`. Exemplar:
    `src/routes/tests/reorder/keyboard/+page.svelte`, which uses
    `TesterPanel` from `src/routes/tests/layout/_parity/TesterPanel.svelte`
    (the panel renders nothing under `?@isPlaywright=true`).
  - Pages are linked from `src/routes/+page.svelte`. The Reorder links are at
    lines 680–810; the last one (lines 802–809) is:

    ```svelte
    <li>
        <a
            class="text-blue-300 hover:underline"
            href={resolve('/tests/reorder/board') + searchParams}
        >
            Reorder: Board, drag items between groups (Motion 14.10)
        </a>
    </li>
    ```

## Commands you will need

| Purpose        | Command                                                                       | Expected on success |
| -------------- | ----------------------------------------------------------------------------- | ------------------- |
| Install        | `pnpm install --frozen-lockfile --config.engine-strict=false`                 | exit 0              |
| Browsers       | `pnpm exec playwright install chromium`                                       | exit 0              |
| Unit (Reorder) | `pnpm exec vitest run src/lib/components/Reorder`                             | all pass            |
| Typecheck      | `pnpm check`                                                                  | 0 errors            |
| All unit tests | `pnpm test:only`                                                              | all pass            |
| e2e (own port) | `PW_PORT=4222 pnpm exec playwright test <paths> --project=chromium`           | see steps           |
| Format / lint  | `trunk fmt <files>` then `trunk check <files>`                                | no issues           |

Notes:

- Port 4198 is the maintainer's live dev server. Never bind, reuse or kill it.
  Always pass `PW_PORT=4222`. Never set `PW_REUSE_SERVER`. Playwright builds
  and previews the app itself.
- Trunk is the lint and format authority. Do not run `pnpm lint` or prettier.
- Never use `git stash` (the stash is shared across worktrees).

## Scope

**In scope** (the only files you should modify):

- `src/lib/components/Reorder/Item.svelte`
- `src/lib/components/Reorder/__tests__/ObjectValuesHarness.svelte` (create)
- `src/lib/components/Reorder/objectValues.component.spec.ts` (create)
- `src/routes/tests/reorder/immutable-values/+page.svelte` (create)
- `e2e/reorder/immutable-values.spec.ts` (create)
- `src/routes/+page.svelte` (one new `<li>` in the Reorder list)
- `.changeset/reorder-item-reregister.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/components/Reorder/Group.svelte`. Assigned to this plan, but no
  change is needed. If the fix seems to need one, that is a STOP condition.
- `src/lib/html/_MotionContainer.svelte`. Plan 003 owns the `onLayoutMeasure`
  effect. Do not "fix" the leak here.
- `src/lib/components/Reorder/context.ts` and `types.ts`. The context API
  (`registerItem`, `elements`) stays as it is.
- The existing Reorder specs. Do not edit or loosen them.

## Git workflow

- Branch: `advisor/012-reorder-item-reregister`, created by hand from the
  commit that added this plan (not from `origin/main`).
- Conventional commits, for example
  `fix(reorder): re-register an item when its value object is replaced`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Failing unit tests

Create `src/lib/components/Reorder/__tests__/ObjectValuesHarness.svelte`:

```svelte
<script lang="ts">
    /**
     * Object-valued Reorder list keyed by `id`, controlled by the test: it
     * rerenders with new `values`. Replacing an entry with `{ ...entry }`
     * keeps the item component (same key) but gives it a new value object.
     * Only the id is rendered, so a replacement changes no DOM and cannot
     * trigger a re-measure that would hide the bug.
     */
    import { Reorder } from '$lib/reorder'

    type Entry = { id: string; rev: number }

    let {
        values,
        onReorder
    }: {
        values: Entry[]
        onReorder?: (next: Entry[], moved: Entry) => void
    } = $props()
</script>

<Reorder.Group axis="y" {values} onReorder={(next, moved) => onReorder?.(next, moved)} data-testid="group">
    {#each values as entry (entry.id)}
        <Reorder.Item value={entry} data-testid={entry.id}>{entry.id}</Reorder.Item>
    {/each}
</Reorder.Group>
```

Create `src/lib/components/Reorder/objectValues.component.spec.ts`. Copy the
setup from `keyboard.component.spec.ts` lines 1–85 (imports, the
`FakeResizeObserver` stub, the `getBoundingClientRect` mock, and the `item`,
`focused`, `tabIndexes`, `press` helpers), with `mount()` rendering
`ObjectValuesHarness`. Add a file-level comment saying what this covers and
why (immutable updates under a stable key; upstream re-registers per render,
`Item.tsx:141` @ v14.14.0). Build the values once per test:

```ts
const a = { id: 'a', rev: 0 }
const b = { id: 'b', rev: 0 }
const c = { id: 'c', rev: 0 }
```

After every `rerender`, run `await vi.advanceTimersByTimeAsync(1000)` and
`flushSync()`.

Tests, inside `describe('Reorder with replaced value objects', ...)`:

1. **arrow keys still reach a replaced item**: mount with `[a, b, c]`;
   rerender with `[a, b2, c]` where `const b2 = { ...b, rev: 1 }`; focus
   `item('a')`, `flushSync()`, `press(item('a'), 'ArrowDown')`;
   `expect(focused()).toBe('b')`.
2. **a replaced first item stays the tab stop**: mount with `[a, b, c]`;
   `expect(tabIndexes()).toEqual([0, -1, -1])`; rerender with
   `[{ ...a, rev: 1 }, b, c]`; `expect(tabIndexes()).toEqual([0, -1, -1])`.
3. **a replaced item can be grabbed and moved, and reports the new object**:
   `const onReorder = vi.fn()`; mount with `[a, b, c]` and `onReorder`;
   rerender with `[a, b2, c]` (same `onReorder`); `press(item('b'), ' ')`,
   `press(item('b'), 'ArrowDown')`; then
   `const [next, moved] = onReorder.mock.lastCall!`,
   `expect(next.map((e) => e.id)).toEqual(['a', 'c', 'b'])`,
   `expect(next[2]).toBe(b2)`, `expect(moved).toBe(b2)`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/objectValues.component.spec.ts`
→ test 1 FAILS with `expected 'c' to be 'b'`, and test 2 FAILS with
`[-1, 0, -1]` received where `[0, -1, -1]` was expected.

Test 3 is a guard for plan 003, not a reproduction. On a base without 003 it
may pass, because the accidental re-seed in `_MotionContainer.svelte`
re-registers the slot. On a base that already contains 003, it fails (no
`onReorder` call, so `mock.lastCall` is `undefined`). Either result is
acceptable here; record which you saw.

If test 1 or test 2 passes on the unmodified code, STOP and report what
`focused()` and `tabIndexes()` returned.

### Step 2: Re-register the item whenever its value changes

In `src/lib/components/Reorder/Item.svelte`:

1. Replace the one-shot registration (the `// svelte-ignore state_referenced_locally`
   comment and `context.elements.set(value, () => element)`, lines 162–163)
   with a pre-effect that tracks only `value`:

   ```ts
   /**
    * The box this item last measured, kept so a new value object can take
    * over the slot straight away. Plain `let`: written by the measure
    * callback, read untracked.
    */
   let lastLayout: LayoutMeasurePayload | undefined

   /**
    * Register this item's element, and its last measured slot, under its
    * current `value`. Upstream does this on every render
    * (Motion 14.14.0 `Reorder/Item.tsx:141`, and its re-measure re-registers
    * the slot). An immutable update under a stable `{#each}` key keeps this
    * component but changes `value`, and the group prunes the old object, so
    * re-register here. A pre-effect runs before the group's `checkTabStop`
    * and prune effects in the same flush, so the tab stop never sees the new
    * object unregistered. Old entries are left to the group's pruning: the
    * old object may still be in `values` under another item.
    */
   $effect.pre(() => {
       const current = value
       untrack(() => {
           context.elements.set(current, () => element)
           if (lastLayout) context.registerItem(current, lastLayout)
       })
   })
   ```

2. Replace the inline callback at line 307 with a named handler that keeps
   `lastLayout` current. Declare it in the `<script>` next to the other
   handlers:

   ```ts
   const handleLayoutMeasure = (box: LayoutMeasurePayload) => {
       lastLayout = box
       context.registerItem(value, box)
   }
   ```

   and in the markup: `onLayoutMeasure={handleLayoutMeasure}`.

Do not touch the teardown effect at lines 165–171.

Why `untrack` inside the effect: `registerItem` reads the group's `values`
(through `updateDetectedAxis`) and writes `detectedAxis`. Tracking those would
make this effect re-run on every reorder, which is the very accident plan 003
removes elsewhere. The only dependency must be `value`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/objectValues.component.spec.ts`
→ all 3 tests PASS.

### Step 3: Existing Reorder unit suites still pass

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → all pass,
the same count as before plus 3.

If `keyboard.component.spec.ts` or `board.component.spec.ts` fails, first
check initial-mount ordering: the old registration ran synchronously during
init. A `$effect.pre` also runs before the first user effect, so they should
behave the same. If a failure persists, STOP and report the test name and
assertion. Do not restore the old line as well as the effect without
reporting.

### Step 4: Test page and e2e spec

Create `src/routes/tests/reorder/immutable-values/+page.svelte`, modelled on
`src/routes/tests/reorder/keyboard/+page.svelte`:

- `let items = $state([{ id: 'a', rev: 0 }, { id: 'b', rev: 0 }, { id: 'c', rev: 0 }, { id: 'd', rev: 0 }])`.
- `const replace = (id: string) => (items = items.map((i) => (i.id === id ? { ...i, rev: i.rev + 1 } : i)))`.
- `<button id="before">before</button>`, then a
  `<div id="order" data-ready={ready ? '' : undefined}>{items.map((i) => i.id).join(',')}</div>`
  (`ready` is set in `onMount`), then buttons `id="replace-a"` and
  `id="replace-b"` that call `replace('a')` / `replace('b')`.
- The group, a column with `gap: 10px`, `list-style: none; padding: 0`:

  ```svelte
  <Reorder.Group axis="y" values={items} onReorder={(next) => (items = next)} style={groupStyle}>
      {#each items as item (item.id)}
          <Reorder.Item
              value={item}
              id={item.id}
              data-testid={item.id}
              whileDrag={{ opacity: 0.5, transition: { duration: 0 } }}
              transition={{ duration: 0 }}
              style="width: 80px; height: 40px; background: #eee;"
          >
              {item.id} r{item.rev}
          </Reorder.Item>
      {/each}
  </Reorder.Group>
  ```

- A `TesterPanel` with `eyebrow="Svelte port · upstream Item.tsx:141"`,
  `title="Reorder: replaced value objects"`,
  `status="Covered by e2e/reorder/immutable-values.spec.ts."`, a `checks`
  snippet explaining the bug in two sentences, and these steps:
  1. "Click Replace b, click before, press Tab, then ArrowDown." Expected:
     "Focus goes a → b. It must not skip b."
  2. "Reload. Click Replace a, click before, press Tab." Expected: "Focus lands
     on a, the first item."
  3. "Click Replace b, then drag b below c." Expected: "The order reads
     a,c,b,d."
  4. "Click Replace b, focus b, press Space, ArrowDown, Space." Expected: "b
     moves one slot down; the order reads a,c,b,d."

  Add a live `summary` showing `Focused: <id>` (poll `document.activeElement?.id`
  every 100 ms while `isTester`, as the keyboard page does). No upstream twin
  page: upstream has no fixture for this, and the behavior it would show is
  the plain keyboard page's.

Link it from `src/routes/+page.svelte`, directly after the
`/tests/reorder/board` item (lines 802–809), with the text
`Reorder: replaced value objects stay focusable and reorderable` and
`href={resolve('/tests/reorder/immutable-values') + searchParams}`.

Create `e2e/reorder/immutable-values.spec.ts`. Reuse the `focused`, `press`
and `open` helper shapes from `e2e/reorder/keyboard.spec.ts:15-38` (with this
page's URL, `/tests/reorder/immutable-values?@isPlaywright=true`) and
`dragVertically` from `e2e/reorder/basic.spec.ts:5-20`. Tests:

1. **arrow keys reach a replaced item**: open; click `#replace-b`; focus
   `#before`; `Tab` → `focused` is `a`; `ArrowDown` → `focused` is `b`.
2. **a replaced first item stays the tab stop**: open; click `#replace-a`;
   focus `#before`; `Tab` → `focused` is `a`.
3. **a replaced item can still be dragged** (guard for 003): open; click
   `#replace-b`; `dragVertically(page, 'b', 60)` (row pitch is 50 px);
   `expect.poll(() => order(page)).toBe('a,c,b,d')`.
4. **a replaced item can still be moved by keyboard** (guard for 003): open;
   click `#replace-b`; `page.focus('#b')`; `Space`, `ArrowDown`, `Space`;
   `expect.poll(() => order(page)).toBe('a,c,b,d')`.

Use `expect.poll` and locator assertions for waiting. The only
`waitForTimeout` allowed is the 16 ms step inside the copied `dragVertically`.

**Verify (red, on the code before Step 2)**: to see the e2e red, run it once
with Step 2's change temporarily reverted in your working tree
(`git diff src/lib/components/Reorder/Item.svelte > "$TMPDIR/012.patch"`,
`git checkout src/lib/components/Reorder/Item.svelte`, run, then
`git apply "$TMPDIR/012.patch"`; do not use `git stash`):
`PW_PORT=4222 pnpm exec playwright test e2e/reorder/immutable-values.spec.ts --project=chromium`
→ test 1 FAILS (`focused` is `c`, expected `b`) and test 2 FAILS (`focused` is
`b`, expected `a`).

**Verify (green, with Step 2 applied)**: the same command → all 4 tests PASS.

If tests 1 and 2 pass without Step 2's change, STOP and report: the browser
path differs from jsdom and the page needs a closer look.

### Step 5: Reorder e2e regression gate

```bash
PW_PORT=4222 pnpm exec playwright test e2e/reorder e2e/lazy-motion/reorder-lazy-motion.spec.ts e2e/lazy-motion/reorder-strict.spec.ts --project=chromium
```

**Verify**: all pass. For a failure, re-run that one spec alone once. If it
fails again and passes on the code before Step 2, STOP and report the spec
name and assertion.

### Step 6: Changeset

Create `.changeset/reorder-item-reregister.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`Reorder.Item` now re-registers itself when its `value` is replaced by a new object under the same `{#each}` key (for example `items = items.map((i) => (i.id === id ? { ...i, done: true } : i))`). The item stays reachable with the arrow keys, keeps the group's tab stop, and can still be dragged or moved with the keyboard, as in Motion.
```

### Step 7: Full gate

Run `pnpm check`, `pnpm test:only`, the e2e commands from Steps 4 and 5 once
more, then `trunk fmt` and `trunk check` on the seven in-scope files, then
`git diff --check`.

**Verify**: every command exits 0; `trunk check` reports no issues.

## Test plan

- Red first: `objectValues.component.spec.ts` tests 1 and 2 fail on current
  code (`expected 'c' to be 'b'`; tab indexes `[-1, 0, -1]`) and pass after
  Step 2. The matching e2e tests 1 and 2 fail the same way in Chromium.
- Guards for plan 003: unit test 3 and e2e tests 3 and 4. They cover the
  layout-slot registration, which today only works through the accidental
  re-seed in `_MotionContainer.svelte`. They must pass with this plan's fix
  whether or not 003 has landed.
- Patterns: `keyboard.component.spec.ts` + `KeyboardHarness.svelte` for the
  unit setup; `e2e/reorder/keyboard.spec.ts` and `e2e/reorder/basic.spec.ts`
  for the e2e helpers; `src/routes/tests/reorder/keyboard/+page.svelte` for
  the page and tester panel.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/components/Reorder` exits 0, including the 3 new tests
- [ ] `PW_PORT=4222 pnpm exec playwright test e2e/reorder e2e/lazy-motion/reorder-lazy-motion.spec.ts e2e/lazy-motion/reorder-strict.spec.ts --project=chromium` exits 0, including the 4 new tests
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `grep -c "state_referenced_locally" src/lib/components/Reorder/Item.svelte` prints `1` (only the `initialStyle` one at line 82 remains)
- [ ] `grep -c "immutable-values" src/routes/+page.svelte` prints `1`
- [ ] `git diff --stat a33531a2 -- src/lib/components/Reorder/Group.svelte` is empty
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Unit test 1 or 2 passes on the unmodified code.
- The excerpts at `Item.svelte:149-171` / `:307` or `Group.svelte:72-88`,
  `:140-143`, `:277-291` do not match.
- The fix seems to need a change in `Group.svelte`, `context.ts`, or
  `_MotionContainer.svelte`.
- An existing Reorder unit or e2e spec fails after Step 2 and passes without it.
- `$effect.pre` is rejected by `pnpm check` or the Svelte compiler in this
  file.

## Maintenance notes

- **Relation to plan 003 (no hard dependency, either order works).** 012 does
  not need any code from 003: the element-getter bug is present today, and the
  explicit slot re-registration added here works whether or not the accidental
  re-seed in `_MotionContainer.svelte:3078-3096` still exists. While both
  paths exist (012 landed, 003 not yet), a replaced item is registered twice
  with the same box, which is harmless. The reverse matters: 003 alone would
  regress drag and keyboard moves of replaced items, and no existing Reorder
  spec would catch it (none uses object values replaced under a stable key).
  So 012 should land before 003, or in the same release. The 2.14.1 batch
  ships both. A reviewer of 003 should know that 012's unit test 3 and e2e
  tests 3 and 4 are the guards for that path.
- **Shared file**: `src/routes/+page.svelte` also gets one new `<li>` from
  003 (layout list, near line 277) and from 006, 007, 011 and 014 (their own
  sections). This plan adds its link in the Reorder list, after line 809, so a
  rebase merges it without conflict.
- The re-registered slot is the last measured box, not a fresh measurement.
  If the replacement also changes the item's size, the next layout
  measurement (the projection's layout observer) overwrites it, as before.
  Upstream re-measures on the same render. If drag after a size-changing
  replacement is ever off by one slot, re-measure in the pre-effect instead.
- Reviewer: check that the pre-effect's only tracked read is `value`, and
  that the teardown effect still unregisters the latest value.
- Not changed, same as upstream: when the item that holds the tab stop (the
  last focused one) is replaced, `active` still points at the old object, so
  the tab stop falls back to `values[0]` (`Group.tsx:135` does the same).
