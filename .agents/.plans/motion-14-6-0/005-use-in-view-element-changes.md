# Plan 005: Reset `useInView` when the observed element is removed or swapped

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4205** (`PW_PORT=4205`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/utils/inView.svelte.ts src/lib/utils/inView.svelte.spec.ts docs/src/routes/docs/use-in-view src/routes/tests/inView e2e/utilities/in-view.spec.ts src/routes/+page.svelte`
> Expected: no output. On any change, compare the "Current state" excerpts with the live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream parity)
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

When the element `useInView` watches is removed (`{#if}` turns false) or replaced by another element,
`useInView(...).current` keeps saying `true`. The observer is torn down and re-created, but nothing resets the
state, and motion's `inView` only reports a "leave" after it has seen an "enter" for that element. So a swapped-in
element that is off screen never corrects the value. Motion 14.6.0 fixed the same bug in React's `useInView`
(commits `aed29215d`, `ee53e616e`, issue #2579): whenever the observed element is attached, swapped or removed, it
re-observes and resets to `false`, unless `once` has already latched.

## Current state

- `src/lib/utils/inView.svelte.ts:226-275`, the hook body after the SSR guard:
  ```ts
      const [state, set] = createBooleanSnapshot(initial)
      let latched = false

      const attachable = createAttachable({
          refs: { target, root: options.root },
          isLatched: () => latched,
          onAttach: ({ target: el, root }, stop) =>
              motionInView(
                  el,
                  () => {
                      set(true)
                      if (options.once) {
                          // Detach inside the entry callback; motion's inView
                          // handles re-entry safely via observer.unobserve.
                          latched = true
                          stop()
                          return
                      }
                      return () => set(false)
                  },
                  { /* root, margin, amount */ }
              )
      })

      $effect(() => attachable.subscribe())

      return state
  ```
- How re-attachment already happens: `attachable.subscribe()` calls `tryAttach()` synchronously inside the
  `$effect`, which calls `resolveElement(target)`; when `target` is a getter that reads `$state` (for example
  `let ref = $state<HTMLElement>()` with `bind:this={ref}`), the effect tracks it and re-runs when the element
  changes. The effect's cleanup is the `release` function `subscribe()` returned, which disconnects the observer.
  **Nothing sets the state back to `false` in that cleanup**: that is the bug.
- With a plain `let ref` (not `$state`), the getter isn't reactive. Attaching after mount still works through
  `createAttachable`'s retry loop, but a later swap or removal can't be detected. Document this; don't try to fix
  it (Svelte gives no signal).
- JSDoc example at `inView.svelte.ts:210-223` uses `let ref` (plain). Docs page
  `docs/src/routes/docs/use-in-view/+page.svx` line ~31 does too.
- `src/lib/utils/inView.svelte.spec.ts`: mocks `IntersectionObserver` with
  `createMockIntersectionObserver()` from `src/lib/utils/__tests__/intersectionObserver.ts` (`io.instances()`,
  `io.fireOn(el, isIntersecting)`), wraps hook calls in an `inRoot(fn)` helper built on `$effect.root`, and calls
  `flushSync()` after state changes. Exemplar, lines 58-68:
  ```ts
      it('.current flips to true on enter and back to false on exit', () => {
          const el = document.createElement('div')
          const { result: state } = inRoot(() => useInView(el))
          flushSync()
          const seen: boolean[] = []
          const off = state.subscribe((v) => seen.push(v))
          io.fireOn(el, true)
          io.fireOn(el, false)
          off()
          expect(seen).toEqual([false, true, false])
      })
  ```
- Test page and e2e layout: `src/routes/tests/inView/+page.svelte` exists; its spec is `e2e/utilities/in-view.spec.ts`.

### Upstream (verified at `~/Github/motion` tag `v14.6.0`)

`packages/framer-motion/src/utils/use-in-view.ts:55-61`:

```ts
    /**
     * The ref object never changes, so if the element is attached, swapped
     * or removed after mount (e.g. conditional rendering) the effect above
     * won't re-run by itself. Check after every commit and re-observe,
     * resetting to false as the new element (if any) hasn't been seen yet.
     */
    useEffect(() => {
        if (ref.current !== observed.current) {
            once || setInView(false)
            observe({})
        }
    })
```

Upstream unit tests (`packages/framer-motion/src/utils/__tests__/use-in-view.test.tsx`): "Observes an element whose
ref attaches after mount", "Stops observing a removed element and observes it once re-added", "Resets to false when
the observed element is swapped", "once: stays true and stops observing when the element is removed". E2E fixture
`dev/react/src/tests/issue-2579.tsx` and spec `tests/react/issue-2579.spec.ts` (read with
`git -C ~/Github/motion show v14.6.0:<path>`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run src/lib/utils/inView.svelte.spec.ts` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| One e2e spec | `PW_PORT=4205 pnpm exec playwright test <path>` | all pass |

## Scope

**In scope**:

- `src/lib/utils/inView.svelte.ts`, `src/lib/utils/inView.svelte.spec.ts`
- `src/routes/tests/inView/element-after-mount/+page.svelte` (create), `e2e/utilities/in-view-element-after-mount.spec.ts` (create)
- `src/routes/+page.svelte` (one link, next to the existing inView link)
- `docs/src/routes/docs/use-in-view/+page.svx` (example uses `$state`; one note)
- `.changeset/use-in-view-element-changes.md` (create)

**Out of scope**: `src/lib/utils/attachable.ts` (plan 002 changes its retry internals; this plan only relies on its
public `subscribe()`), `whileInView` / `attachInViewGesture` in `gestures.ts`.

## Git workflow

- Lane branch `lane/1460-inview` in `../svelte-motion-1460-inview`, created by the dispatcher from the wave-0 commit.
- Conventional commits, e.g. `test(useInView): element removed or swapped after mount`,
  `fix(useInView): reset when the observed element changes (Motion 14.6.0)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red unit tests

In `inView.svelte.spec.ts`, add four tests ported from upstream. Each uses a reactive ref inside `inRoot`:

```ts
let el = $state<HTMLElement | undefined>(undefined)
const { result: state } = inRoot(() => useInView(() => el))
flushSync()
```

(`.svelte.spec.ts` files may use runes; this spec already does via `$effect.root`.)

1. `observes an element attached after mount`: start with `el` undefined; set `el = document.createElement('div')`,
   `flushSync()`; expect an observer instance observing it; `io.fireOn(el, true)` → `state.current` true.
2. `resets to false and stops observing when the element is removed`: attach, `fireOn(el, true)`, then `el = undefined`,
   `flushSync()` → `state.current` **false**, and the first observer's `disconnect` (or `unobserve` with the old
   element) was called.
3. `resets to false when the observed element is swapped`: attach A, `fireOn(A, true)`, then `el = B`, `flushSync()`
   → `state.current` **false**, an observer watches B. Then `fireOn(B, true)` → true.
4. `once: stays true when the element is removed`: `useInView(() => el, { once: true })`, attach, `fireOn(el, true)`,
   then `el = undefined`, `flushSync()` → `state.current` stays **true**.

**Verify**: `pnpm exec vitest run src/lib/utils/inView.svelte.spec.ts` → tests 2 and 3 **FAIL** (`current` stays
`true`). Tests 1 and 4 may already pass; that's fine. If 2 or 3 passes, STOP.

Commit (`test(useInView): element removed or swapped after mount`).

### Step 2: Reset on element change

Replace `$effect(() => attachable.subscribe())` with:

```ts
    // Motion 14.6.0 `use-in-view.ts` (#2579): when the observed element is
    // attached, swapped or removed, re-observe and reset to false, as the new
    // element (if any) hasn't been seen yet. With a `$state` ref the effect
    // re-runs on each change, because `subscribe()` resolves the getter here.
    $effect(() => {
        const release = attachable.subscribe()
        return () => {
            release()
            if (!latched) set(false)
        }
    })
```

`latched` is only true after a `once` hit, so `once` keeps its `true`. A reset to `false` on unmount is harmless.

Update the hook's JSDoc: change the example to `let ref = $state<HTMLElement>()`, and add a sentence: "Pass a
getter that reads `$state` (as with `bind:this` on a `$state` variable) to have swaps and removals tracked; a plain
`let` is resolved once it hydrates but later changes aren't seen."

**Verify**: `pnpm exec vitest run src/lib/utils/inView.svelte.spec.ts` → all pass, including the existing
"disconnects the observer on unmount" and "latches on first enter when once: true".

### Step 3: E2E page and spec

1. Create `src/routes/tests/inView/element-after-mount/+page.svelte`, a port of upstream
   `dev/react/src/tests/issue-2579.tsx`: `let ref = $state<HTMLDivElement>()`, `let hidden = $state(true)`,
   `const isInView = useInView(() => ref)`, buttons `data-testid="show"` / `data-testid="hide"`, a
   `<div data-testid="in-view">{String(isInView.current)}</div>`, and when not hidden a 100×100 red
   `<div bind:this={ref} data-testid="box">`. Header comment citing #2579 and commits `aed29215d`, `ee53e616e`.
2. Create `e2e/utilities/in-view-element-after-mount.spec.ts`, a port of upstream `tests/react/issue-2579.spec.ts`:
   load `/tests/inView/element-after-mount?@isPlaywright=true`; "observes an element rendered after mount" (false
   → click show → true within 2 s) and "returns false once the observed element is removed" (show → true → hide →
   box gone → false within 2 s).
3. Link the page from `src/routes/+page.svelte` next to the existing inView link.

**Verify**: `PW_PORT=4205 pnpm exec playwright test e2e/utilities/in-view-element-after-mount.spec.ts e2e/utilities/in-view.spec.ts` → all pass.

### Step 4: Docs, changeset, gate

1. `docs/src/routes/docs/use-in-view/+page.svx`: change the example's `let ref` to `let ref = $state<HTMLElement>()`
   and add one sentence matching the JSDoc note.
2. Create `.changeset/use-in-view-element-changes.md` (bump `patch`): "`useInView` resets to `false` when the
   element it observes is removed or replaced, and observes the new element (Motion 14.6.0). With `once`, it stays
   `true`."

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), `trunk check` on changed files (clean), `git status`
shows only in-scope files.

## Test plan

- Red-first: unit tests 2 and 3 fail on the current code (`current` stays `true`) and pass after Step 2.
- Tests 1 and 4 and the e2e "rendered after mount" case are guards (they may already pass).
- E2E "removed" case observes the fix in a real browser.

## Done criteria

- [ ] The four new unit tests and the two new e2e tests pass
- [ ] `grep -n "if (!latched) set(false)" src/lib/utils/inView.svelte.ts` → one match
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `trunk check` clean
- [ ] Docs example uses `$state`; changeset exists; page linked from `src/routes/+page.svelte`
- [ ] No out-of-scope files modified

## STOP conditions

- Tests 2 or 3 pass before Step 2.
- An existing `inView.svelte.spec.ts` test fails after Step 2 (especially the `once` or unmount cases).
- The fix seems to need `attachable.ts`.

## Maintenance notes

- If `useInView` ever gains a `ref`-object API (`{ current }`), the reset still keys off the effect re-running.
  Keep the reset in the effect cleanup.
- Plan 002 changes how `createAttachable` retries an unresolved ref. If both land, the e2e "rendered after mount"
  case covers the combination.
