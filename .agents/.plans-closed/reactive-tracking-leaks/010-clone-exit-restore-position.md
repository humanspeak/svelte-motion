# Plan 010: A clone exit puts the parent's inline `position` back when it ends

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/utils/presence.ts src/lib/utils/presence.spec.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition. A change made by plan 005 (the
> `AnimatePresenceContext` type and the object returned at the end of
> `createAnimatePresenceContext`) is expected and is not a mismatch.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

When a keyed `motion.*` child of `<AnimatePresence>` (mode `sync` or `wait`)
leaves, svelte-motion animates a clone of it, absolutely positioned against
the nearest ancestor that generates a box. If that ancestor is `static`, the
exit writes `position: relative` onto its inline style and never takes it
off. From the first exit on, that ancestor is a containing block for good, so
the app's own absolutely positioned descendants (a badge, a tooltip, an
overlay that was meant to sit against some outer `relative` element) jump to
a new place, long after every animation has ended. Upstream Motion never
writes an ancestor's style at all. After this plan the write is held only
while a clone that needs it is on screen, and the original inline value
(including "no value") comes back when the last such clone goes.

## Current state

All code is in `src/lib/utils/presence.ts` (3019 lines at `a33531a2`), inside
`createAnimatePresenceContext` unless noted.

- **The write**, in `unregisterChild`, lines 2369–2409. The clone's
  containing block is found by walking up past `display: contents`
  ancestors, then forced to `relative` when static:

  ```ts
  // line 2373
  const slotParent = insertionParent
  let positioningParent = slotParent

  // Walk up to find a parent that has actual layout (not display: contents).
  // A `display: contents` element generates no box, so it can never be
  // the clone's containing block: whatever this walk finds is.
  while (positioningParent && positioningParent !== doc.body) {
      const parentDisplay = getComputedStyle(positioningParent).display
      if (parentDisplay !== 'contents') {
          break
      }
      positioningParent = positioningParent.parentElement ?? doc.body
  }
  ...
  // line 2401
  const parentRect =
      popLayoutSnapshot || held ? undefined : positioningParent.getBoundingClientRect()

  if (!popLayoutSnapshot && !held) {
      const parentPosition = getComputedStyle(positioningParent).position
      if (parentPosition === 'static') {
          positioningParent.style.position = 'relative'
      }
  }
  ```

  Only a non-held exit with no `popLayout` snapshot (in practice `sync` and
  `wait` clone exits) takes this branch; its clone is then placed with
  `clone.style.position = 'absolute'` and `top`/`left` relative to
  `parentRect` (lines 2474–2479). There is no `return` between line 2404 and
  the creation of `activeExit` at line 2572.

- **The four places a clone leaves the DOM**. None of them touches the
  parent's `position`:
  1. `completeExit` (defined at line 2601) — normal end of the exit:
     `clone.style.zIndex = ''` then `clone.remove()` at line 2614.
  2. `startExitAnimation` (line 2676), the branch where `resolveExit`
     returns nothing and the child is not held, lines 2685–2692:

     ```ts
     releaseActiveExit()
     clone.remove()
     removeExitPlaceholder(key, placeholder)
     ```

  3. `takeExitHandoff` (line 2797) — a re-entering element claims the exit:
     `active.clone.remove()` at line 2815, then `if (active.started) cancelExit()`.
  4. `dispose` (line 2835) — the boundary is torn down; inside
     `for (const active of activeExits.values()) { ... active.clone.remove() }`
     at line 2850.

- **The `ActiveExit` record**, lines 1805–1823:

  ```ts
  type ActiveExit = {
      clone: HTMLElement
      child: PresenceChild
      placeholder: HTMLElement | null
      ...
      /** The completion tail ran. */
      completed?: boolean
  }
  ```

  It is created at line 2572:
  `const activeExit: ActiveExit = { clone, child, placeholder, cancelled: false, holds: [] }`.

- **Exemplar to copy: `suppressScrollAnchoring`** (module level, lines
  492–543). It already solves the same problem for another style property:
  a module-level `WeakMap` refcount shared by overlapping holds, the
  element's own inline value saved on the first hold and put back on the
  last release, and a value the app wrote during the hold left alone:

  ```ts
  /** Elements {@link suppressScrollAnchoring} holds, with their own inline value. */
  const anchoringSuppressions = new WeakMap<HTMLElement, { count: number; inline: string }>()
  ...
  export const suppressScrollAnchoring = (element: HTMLElement): void => {
      const held = anchoringSuppressions.get(element)
      if (held) {
          held.count += 1
      } else {
          anchoringSuppressions.set(element, { count: 1, inline: element.style.overflowAnchor })
          element.style.overflowAnchor = 'none'
      }
      const release = () => {
          const hold = anchoringSuppressions.get(element)
          if (!hold || --hold.count > 0) return
          anchoringSuppressions.delete(element)
          // A value the app wrote during the hold is its own; keep it.
          if (element.style.overflowAnchor === 'none') element.style.overflowAnchor = hold.inline
      }
      ...
  }
  ```

  Its tests are the first `describe` in `src/lib/utils/presence.spec.ts`
  (`describe('suppressScrollAnchoring (plan 012 A6)', …)`, lines 84–139).
  The refcount must be module level, not per context: two sibling
  `AnimatePresence` boundaries (each a `display: contents` div) can share one
  positioning parent.

- **Overlap trap**. Once the first exit has written `relative`, a second exit
  under the same parent reads `getComputedStyle(...).position === 'relative'`
  and, with today's check, would take no hold. If the first exit then
  restored the parent, the second clone would jump mid-animation. The new
  check must also join an existing hold, not only a `static` parent.

- **Upstream (`~/Github/motion`, tag `v14.14.0`)**: there is no equivalent
  write. In `sync` and `wait` the exiting element stays in its slot until its
  exit ends (`packages/framer-motion/src/components/AnimatePresence/index.tsx:153-181`
  re-inserts exiting children into the rendered list), so nothing needs a
  containing block. `popLayout` pins the element itself through an injected
  `<style>` rule (`position:absolute!important` plus offsets measured against
  its `offsetParent`, `PopChild.tsx:159-170`) and removes it on cleanup
  (`PopChild.tsx:238-243`); the comment at `PopChild.tsx:172-180` gives the
  reason: "apply this explicit sizing in a non-destructive manner by just
  deleting the style block". So this is a Svelte-only clone-path artifact,
  and the invariant to hold is upstream's: **an `AnimatePresence` exit leaves
  no style on any ancestor once it is over.** Here: the positioning parent's
  inline `position` differs from its pre-exit value only while at least one
  non-held, non-`popLayout` clone placed against it is still in the DOM.

- **Existing spec that pins the old end state**: `src/lib/utils/presence.spec.ts:366-378`,
  "forces parent position to relative when static". It asserts
  `parent.style.position === 'relative'` after two `await Promise.resolve()`.
  The mocked `animate` (line 52) returns an already resolved `finished`, so
  with this plan's fix the exit has completed (and restored the value) by the
  time it asserts. That test is updated in Step 3; it is the only existing
  spec that should need a change. `presence.spec.ts:1468`
  (`expect(host.style.position).toBe('relative')`) asserts synchronously
  while the exit runs and must stay green unchanged.

## Commands you will need

| Purpose             | Command                                                              | Expected on success |
| ------------------- | -------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`        | exit 0              |
| Build (needed once) | `pnpm build`                                                         | exit 0              |
| Typecheck           | `pnpm check`                                                         | 0 errors            |
| One unit file       | `pnpm exec vitest run src/lib/utils/presence.spec.ts`                | see steps           |
| All unit tests      | `pnpm test:only`                                                     | all pass            |
| e2e (own port)      | `PW_PORT=4220 pnpm exec playwright test <paths> --project=chromium`  | all pass            |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                       | no issues           |

Notes:

- Node 24, pnpm 12.6.0. Run `pnpm build` once before the first `vitest` run
  on a fresh checkout.
- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it, and never set `PW_REUSE_SERVER`. Always pass `PW_PORT=4220`.
- Trunk is the lint and format authority; do not use `pnpm lint` or
  `prettier`.
- Never use `git stash` (the stash is shared across worktrees).

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/presence.ts`, only these regions:
  - a new module-level helper `holdContainingBlock` and its `WeakMap`,
    placed directly after `suppressScrollAnchoring`;
  - the `ActiveExit` type (one new optional field);
  - the `if (!popLayoutSnapshot && !held) { … }` block in `unregisterChild`
    and the `activeExit` creation line;
  - one added line in each of: `completeExit`, the no-exit branch of
    `startExitAnimation`, `takeExitHandoff`, and the `activeExits` loop in
    `dispose`.
- `src/lib/utils/presence.spec.ts` (new `describe` block; the one existing
  case at lines 366–378 updated as Step 3 says)
- `.changeset/clone-exit-restore-position.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- The `AnimatePresenceContext` type and the object returned at the end of
  `createAnimatePresenceContext`: plan 005 edits both.
- `startExit`, `finishExit`, `cancelExit`, `scheduleExitComplete`, and every
  read of `mode`: plan 011 (wave 2) edits those.
- The `popLayout` and held placement paths (`applyPopStyles`, the `held`
  branch at lines 2441–2472). They never write the parent and must not start
  to.
- `src/lib/components/PresenceChild.svelte` (plan 005), which has its own pop
  mechanism.
- `suppressScrollAnchoring` itself. Copy its shape; do not refactor it into a
  shared helper in this plan.

## Git workflow

- Branch: `advisor/010-clone-exit-restore-position`, in a worktree you create
  by hand from the commit that contains this plan (not from `origin/main`,
  which does not have the plan folder).
- Conventional commits, for example
  `fix(presence): restore the parent's inline position after a clone exit`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing specs

Append a new top-level block to the end of `src/lib/utils/presence.spec.ts`:
`describe('clone exit containing block (plan 010)', () => { … })`. Reuse the
file's existing imports and helpers (`createAnimatePresenceContext`,
`animate` from the mocked `motion`, `makeRect`, `mockComputedStyle`); add
`holdContainingBlock` to the import list from `./presence` only in Step 2.

Setup (`beforeEach`), modelled on `describe('presence context', …)` at line
141:

```ts
let parent: HTMLElement
let el: HTMLElement
let el2: HTMLElement
const deferred = () => {
    let resolve!: () => void
    const promise = new Promise<void>((r) => (resolve = r))
    return { promise, resolve }
}
const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    parent = document.createElement('div')
    document.body.appendChild(parent)
    el = document.createElement('div')
    el2 = document.createElement('div')
    parent.append(el, el2)
    for (const node of [el, el2]) {
        vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(makeRect(10, 20))
    }
    vi.spyOn(parent, 'getBoundingClientRect').mockReturnValue(makeRect(0, 0, 200, 200))
    // Computed position follows the inline value, so the second exit sees
    // the first one's write, as in a browser.
    vi.spyOn(window, 'getComputedStyle').mockImplementation((target) =>
        mockComputedStyle({
            position: (target as HTMLElement).style?.position || 'static',
            display: 'block',
            boxSizing: 'border-box'
        })
    )
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
        cb(0)
        return 1
    })
})
```

Start each exit as the existing specs do: `ctx.registerChild('a', el, { opacity: 0 })`,
then `el.remove()`, then `ctx.unregisterChild('a')`. Control when an exit
ends with
`vi.mocked(animate).mockReturnValueOnce({ finished: d.promise, stop: vi.fn() } as never)`
before the `unregisterChild` call, then `d.resolve(); await flush()`.

Cases (each creates its own context with `createAnimatePresenceContext({ mode: 'sync' })`):

1. **restores an empty inline value after the exit completes**: parent has no
   inline `position`. After `unregisterChild`, expect
   `parent.style.position` to be `'relative'`. Resolve, flush. Expect `''`.
2. **restores an explicit inline `static`**: set `parent.style.position = 'static'`
   first. During the exit `'relative'`; after it, `'static'`.
3. **overlapping exits share one hold**: two deferreds (two
   `mockReturnValueOnce` calls), exits for `el` (key `a`) and `el2` (key
   `b`). Resolve `a`, flush: still `'relative'`. Resolve `b`, flush: `''`.
4. **the second exit holds even though the parent already reads relative**:
   same as case 3, but resolve `b` first, then `a`. After `b`: `'relative'`;
   after `a`: `''`.
5. **a reversed exit restores**: one deferred exit, then
   `ctx.takeExitHandoff('a')`. Expect `''` immediately (no flush needed).
6. **boundary disposal restores**: one deferred exit, then `ctx.dispose()`.
   Expect `''` immediately.
7. **an exit with nothing to animate restores**: register with no static
   exit and a resolver that returns nothing:
   `ctx.registerChild('a', el, undefined, undefined, () => undefined)`
   (`resolveExit` is the fifth argument; see `registerChild` at line 2022.
   A static `exit` would be used as the fallback, so it must be
   `undefined`).
   With the synchronous `requestAnimationFrame` mock the clone is created and
   removed inside `unregisterChild`. Expect no `[data-clone="true"]` and
   `parent.style.position` `''`.
8. **keeps a value the app wrote during the exit** (guard): during the exit
   set `parent.style.position = 'sticky'`; after it, still `'sticky'`.
9. **never touches an already positioned parent** (guard): set
   `parent.style.position = 'absolute'`; it is `'absolute'` during and after.
10. **a popLayout exit leaves the parent alone** (guard):
    `createAnimatePresenceContext({ mode: 'popLayout' })`; during and after
    the exit, `parent.style.position` is `''`.

**Verify**: `pnpm exec vitest run src/lib/utils/presence.spec.ts -t "plan 010"`
→ cases 1–7 FAIL with `expected 'relative' to be ''` (case 2:
`expected 'relative' to be 'static'`). Cases 8–10 PASS.

If case 1 passes on the unmodified code, the reproduction is wrong: STOP and
report. If case 7 fails for a reason other than the position value (for
example the clone is still present), record the actual failure and continue;
it must pass after Step 2.

### Step 2: Add the hold and release it wherever the clone leaves

In `src/lib/utils/presence.ts`:

1. Directly after `suppressScrollAnchoring` (ends at line 543), add:

   ```ts
   /** Containing blocks {@link holdContainingBlock} holds, with their own inline value. */
   const containingBlockHolds = new WeakMap<
       HTMLElement,
       { count: number; inline: string; priority: string }
   >()

   /**
    * Make `element` the containing block of an absolutely positioned exit
    * clone for as long as the clone is on screen. A `static` element gets
    * `position: relative`; an element another clone already holds joins
    * that hold (it reads `relative` now, because of it). Overlapping holds
    * share one write, and the element's own inline value and priority come
    * back when the last one is released, unless the app wrote its own value
    * in the meantime. Any other element is left alone.
    *
    * Upstream never writes an ancestor's style: its `sync` and `wait` exits
    * keep the element in its slot, and `popLayout` pins the element itself
    * with a removable `<style>` rule (`PopChild.tsx:159-180,238-243` @
    * v14.14.0). Only svelte-motion's clone exit needs a containing block, so
    * the write must not outlive the clone.
    *
    * @param element The clone's positioning parent (it generates a box).
    * @param computedPosition `getComputedStyle(element).position`, read now.
    * @returns An idempotent release; a no-op when nothing was held.
    *
    * @example
    * ```ts
    * const release = holdContainingBlock(parent, getComputedStyle(parent).position)
    * // ... the clone animates out ...
    * clone.remove()
    * release()
    * ```
    */
   export const holdContainingBlock = (
       element: HTMLElement,
       computedPosition: string
   ): (() => void) => {
       const held = containingBlockHolds.get(element)
       if (held) {
           held.count += 1
       } else if (computedPosition === 'static') {
           containingBlockHolds.set(element, {
               count: 1,
               inline: element.style.position,
               priority: element.style.getPropertyPriority('position')
           })
           element.style.position = 'relative'
       } else {
           return () => {}
       }
       let released = false
       return () => {
           if (released) return
           released = true
           const hold = containingBlockHolds.get(element)
           if (!hold || --hold.count > 0) return
           containingBlockHolds.delete(element)
           // A value the app wrote during the hold is its own; keep it.
           if (element.style.position !== 'relative') return
           element.style.setProperty('position', hold.inline, hold.priority)
       }
   }
   ```

   (`setProperty('position', '', …)` removes the declaration, which is what
   restoring an empty inline value means.)

2. In the `ActiveExit` type, after `completed?: boolean`, add:

   ```ts
   /** Gives the positioning parent back its own `position` (plan 010). */
   releaseContainingBlock?: () => void
   ```

3. Replace the block at lines 2404–2409 with:

   ```ts
   // Released wherever the clone leaves the DOM (plan 010).
   const releaseContainingBlock =
       !popLayoutSnapshot && !held
           ? holdContainingBlock(
                 positioningParent,
                 getComputedStyle(positioningParent).position
             )
           : undefined
   ```

   and change the `activeExit` creation at line 2572 to
   `const activeExit: ActiveExit = { clone, child, placeholder, cancelled: false, holds: [], releaseContainingBlock }`.

4. Add `activeExit.releaseContainingBlock?.()` directly after `clone.remove()`
   in `completeExit` (line 2614) and directly after `clone.remove()` in the
   no-exit branch of `startExitAnimation` (line 2687).
5. Add `active.releaseContainingBlock?.()` directly after
   `active.clone.remove()` in `takeExitHandoff` (line 2815) and inside the
   `for (const active of activeExits.values())` loop in `dispose`
   (line 2850).

Always release after the clone is removed, so the clone never renders a
frame against a different containing block.

**Verify**: `pnpm exec vitest run src/lib/utils/presence.spec.ts -t "plan 010"`
→ all 10 cases pass. Then `grep -n "positioningParent.style.position" src/lib/utils/presence.ts`
→ no output.

### Step 3: Update the spec that pinned the old end state

In `src/lib/utils/presence.spec.ts`, the case at line 366 ("forces parent
position to relative when static"): move
`expect(parent.style.position).toBe('relative')` to directly after
`ctx.unregisterChild('k')` (the exit is running), keep the two
`await Promise.resolve()` lines, then add `await tick()` followed by
`expect(parent.style.position).toBe('')` (the exit has ended and restored
the value). Note that this describe's
`beforeEach` sets the parent's inline position to `'relative'` and this case
then mocks the computed value as `static`; set `parent.style.position = ''`
at the start of the case so the restored value is unambiguous. Rename the
case to "forces a static parent to relative while the exit runs, then
restores it".

Add `holdContainingBlock` to the `./presence` import list and add two direct
cases to the new plan-010 block, modelled on the `suppressScrollAnchoring`
tests at lines 84–139:

- **restores the inline priority**: `parent.style.setProperty('position', 'static', 'important')`;
  `const release = holdContainingBlock(parent, 'static')`; expect
  `parent.style.position` `'relative'`; `release()`; expect `'static'` and
  `parent.style.getPropertyPriority('position')` `'important'`. If jsdom does
  not report the priority back after `setProperty` (check with a one-line
  probe), drop only the priority assertion and say so in your report.
- **release is idempotent**: two holds, release the first one twice, expect
  `'relative'`; release the second, expect `''`.

**Verify**: `pnpm exec vitest run src/lib/utils/presence.spec.ts` → all pass,
including the cases at lines 366 and 1456 and the 12 new ones.

### Step 4: Changeset

Create `.changeset/clone-exit-restore-position.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

An `AnimatePresence` exit no longer leaves `position: relative` on a statically positioned parent. The parent's own inline `position` comes back once the last exit animating against it ends, is reversed, or its boundary is removed, so the app's absolutely positioned elements stay where they were.
```

### Step 5: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, then

```bash
PW_PORT=4220 pnpm exec playwright test e2e/animate-presence --project=chromium
```

then `trunk fmt` and `trunk check` on the three in-scope files, then
`git diff --check`.

**Verify**: every command exits 0. For an e2e failure, re-run that one spec
alone once. `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` has a
known frame-capture flake under load; if only that spec fails and it passes
alone, record it and continue. Any other repeat failure: STOP and report.

## Test plan

- Red first: Step 1 cases 1–7 fail on current code (the parent keeps
  `relative` after the exit ends, after a re-entry hand-off, after disposal,
  and after an exit with nothing to animate) and pass after Step 2.
- Guards that pass before and after: cases 8–10 (app-written value kept,
  positioned parent untouched, `popLayout` never writes the parent).
- Direct helper cases (Step 3): priority restored, idempotent release.
- Pattern: `describe('suppressScrollAnchoring (plan 012 A6)', …)` and
  `describe('presence context', …)` in `src/lib/utils/presence.spec.ts`.
- Regression: `pnpm test:only` and `e2e/animate-presence` (the
  `clone-parent-styles`, `clone-fidelity`, `grid-exit` and `modes` specs
  exercise clone placement).
- No new test page: the behavior is fully observable in jsdom, and a page
  would add an edit to `src/routes/+page.svelte`, which plan 003 also edits
  in wave 1.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/presence.spec.ts` exits 0 with the 12 new plan-010 cases
- [ ] `grep -n "positioningParent.style.position" src/lib/utils/presence.ts` prints nothing
- [ ] `grep -c "releaseContainingBlock?.()" src/lib/utils/presence.ts` prints `4`
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `PW_PORT=4220 pnpm exec playwright test e2e/animate-presence --project=chromium` exits 0 (or only the known flake, passing when run alone)
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the three in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 case 1 passes on the unmodified code.
- The write at lines 2404–2409, or any of the four `clone.remove()` sites,
  does not match the excerpts (beyond plan 005's expected edits elsewhere in
  the file).
- A `return` now exists between the hold (Step 2.3) and the `activeExit`
  creation: the hold would leak on that path. Report the path instead of
  adding another release.
- After Step 2, any existing spec other than the one at line 366 fails, or an
  e2e spec shows a clone placed differently. Restoring after `clone.remove()`
  must not move any clone.
- The fix seems to need a change to `startExit`, `finishExit`, `cancelExit`,
  the context type or the returned context object.

## Maintenance notes

- **Shared file with plan 005 (wave 1, same file, disjoint regions).** 005
  edits the `AnimatePresenceContext` type (ends around line 1455) and the
  object returned at the end of `createAnimatePresenceContext` (around line
  2869). This plan edits a module-level helper near line 543, the
  `ActiveExit` type near line 1805, and the exit internals at lines
  2404–2850. The hunks do not overlap; whichever lands second rebases with no
  conflict expected. If a conflict appears, keep both sides.
- **Plan 011 (wave 2) depends on this plan for merge order only.** 011 makes
  `mode` reactive and edits `dispose`, `unregisterChild`'s first lines and
  the `mode` reads in the same file. Its popLayout-seeding spec reads
  `parent.style.position` while an exit runs, which this plan does not
  change.
- Invariant to keep: an `AnimatePresence` exit leaves no style on an
  ancestor once it is over (upstream's). Any future clone-path write to an
  ancestor (another property, another mode) should go through a hold like
  `holdContainingBlock` or `suppressScrollAnchoring` and be released at the
  same four sites.
- `.agents/.plans/clone-exit-migration/` plans to move keyed children onto
  the `PresenceChild` path, which keeps the real element in place. When that
  lands, the non-held clone branch and this hold go away with it.
- Reviewer: check that the release always follows `clone.remove()`, that the
  second exit under an already-held parent joins the hold (case 4), and that
  `popLayout` and held exits still never call `holdContainingBlock`.
- Not covered: a positioning parent that is reparented while a clone is on
  it keeps its hold until the clone goes; that is the correct behavior and
  needs no code.
