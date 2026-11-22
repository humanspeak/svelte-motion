# Plan 007: A key change during an in-place key transition no longer strands the element

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/html/_MotionContainer.svelte src/routes/+page.svelte src/routes/tests/animate-presence e2e/animate-presence`
> Plan 006 lands before this one and edits `_MotionContainer.svelte` (the
> gesture-attachment effect, about lines 3620–3670), so that file WILL show
> a diff. That is expected. Compare only the two regions quoted in "Current
> state" (the key-tracker variables and the key-change `$effect`) against the
> live code. If either region differs from the excerpts, treat it as a STOP
> condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: MED (the in-place key path drives real UI such as the rolling copy button)
- **Depends on**: 006-\*.md (same file, merge order only; this plan reads no code 006 creates)
- **Wave**: 2
- **Category**: bug
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

A `motion.*` element that is a direct child of `AnimatePresence` and whose
`key` prop changes in place (no `{#key}` block around it) runs a "key
transition" on the same DOM node: exit, rewind to `initial`, re-enter. This
is how svelte-motion imitates React's unmount-and-remount on a key change, and
it is what a copy button that rolls between "copy" and "copied" uses. If the
key changes a second time while the first transition is still exiting, the
element is stranded on its exit target (for example opacity 0) for good, and
every later key change is ignored. Two quick clicks are enough to make the
control vanish permanently. Upstream Motion never strands: the latest key
always ends visible at its `animate` target. After this plan the in-place path
does the same.

## Current state

### Files

- `src/lib/html/_MotionContainer.svelte`: the component behind every
  `motion.*` element (4155 lines at `a33531a2`). `untrack` is already
  imported at line 56 (`import { untrack, type Snippet } from 'svelte'`).
  This plan edits two regions only:
  1. The key-tracker variables, lines 848–852.
  2. The key-change `$effect`, lines 3831–3955 (from the comment
     `// Handle key prop changes inside AnimatePresence` to the effect's
     closing `})`).
- `src/routes/tests/animate-presence/key-change/+page.svelte` and
  `e2e/animate-presence/key-change.spec.ts`: an existing key-change page.
  **It does not exercise this code path**: the element sits inside
  `{#key currentState}`, so Svelte destroys and remounts it on every change
  and the in-place transition never runs. Leave both files alone; this plan
  adds a new page and spec instead.
- `src/routes/tests/animate-presence/layout-button/RollingCopyButton.svelte:105-138`:
  the real-world user of the in-place path (`<AnimatePresence mode="wait"
  initial={false}>` around `<motion.span key={stage} ...>` with no `{#key}`).
  It is covered by `e2e/animate-presence/layout-button.spec.ts`, which is part
  of this plan's regression gate. Do not edit it.

### Region 1: the tracker variables (`_MotionContainer.svelte:848-852`)

```svelte
    // Track previous key for key-change detection (simulates React's key-based remounting)
    // Plain variables (not $state) to avoid self-triggering the key-change $effect
    let keyTrackerPrev = keyProp
    let keyTrackerIsTransitioning = false
    let keyTransitionStopped = false
```

### Region 2: the key-change effect (`_MotionContainer.svelte:3831-3955`, abridged)

```svelte
    // Handle key prop changes inside AnimatePresence (simulates React's key-based remounting)
    // When key changes, run exit → initial → animate sequence on the same element
    $effect(() => {
        // Access keyProp to create reactive dependency
        const currentKey = keyProp

        // Only handle key changes when:
        // ...
        if (
            !shouldRegisterPresenceExit ||
            !element ||
            isLoaded !== 'ready' ||
            keyTrackerIsTransitioning ||
            currentKey === keyTrackerPrev ||
            keyTrackerPrev === undefined
        ) {
            pwLog('[motion] key effect: early return', { /* ... */ keyTrackerIsTransitioning })
            // Update prev for next comparison
            if (currentKey !== keyTrackerPrev) {
                keyTrackerPrev = currentKey
            }
            return
        }

        pwLog('[motion] key changed, running exit→initial→animate', { /* ... */ })

        // Mark as transitioning to prevent re-entry
        keyTrackerIsTransitioning = true
        keyTransitionStopped = false
        keyTrackerPrev = currentKey

        // Run the key transition sequence
        const runKeyTransition = async () => {
            try {
                // (comment block about upstream exit.ts:19-72)
                const animationState = visualElement?.animationState

                // 1. Exit, via setActive — not a bespoke `animate()` call.
                if (animationState && exitProp !== undefined && !keyTransitionStopped) {
                    pwLog('[motion] key transition: setActive(exit, true)')
                    await animationState.setActive('exit', true)
                }

                pwLog('[motion] key transition: exit done', { /* ... */ })

                // Check if component was unmounted during the exit animation
                if (keyTransitionStopped || !element) return

                pwLog('[motion] key transition: rewinding to initial and re-entering')
                if (visualElement && animationState) {
                    // 2. Rewind ... (loop over keyChangeInitialKeyframes, jump + setStaticValue)
                    visualElement.scheduleRenderMicrotask()

                    // 3. Re-enter ... (comment block)
                    visualElement.blockInitialAnimation = false
                    // Release exit so it stops protecting those keys.
                    await animationState.setActive('exit', false)
                    // Clear `prevResolvedValues` so the re-enter is not deduped
                    // away as "already at target".
                    animationState.reset()
                }

                // (comment block about dash attributes)

                runAnimation()
            } finally {
                pwLog('[motion] key transition: finally', { keyTransitionStopped })
                if (!keyTransitionStopped) {
                    keyTrackerIsTransitioning = false
                }
            }
        }

        // Fire-and-forget: `$effect` bodies cannot be async, and the transition
        // manages its own cancellation via the cleanup returned below.
        void runKeyTransition()

        // Cleanup on unmount
        return () => {
            pwLog('[motion] key effect: cleanup, stopping transition')
            keyTransitionStopped = true
        }
    })
```

### The bug, traced

Svelte 5 runs an `$effect`'s cleanup **before every re-run**, not only on
unmount. The effect tracks `keyProp`, `element`, `isLoaded`, and, because
`runKeyTransition()` is called synchronously and reads them before its first
`await`, also `visualElement` and `exitProp`.

1. Key A → B. The effect starts a transition: `keyTrackerIsTransitioning =
   true`, `keyTrackerPrev = B`, and the exit animation starts.
2. Key B → C while the exit is still running. The effect re-runs, so its
   cleanup runs first: `keyTransitionStopped = true`. The body then
   early-returns because `keyTrackerIsTransitioning` is true, and sets
   `keyTrackerPrev = C`. It returns no cleanup.
3. The exit animation finishes. The continuation sees `keyTransitionStopped`
   and returns before the rewind and re-enter. The element stays at its exit
   target (opacity 0).
4. `finally` runs, but `keyTransitionStopped` is true, so
   `keyTrackerIsTransitioning` is never reset.
5. Every later key change early-returns on `keyTrackerIsTransitioning`. Nothing
   resets it, so the element stays invisible for the component's lifetime.

The same strand follows any other dependency change during the exit (a new
`exit` object, for example), because the cleanup cannot tell a re-run from an
unmount.

A second hazard the fix must handle: an animation interrupted by another
animation on the same value never resolves its promise. In motion-dom
`v14.14.0`, `JSAnimation.stop()` and `cancel()` only call `teardown()`
(`packages/motion-dom/src/animation/JSAnimation.ts:580-593`).
`notifyFinished()`, which resolves `finished`
(`packages/motion-dom/src/animation/utils/WithPromise.ts:30-33`), is called
only from `finish()` (`:572-578`). So the fix must not rely on an awaited exit
ever resuming.

### What upstream does

Upstream has no in-place key path: a key change unmounts the old child and
mounts a new one, and `AnimatePresence` keeps the old one rendered while it
exits. Its observable behavior for a key change during an exit
(`~/Github/motion`, tag `v14.14.0`):

- **`mode="wait"`, A → B → C before A's exit finishes**:
  `packages/framer-motion/src/components/AnimatePresence/index.tsx:155-179`
  marks A as exiting and, in wait mode, renders only the exiting children
  (`nextChildren = exitingChildren`). B never mounts. When A's exit
  completes, `nextChildren = presentChildren`, and C mounts and enters. One
  exit and one enter, and the latest key wins.
- **`mode="sync"`, A → B → C**: A exits; B mounts and enters; B then exits
  from wherever its enter had reached while C enters. Several DOM nodes
  overlap. An in-place transition has only one node, so it cannot reproduce
  this literally. The end state, the latest key visible at its `animate`
  target, is what must match.
- **A → B → A before A's exit finishes** (the exiting key comes back):
  A is in `presentKeys` again, so it is not exiting (`index.tsx:155-164`)
  and renders with `isPresent: true`. `ExitAnimationFeature.update`
  (`packages/framer-motion/src/motion/features/animation/exit.ts:28-58`)
  then calls `animationState.setActive("exit", false)` (line 55). The exit
  reverses from its current values to the `animate` target with no rewind to
  `initial`. The stale exit promise is ignored by identity
  (`if (this.exit !== exit) return`, line 70).
- **A change after the new child has started entering** (the exit is done):
  the entering child is now the one being removed, so it exits from its
  current values and the next key enters.

### Mapping to the in-place path (the target behavior)

The in-place transition is already one node, exit then enter, which is
upstream's `wait` sequencing. Keep that model and make every case end on the
latest key:

| When the key changes | Target behavior | Upstream reference |
| --- | --- | --- |
| Idle | Start a transition (unchanged) | — |
| During the exit, to a key other than the one exiting | Keep exiting. When the exit finishes, re-enter once with the latest props | `index.tsx:155-179` |
| During the exit, back to the key that is exiting | Abort the transition and reverse: `setActive('exit', false)`, no rewind | `exit.ts:55`, `:70` |
| After the exit finished (rewind and re-enter in progress) | Start a new transition. It exits from the current values; the old continuation becomes a no-op | the entering child exits, the next one enters |
| Component unmounts mid-transition | The continuation becomes a no-op | — |

The mechanism is a generation counter. Every new transition, every reversal
and the unmount bump it, and an async continuation whose generation is stale
returns without touching anything. The effect's own cleanup goes away, since
it cannot tell a re-run from an unmount; a separate dependency-free effect
handles the unmount.

### Conventions

- Test pages live under `src/routes/tests/<area>/<name>/+page.svelte` and are
  linked from `src/routes/+page.svelte`. The animate-presence list ends with
  this item (lines 1180–1188):

  ```svelte
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/animate-presence/wait-exit-key-change') +
                            searchParams}
                    >
                        Wait exit completion (latest requested key remains)
                    </a>
                </li>
  ```

- Pages that read query parameters use `import { page } from '$app/state'`
  and `page.url.searchParams.get(...)`; see
  `src/routes/tests/animate-presence/wait-exit-key-change/+page.svelte:2,7`.
- Human-tester panel: `src/routes/tests/layout/_parity/TesterPanel.svelte`.
  It renders nothing under `?@isPlaywright=true` on its own. Exemplar use:
  `src/routes/tests/reorder/click-after-drag/+page.svelte` (import on line 3,
  `<TesterPanel eyebrow=... title=... status=... {steps}>` with `checks` and
  `summary` snippets, lines 111–135). `TesterStep` is
  `{ text: string; expected: string; action?: { label?: string; run: () => void } }`.
- e2e specs open the page with `?@isPlaywright=true`. Wait for readiness with
  `await expect(locator).toHaveAttribute('data-is-loaded', 'ready')`. Use
  `expect.poll` and locator assertions, not `waitForTimeout`.

## Commands you will need

| Purpose             | Command                                                              | Expected on success |
| ------------------- | -------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`        | exit 0              |
| Browsers            | `pnpm exec playwright install chromium`                              | exit 0              |
| Build               | `pnpm build`                                                         | exit 0              |
| Typecheck           | `pnpm check`                                                         | 0 errors            |
| All unit tests      | `pnpm test:only`                                                     | all pass            |
| e2e (own port)      | `PW_PORT=4217 pnpm exec playwright test <paths> --project=chromium`  | see steps           |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                       | no issues           |

Notes:

- Port 4198 is the maintainer's live dev server. Never bind, reuse or kill
  it, and never set `PW_REUSE_SERVER`. Always pass `PW_PORT=4217`.
- Playwright builds and previews the app itself (`playwright.config.ts:25`);
  you do not start a server.
- Trunk is the lint and format authority; do not use `pnpm lint` or
  `prettier`.
- Never use `git stash`: the stash is shared across worktrees.

## Scope

**In scope** (the only files you should modify):

- `src/lib/html/_MotionContainer.svelte`: only the tracker variables (lines
  848–852) and the key-change `$effect` (lines 3831–3955), plus one new
  teardown `$effect` placed directly after it
- `src/routes/tests/animate-presence/key-change-in-place/+page.svelte` (create)
- `e2e/animate-presence/key-change-in-place.spec.ts` (create)
- `src/routes/+page.svelte` (one new link)
- `.changeset/key-transition-restart.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- The `onLayoutMeasure` subscription effect in `_MotionContainer.svelte`
  (about lines 3078–3096). Plan 003 owns it.
- The hover/focus/in-view gesture-attachment effect(s) in
  `_MotionContainer.svelte` (about lines 3620–3670). Plan 006 rewrites them.
- `runAnimation` (line 2167), the wait-mode deferral inside it, and the mount
  effect. The transition calls `runAnimation()` exactly as it does today.
- `src/lib/utils/presence.ts`, `src/lib/components/PresenceChild.svelte`,
  `src/lib/components/AnimatePresence.svelte`. Plan 005 owns parts of the
  first two, and the in-place path does not go through the presence registry.
- `src/routes/tests/animate-presence/key-change/` and
  `e2e/animate-presence/key-change.spec.ts`. They test the `{#key}` remount
  path, not this one.
- `RollingCopyButton.svelte` and `e2e/animate-presence/layout-button.spec.ts`.
  They are a regression gate here, not something to edit.
- The order of `await animationState.setActive('exit', false)`,
  `animationState.reset()` and `runAnimation()` in the re-enter. Do not
  remove the `await` or reorder these calls: that would change enter timing
  for every in-place transition and is not what this plan fixes.

## Git workflow

- Branch: `advisor/007-key-transition-restart`, created by hand from the
  commit where plan 006 has landed (not with `isolation: 'worktree'`).
- Conventional commits, for example
  `fix(presence): let a key change mid-transition end on the latest key`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a test page and a failing e2e spec

Create `src/routes/tests/animate-presence/key-change-in-place/+page.svelte`.

Script:

- `import { page } from '$app/state'`, `import { AnimatePresence, motion } from '$lib'`,
  and `import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'`.
- `const mode = page.url.searchParams.get('mode') === 'wait' ? 'wait' : 'sync'`.
- `const isPlaywright = typeof window !== 'undefined' && window.location.search.includes('@isPlaywright=true')`.
- `const labels = ['one', 'two', 'three', 'four'] as const`,
  `let index = $state(0)`, `const label = $derived(labels[index])`.
- `const next = () => (index = (index + 1) % labels.length)` and
  `const prev = () => (index = (index + labels.length - 1) % labels.length)`.
- `const transition = { duration: isPlaywright ? 0.6 : 0.4, ease: 'linear' }`.
- Two helpers for human testers: `double()` calls `next()`, then `next()`
  again after `setTimeout(..., 150)`; `bounce()` calls `next()`, then
  `prev()` after `setTimeout(..., 150)`.

Markup (no `{#key}` block: that is the whole point of the page):

```svelte
<div class="page">
    <h1>In-place key change during a key transition</h1>
    <p>Mode: <span data-testid="mode">{mode}</span></p>
    <div class="stage">
        <AnimatePresence {mode}>
            <motion.div
                key={label}
                data-testid="box"
                data-key={label}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                {transition}
                class="box"
            >
                {label}
            </motion.div>
        </AnimatePresence>
    </div>
    <div class="controls">
        <button data-testid="next" onclick={next}>Next key</button>
        <button data-testid="prev" onclick={prev}>Previous key</button>
        <button data-testid="double" onclick={double}>Two quick changes</button>
        <button data-testid="bounce" onclick={bounce}>Change and change back</button>
    </div>
</div>
```

Style it like the neighbouring pages (dark `#0f1115` background, a 120×60 px
`.stage` with `position: relative`, a cyan `.box` filling it). Keep it usable
at phone width.

Add a `TesterPanel` (modelled on `src/routes/tests/reorder/click-after-drag/+page.svelte:111-135`):

- `eyebrow="AnimatePresence · in-place key"`, `title="A key change mid-transition ends on the latest key"`.
- `checks`: one paragraph saying that the box changes its `key` without a
  `{#key}` block, so svelte-motion runs exit, rewind and enter on the same
  element, and that a second change during the exit used to leave the box
  invisible for good. Mention `?mode=wait` for the wait-mode variant.
- `steps`:
  1. text "Press Two quick changes", expected "The box fades out once, then
     fades in showing the label two steps on. It never stays invisible.",
     action `{ label: 'Do it', run: double }`.
  2. text "Press Change and change back", expected "The box starts to fade
     out, then fades straight back in with the same label. It does not jump
     up above its resting place first.", action `{ label: 'Do it', run: bounce }`.
  3. text "Press Next key", expected "The box still fades out and back in. Key
     changes keep working after steps 1 and 2.", action `{ label: 'Do it', run: next }`.
- `status="Expected to pass on this build once plan 007 has landed."`
- No `summary` snippet and no live verdict are needed: the expected results
  are visible directly.

Link the page from `src/routes/+page.svelte`, directly after the
`wait-exit-key-change` item quoted in "Current state", with the same `<li>`
shape, `href={resolve('/tests/animate-presence/key-change-in-place') + searchParams}`,
and the text `In-place key change during a key transition`.

Create `e2e/animate-presence/key-change-in-place.spec.ts`. Put these helpers
at the top:

```ts
import { expect, test, type Page } from '@playwright/test'

const urlFor = (mode: 'sync' | 'wait') =>
    `/tests/animate-presence/key-change-in-place?@isPlaywright=true&mode=${mode}`

const readBox = (page: Page) =>
    page.getByTestId('box').evaluate((el) => {
        const cs = getComputedStyle(el)
        const y = cs.transform === 'none' ? 0 : new DOMMatrix(cs.transform).m42
        return { opacity: Number(cs.opacity), y, key: el.getAttribute('data-key') }
    })

/** Poll until the box is mid-exit, so the next click lands inside the transition. */
const waitMidExit = (page: Page) =>
    expect
        .poll(async () => (await readBox(page)).opacity, { intervals: [16], timeout: 2000 })
        .toBeLessThan(0.9)

/** Poll until the box is fully visible again. */
const waitVisible = (page: Page) =>
    expect
        .poll(async () => (await readBox(page)).opacity, { intervals: [50], timeout: 5000 })
        .toBeGreaterThanOrEqual(0.99)

/** Record the box's translateY on every frame into window.__ySamples. */
const startYRecorder = (page: Page) =>
    page.evaluate(() => {
        const w = window as unknown as { __ySamples: number[]; __yStop?: boolean }
        w.__ySamples = []
        w.__yStop = false
        const el = document.querySelector<HTMLElement>('[data-testid="box"]')!
        const tick = () => {
            if (w.__yStop) return
            const t = getComputedStyle(el).transform
            w.__ySamples.push(t === 'none' ? 0 : new DOMMatrix(t).m42)
            requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    })
```

Then, inside `for (const mode of ['sync', 'wait'] as const)`, a
`test.describe(\`in-place key change (mode=${mode})\`, ...)` with a
`beforeEach` that goes to `urlFor(mode)`, waits for
`data-is-loaded="ready"` on `box`, and calls `waitVisible(page)`. Tests:

1. **a second key change mid-exit ends visible on the latest key**: click
   `next`, `await waitMidExit(page)`, click `next` again, then
   `await waitVisible(page)` and
   `await expect(page.getByTestId('box')).toHaveAttribute('data-key', 'three')`.
2. **key changes keep working after an interrupted transition**: do test 1's
   sequence (ending visible on `three`), then click `next` once more,
   `await waitMidExit(page)` (proves an exit ran), `await waitVisible(page)`,
   and assert `data-key` is `four`.
3. **changing back to the exiting key reverses the exit without a rewind**:
   click `next`, `await waitMidExit(page)`, `await startYRecorder(page)`,
   click `prev`, `await waitVisible(page)`, assert `data-key` is `one`. Then
   stop the recorder (`window.__yStop = true`), read `window.__ySamples`,
   and assert `Math.min(...samples)` is greater than `-0.5`. A rewind to
   `initial` would jump `y` to -10. Upstream reverses from the exit
   position, which is positive `y`, straight back to 0.

**Verify**:
`PW_PORT=4217 pnpm exec playwright test e2e/animate-presence/key-change-in-place.spec.ts --project=chromium`
→ all 6 tests (3 per mode) FAIL in `waitVisible`, with
`Expected: >= 0.99` and `Received: 0` (or a value close to 0) after the 5 s
poll timeout.

If any of the six passes on the unmodified library, the reproduction is
wrong: STOP and report which test passed and the opacity, `y` and `data-key`
it read. If `beforeEach` fails (the box never becomes visible on load),
STOP: the page itself is broken.

Commit the page, link and spec as one commit (red tests).

### Step 2: Replace the tracker variables

In `src/lib/html/_MotionContainer.svelte`, replace the five lines quoted in
"Region 1" with:

```svelte
    // In-place key transitions (simulates React's key-based remounting). Plain
    // variables, not $state, so the key-change $effect never subscribes to its
    // own bookkeeping.
    // - keyTrackerPrev: the last key the effect has seen.
    // - keyTransitionExiting: an exit started by a key change is in flight.
    // - keyTransitionFromKey: the key that exit belongs to, so a change back
    //   to it can reverse the exit instead of finishing it.
    // - keyTransitionGeneration: bumped by every new transition, by a
    //   reversal, and on unmount. An async continuation whose generation is
    //   stale returns without touching anything. Interrupted animations never
    //   resolve their promise (motion-dom JSAnimation.stop() only tears down),
    //   so nothing may depend on an awaited exit resuming.
    let keyTrackerPrev = keyProp
    let keyTransitionExiting = false
    let keyTransitionFromKey: typeof keyProp = undefined
    let keyTransitionGeneration = 0
```

`keyTrackerIsTransitioning` and `keyTransitionStopped` are gone. Step 3
removes their remaining uses.

**Verify**: no command yet; the file does not type-check until Step 3.

### Step 3: Rewrite the key-change effect as a generation-guarded state machine

Replace the effect quoted in "Region 2" with the shape below. Keep the
existing explanatory comments inside the transition body (the upstream
`exit.ts` note, the rewind note, the `blockInitialAnimation` note, the dash
attributes note) and the existing `pwLog` calls, updating any log payload
that mentions the removed variables.

```svelte
    // Handle key prop changes inside AnimatePresence (simulates React's
    // key-based remounting). A key change runs exit -> rewind -> enter on the
    // same element. A key change DURING that exit follows upstream
    // AnimatePresence (v14.14.0):
    // - to another key: keep exiting, then enter once with the latest props,
    //   as wait mode renders only the exiting child and mounts the latest one
    //   after it (AnimatePresence/index.tsx:155-179);
    // - back to the exiting key: reverse the exit with no rewind, as
    //   ExitAnimationFeature does when the child is present again
    //   (exit.ts:55).
    // A change after the exit has finished starts a fresh transition. This
    // effect returns no cleanup on purpose: Svelte runs an effect's cleanup
    // before every re-run, so a cleanup cannot tell "the key changed again"
    // from "unmounted". The teardown effect below handles unmount.
    $effect(() => {
        const currentKey = keyProp

        if (
            !shouldRegisterPresenceExit ||
            !element ||
            isLoaded !== 'ready' ||
            currentKey === keyTrackerPrev ||
            keyTrackerPrev === undefined
        ) {
            pwLog('[motion] key effect: early return', {
                currentKey,
                keyTrackerPrev,
                isLoaded,
                hasElement: !!element,
                hasContext: !!context,
                keyTransitionExiting
            })
            if (currentKey !== keyTrackerPrev) {
                keyTrackerPrev = currentKey
            }
            return
        }

        if (keyTransitionExiting && currentKey === keyTransitionFromKey) {
            pwLog('[motion] key changed back mid-exit, reversing', { currentKey })
            keyTransitionGeneration++
            keyTransitionExiting = false
            keyTrackerPrev = currentKey
            untrack(() => {
                void visualElement?.animationState?.setActive('exit', false)
            })
            return
        }

        if (keyTransitionExiting) {
            pwLog('[motion] key changed mid-exit, entering latest after exit', {
                currentKey
            })
            keyTrackerPrev = currentKey
            return
        }

        pwLog('[motion] key changed, running exit→initial→animate', {
            prevKey: keyTrackerPrev,
            newKey: currentKey
        })

        const generation = ++keyTransitionGeneration
        const isCurrent = () => generation === keyTransitionGeneration && !!element
        keyTransitionExiting = true
        keyTransitionFromKey = keyTrackerPrev
        keyTrackerPrev = currentKey

        const runKeyTransition = async () => {
            try {
                const animationState = visualElement?.animationState

                // 1. Exit (existing comment block stays here)
                if (animationState && exitProp !== undefined) {
                    pwLog('[motion] key transition: setActive(exit, true)')
                    await animationState.setActive('exit', true)
                }

                pwLog('[motion] key transition: exit done', { current: isCurrent() })
                // Reversed, superseded or unmounted while exiting.
                if (!isCurrent()) return
                keyTransitionExiting = false

                pwLog('[motion] key transition: rewinding to initial and re-entering')
                if (visualElement && animationState) {
                    // 2. Rewind (existing loop and comments, unchanged)
                    // ...
                    visualElement.scheduleRenderMicrotask()

                    // 3. Re-enter (existing comments, unchanged)
                    visualElement.blockInitialAnimation = false
                    await animationState.setActive('exit', false)
                    // A key change during the re-enter started a new
                    // transition; it owns the element now.
                    if (!isCurrent()) return
                    animationState.reset()
                }

                // (existing dash-attributes comment, unchanged)

                runAnimation()
            } finally {
                if (generation === keyTransitionGeneration) {
                    keyTransitionExiting = false
                }
            }
        }

        // Fire-and-forget: `$effect` bodies cannot be async. `untrack` keeps
        // the synchronous prefix (`visualElement`, `exitProp`) out of this
        // effect's dependencies, so only `keyProp`, `element` and `isLoaded`
        // re-run it.
        untrack(() => {
            void runKeyTransition()
        })
    })

    // Unmount teardown for the key transition. It reads nothing reactive, so
    // it runs once and its cleanup fires only when the component is destroyed.
    $effect(() => () => {
        keyTransitionGeneration++
        keyTransitionExiting = false
    })
```

Points to get right:

- The `!keyTransitionStopped` condition on the exit `if` is removed: a
  brand-new transition is never stopped at its first line.
- The `isCurrent()` check after `await animationState.setActive('exit', false)`
  goes **before** `animationState.reset()`. A stale continuation must not
  reset an animation state the newer transition is using.
- The only `return` from the effect body is a plain `return` (no cleanup
  function).
- Do not change anything between the rewind loop's start and
  `visualElement.scheduleRenderMicrotask()`.

**Verify**:

- `pnpm check` → 0 errors.
- `grep -nE "keyTrackerIsTransitioning|keyTransitionStopped" src/lib/html/_MotionContainer.svelte` → no output.
- `PW_PORT=4217 pnpm exec playwright test e2e/animate-presence/key-change-in-place.spec.ts --project=chromium`
  → all 6 tests PASS.

If test 3 fails because the box stays near opacity 0 after the reversal
(`setActive('exit', false)` did not animate back), STOP and report: upstream
relies on exactly this call to reverse an exit (`exit.ts:55`), so a failure
means our animation state differs from upstream's, and that is a separate
finding. If test 3 fails only on the `y > -0.5` assertion, report the
minimum `y` sampled; do not loosen the threshold.

Commit: `fix(presence): let a key change mid-transition end on the latest key`.

### Step 4: Regression gate for presence

```bash
PW_PORT=4217 pnpm exec playwright test e2e/animate-presence --project=chromium
pnpm test:only
```

**Verify**: both exit 0. `e2e/animate-presence/layout-button.spec.ts` (the
rolling copy control, the main real user of this path) and
`wait-exit-key-change.spec.ts` must pass. For an e2e failure, re-run that one
spec alone once. The README records a known pop-layout frame-capture flake
(`pop-layout-*` specs). If one of those fails, re-run it alone; if it passes
alone, note it in your report and continue. If any other spec fails twice,
and passes with Step 3 reverted, STOP and report the spec and assertion.

### Step 5: Changeset

Create `.changeset/key-transition-restart.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

A direct `AnimatePresence` child whose `key` changes in place no longer gets stuck invisible when the key changes again during its exit. As in Motion, the latest key always ends visible: a change to another key enters once the exit finishes, and a change back to the exiting key reverses the exit.
```

### Step 6: Full gate

Run `pnpm build`, `pnpm check`, `pnpm test:only`, the two e2e commands from
Steps 3 and 4, then
`trunk fmt <the five in-scope files>` and `trunk check <the five in-scope files>`,
then `git diff --check`.

**Verify**: every command exits 0 and `trunk check` reports no issues.

## Test plan

- Red first: `e2e/animate-presence/key-change-in-place.spec.ts`, six tests
  (three cases × `sync` and `wait`). On current code all six fail in
  `waitVisible` with the box at opacity ≈ 0, because the second key change
  strands the element. After Step 3 all six pass. An e2e spec is used because
  the transition needs a real VisualElement, real animations and Svelte's
  effect scheduling; the container is not practical to unit-test in jsdom.
- Cases:
  1. A → B → C mid-exit ends visible on C (the coalesce row).
  2. A later key change after case 1 still runs an exit and ends visible
     (the permanent strand).
  3. A → B → A mid-exit reverses with no rewind: `y` never goes below -0.5
     (the reversal row, upstream `exit.ts:55`).
- Not covered by a dedicated test: a key change during the re-enter (after
  the exit finished). It is handled by the generation guard, and a reliable
  test would need to land a click inside a window that is one enter long. If
  you can add it without `waitForTimeout` (poll until opacity is rising
  between 0.2 and 0.8, then click `next`, and assert the box ends visible on
  the latest key), add it as test 4. Otherwise leave it out and say so in
  your report.
- Regression: the whole `e2e/animate-presence` directory, especially
  `layout-button.spec.ts` (rolling copy control, `mode="wait"`,
  `initial={false}`) and `key-change.spec.ts` (the `{#key}` path, which must
  be unaffected).
- Pattern: `e2e/animate-presence/key-change.spec.ts` for computed-style
  reads; `src/routes/tests/reorder/click-after-drag/+page.svelte` for the
  tester panel.

## Done criteria

- [ ] `PW_PORT=4217 pnpm exec playwright test e2e/animate-presence/key-change-in-place.spec.ts --project=chromium` exits 0 with 6 (or 8, if test 4 was added) passing tests
- [ ] `PW_PORT=4217 pnpm exec playwright test e2e/animate-presence --project=chromium` exits 0 (known pop-layout flake re-run alone, as in Step 4)
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `grep -cE "keyTrackerIsTransitioning|keyTransitionStopped" src/lib/html/_MotionContainer.svelte` prints `0`
- [ ] `grep -c "keyTransitionGeneration" src/lib/html/_MotionContainer.svelte` prints at least `5`
- [ ] `grep -c "key-change-in-place" src/routes/+page.svelte` prints `1`
- [ ] `grep -c "waitForTimeout" e2e/animate-presence/key-change-in-place.spec.ts` prints `0`
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the five in-scope files
- [ ] `git diff a33531a2 -- src/lib/html/_MotionContainer.svelte` shows no hunks outside the tracker variables and the key-change effect, other than plan 006's (and 003's, if landed) already-merged changes
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Either region quoted in "Current state" does not match the live code.
- Any Step 1 test passes on the unmodified library.
- Step 3's reversal leaves the box near opacity 0 (see Step 3).
- `layout-button.spec.ts` or `wait-exit-key-change.spec.ts` fails after
  Step 3 and passes with it reverted.
- The fix seems to need a change to `runAnimation`, the mount effect,
  `presence.ts`, `PresenceChild.svelte`, `AnimatePresence.svelte`, or the
  gesture / `onLayoutMeasure` effects.
- `pnpm check` reports a type error for `typeof keyProp` that cannot be
  fixed by annotating `keyTransitionFromKey` as `string | number | undefined`
  (the `key?: string | number` prop type in `src/lib/types.ts:658`).

## Maintenance notes

- Plans 003, 006 and 007 all edit `src/lib/html/_MotionContainer.svelte`,
  in disjoint regions: 003 the `onLayoutMeasure` subscription effect (about
  lines 3078–3096), 006 the gesture-attachment effect(s) (about lines
  3620–3670), 007 the key-tracker variables (848–852) and the key-change
  effect (3831–3955). 007 runs in wave 2, after 006, only to keep merges in
  this 4000-line file simple. Expect a rebase, not a conflict.
- Reviewer: check that the key-change effect returns no cleanup, that every
  `await` in `runKeyTransition` is followed by an `isCurrent()` check before
  it touches the element or the animation state, and that the teardown effect
  reads nothing reactive.
- Behavior choice: the in-place path keeps upstream's `wait` sequencing
  (one node, exit then enter) in every `AnimatePresence` mode, as it did
  before this plan. In `mode="sync"` upstream would overlap several nodes; a
  single in-place node cannot, and only the end state (latest key visible at
  its `animate` target) is matched. Making the in-place path honor `sync` or
  `popLayout` overlap would mean cloning the node, which is out of scope.
- The `untrack` around `runKeyTransition()` also stops a mid-exit change to
  `exit` or `visualElement` from re-running the effect. That was another way
  to hit the old strand. Keep it if this effect is refactored.
- Upstream's reversal ignores a late exit promise by identity (`exit.ts:70`);
  the generation counter is the equivalent here. If someone later moves the
  in-place path onto `ExitAnimationFeature`-style bookkeeping, the three e2e
  cases above are the contract to keep.
