# Plan 009: `useAnimate` returns Motion 14.7 timelines that inherit MotionConfig, with types re-exported

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **This is a two-phase plan.** Phase A (Steps 1-5) runs on Motion **14.6.0** and writes only tests, a test page
> and a test helper. It must end with the new tests failing in the ways listed. After Step 5 you **STOP and
> report "phase A red"** with the per-test results table. Do not start Phase B until the dispatcher tells you to.
> Phase B (Steps 6-11) merges plan 001's bump to 14.7.1, confirms the timeline tests went green on their own,
> then ports the `useAnimate` scope settings (our code), the types, re-exports, docs and changeset.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4219** (`PW_PORT=4219`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/utils/animate.svelte.ts src/lib/utils/animate.spec.ts src/lib/utils/animateValue.ts src/lib/index.ts src/lib/index.spec.ts src/lib/components/__tests__ src/routes/tests/useAnimate src/routes/+page.svelte e2e/utilities docs/src/routes/docs/use-animate docs/src/routes/examples/use-animate docs/src/lib/examples/use-animate docs/src/lib/compare-data.ts package.json`
> Expected: no output. On any output, compare the "Current state" excerpts with the live code; on a mismatch,
> STOP. (In Phase B, after the merge, expect only plan 001's and other merged plans' changes, and re-check the
> excerpts below before editing; `src/lib/index.ts` is the most likely to have moved.)

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (the return type of the public `animate`/`useAnimate` changes; `useAnimate` starts passing
  `reduceMotion`)
- **Depends on**: 001 (Phase B only: `Timeline`, its types and the timeline behaviour live in framer-motion /
  `motion` 14.7.1, which 001 pins). Phase A runs on 14.6.0 and depends on nothing.
- **Wave**: 1 for Phase A; Phase B after 001 is committed on `feat/motion-14.7.1`
- **Category**: migration (upstream parity) + bug (`useAnimate` never passes `reduceMotion`)
- **Planned at**: commit `f8ac71aa` (main after the 14.6.0 release, `motion`/`motion-dom` pinned `14.6.0`), 2026-10-27

## Why this matters

In Motion 14.7, every `animate()` call returns a mutable `Timeline`: you can `add`, `move` and `remove`
segments, labels (now with offsets like `"mid+0.5"`), callbacks and pauses while it plays, nest timelines,
`playTo` a label and `reverse`. Our `animate` re-export and `useAnimate`'s scoped `animate` get that at runtime
with plan 001's bump, but our types still say they return the old `AnimationPlaybackControlsWithThen`, so
`tl.add(…)` doesn't compile, and none of the new types are importable from `@humanspeak/svelte-motion`.

Separately, `useAnimate` has never passed MotionConfig's `reducedMotion` to Motion (upstream has since before
14.6), so `<MotionConfig reducedMotion="always">` doesn't stop transforms animated through `useAnimate`. 14.7.1
also has `useAnimate` write `reduceMotion`/`skipAnimations` onto the scope so timelines rebuilt later follow the
same settings (`29946f8d4`). This plan ports both, re-types `animate`, re-exports the timeline types, adds an
export-drift tripwire so the next Motion bump flags new exports, and updates docs and the GSAP comparison.

## Current state

### Ours (verified at `f8ac71aa`)

- `src/lib/utils/animate.svelte.ts` — `useAnimate`.
  - `:20-25`, the scope type:
    ```ts
    export type AnimationScope<T extends Element = HTMLElement> = ((node: T) => () => void) & {
        /** The parent element, populated when the attachment fires. `undefined` before mount or after detach. */
        current: T | undefined
        /** Animations currently scoped to this element. */
        animations: AnimationPlaybackControlsWithThen[]
    }
    ```
  - `:41-44`, JSDoc that contradicts itself and the code:
    ```ts
     * `animate` ignores calls before the attachment fires — `scope.current` is
     * still `undefined`, and motion throws when asked to query selectors against
     * a missing root. Trigger animations from user events or `$effect` after
     * mount.
    ```
    Nothing ignores the call: `animate` (`:133-136`) forwards straight to motion, which throws a `TypeError`
    for a selector string (motion-dom `resolveElements` reads `scope.current.querySelectorAll`). Element and
    motion-value subjects work before attach. Upstream behaves the same (no guard), so the fix is the JSDoc.
  - `:105-110`, config captured at init, guarded because `useAnimate()` is also called at module scope
    (`src/lib/utils/animate.spec.ts:19-21`, `'does not throw when called outside a Svelte component'`):
    ```ts
        let motionConfig: MotionConfigProps | undefined
        try {
            motionConfig = getMotionConfig()
        } catch {
            motionConfig = undefined
        }
    ```
  - `:116-131`, the per-call memoised scoped animate. Only `skipAnimations` is passed:
    ```ts
        const resolveScopedAnimate = (): SvelteMotionAnimate => {
            const skipAnimations = motionConfig?.skipAnimations
            if (!hasCached || cachedSkip !== skipAnimations) {
                hasCached = true
                cachedSkip = skipAnimations
                cachedScoped = createScopedAnimate({
                    scope: scope as MotionAnimationScope<T>,
                    ...(skipAnimations === undefined ? {} : { skipAnimations })
                }) as SvelteMotionAnimate
            }
            return cachedScoped!
        }
    ```
- `useReducedMotionConfig()` (`src/lib/utils/reducedMotionConfig.svelte.ts:118-140`) calls `getMotionConfig()`
  and `$effect`, so it can't be called from `useAnimate` at module scope. Its policy logic is the one to mirror
  (`:121-126`): `policy = motionConfig?.reducedMotion ?? 'never'`; `'always'` → `true`; `'never'` → `false`;
  otherwise the OS preference. The OS query string is `'(prefers-reduced-motion: reduce)'`
  (`src/lib/utils/reducedMotion.svelte.ts:3`, not exported).
- `src/lib/utils/animateValue.ts:34-67`, `SvelteMotionAnimate`: six call signatures, all returning
  `AnimationPlaybackControlsWithThen`; the sequence one is
  `(sequence: AnimationSequence, options?: SequenceOptions): AnimationPlaybackControlsWithThen`. Imports at `:1-15`
  (`AnimationSequence`, `ObjectTarget`, `SequenceOptions` from `motion`; the rest from `motion-dom`). `:105-106`:
  "When bumping `motion`/`motion-dom`, re-check the passthrough overloads below against upstream's
  `animate`/`createScopedAnimate` signatures." `animate` is `animateCore as SvelteMotionAnimateWithEffects`
  (`:116`).
- `src/lib/index.ts`: `export { animate } from '$lib/utils/animateValue'` (`:51`),
  `export { useAnimate } from '$lib/utils/animate.svelte'` / `export type { AnimationScope } …` (`:151-152`). No
  sequence or timeline types are exported today.
- `src/lib/index.spec.ts`: runtime checks of the public surface (`describe('public API: index.ts')`, `:63-217`).
  No export-drift check.
- `src/lib/utils/animate.spec.ts`: real-runtime harness (`:8-17`: real timers, `requestAnimationFrame` →
  `setTimeout(…, 16)`), selector/sequence/detach tests (`:51-132`), the MotionConfig harness test (`:145-158`)
  using `src/lib/components/__tests__/UseAnimateSkipHarness.svelte`, and a compile-only `typeAssertions()` block
  (`:161-187`).
- Test page `src/routes/tests/useAnimate/+page.svelte` (the route is `useAnimate`, camelCase; there is no
  `use-animate` route), spec `e2e/utilities/use-animate.spec.ts` (waits for `data-hydrated="true"` on
  `getByTestId('stage')`). Linked at `src/routes/+page.svelte:1126-1133` ("useAnimate", Utilities section).
- Docs: `docs/src/routes/docs/use-animate/+page.svx:125-145` (API reference: `scope.animations:
  AnimationPlaybackControlsWithThen[]`; "`animate` returns an `AnimationPlaybackControlsWithThen`…").
  Example route `docs/src/routes/examples/use-animate/+page.svelte` (an `ExampleSection[]` at `:36-…`), demo
  `docs/src/lib/examples/use-animate/demos/Default.svelte`.
- `docs/src/lib/compare-data.ts`, GSAP entry (`slug: 'gsap'`, `:202`): `:225`
  `{ name: 'Timelines with scrub / labels / nesting', us: false, them: 'Best-in-class' }`; `:280` (consUs)
  `'Timeline orchestration is shallower than GSAP — no scrub / label / nested timeline equivalents'`.
  `:247-250` is the separate `'ScrollTrigger (pin / scrub / snap)'` row (stays a difference).
- TesterPanel exemplar: `src/routes/tests/drag/disable-from-ondrag/+page.svelte` with
  `src/routes/tests/layout/_parity/TesterPanel.svelte`.

### Upstream (read with `git -C ~/Github/motion show v14.7.1:<path>`)

- `packages/framer-motion/src/animation/hooks/use-animate.ts:17-29`:
  ```ts
      const reduceMotion = useReducedMotionConfig() ?? undefined
      const { skipAnimations } = useContext(MotionConfigContext)

      /**
       * Read by timelines created with this scope.
       */
      scope.reduceMotion = reduceMotion
      scope.skipAnimations = skipAnimations

      const animate = useMemo(
          () => createScopedAnimate({ scope, reduceMotion, skipAnimations }),
          [scope, reduceMotion, skipAnimations]
      )
  ```
  `reduceMotion` was already passed at v14.6.0; the scope writes are new (`29946f8d4`). With no `MotionConfig`,
  React's context default is `reducedMotion: "never"`, so `useReducedMotionConfig()` returns `false`.
- `packages/motion-dom/src/utils/resolve-elements.ts:15-24`: `AnimationScope` gains
  `reduceMotion?: boolean` and `skipAnimations?: boolean` ("Set by useAnimate() from MotionConfig, so timelines
  created with this scope follow the same settings."). `resolveElements` (`:30-56`) has no guard for a missing
  `scope.current`.
- `packages/framer-motion/src/animation/timeline/index.ts`: `TimelineItem = Segment | Timeline` (`:22`),
  `TimelineCallback = (direction: 1 | -1) => void` (`:27`), `TimelineOptions extends SequenceOptions`
  (`autoplay`, `scope`, `onUpdate(time)`, `onRepeat`, `onReverseComplete`, `:29-53`),
  `class Timeline implements AnimationPlaybackControlsWithThen` (`:103`) with `add`, `call`, `addPause`, `move`,
  `remove`, `clear`, `getLabelTime`, `seek`, `playTo`, `reverse`, `progress`, `time`, `speed`, `duration`,
  `state` (`:202-340`). The constructor registers with `options.scope` (`:187-194`). Rebuilds read
  `scope.reduceMotion`/`scope.skipAnimations` (`:470-478`), then let explicit options win.
- `packages/framer-motion/src/animation/animate/index.ts:39-108`: every `createScopedAnimate` overload returns
  `Timeline`; the sequence overload takes `options?: Omit<TimelineOptions, "scope">`.
- `packages/framer-motion/src/dom.ts:4-20`: `export type { Timeline, TimelineCallback, TimelineItem, TimelineOptions } from "./animation/timeline"`
  (type-only: there is no runtime `Timeline` export; `c3a32c6e5` removed `timeline()`) and
  `export * from "./animation/sequence/types"`, which includes `AnimationSequence`, `NestedSequence` (new in
  14.7), `ObjectTarget`, `Segment`, `SequenceOptions` (gains `reduceMotion`/`skipAnimations`), `SequenceInfo`
  (new in 14.7). `motion`'s entry is `export * from "framer-motion/dom"`. The runtime export list of
  `motion-dom`, `motion-utils` and `framer-motion/dom` did not change between v14.6.0 and v14.7.1 (only these type
  exports were added and `HTMLElements` became `export type`), so the tripwire's allowlist built on 14.6.0
  should still hold on 14.7.1.
- Behaviour tests to port: `packages/framer-motion/src/animation/timeline/__tests__/timeline.test.ts` @ v14.7.1
  (`"segments can be added after creation"`, `"segments and the playhead can be offset from a label"`,
  `"playTo() plays to a label and pauses"`, `"registers with a scope so it stops with it"`,
  `"inherits skipAnimations from a useAnimate() scope"`);
  `packages/framer-motion/src/animation/animate/__tests__/animate.test.tsx` `"onComplete fires when played in reverse without onReverseComplete"` (`2efca17cf`);
  label offsets #2204 (`958a120bc`, `dda7afe82`). On 14.6.0, `calcNextTime` resolved an unknown label string to
  the current time, so `"mid+0.5"` started at the end of the sequence.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install (Phase B) | `pnpm install --frozen-lockfile` | exit 0 |
| One unit file | `pnpm exec vitest run <path>` | see each step |
| Unit tests | `pnpm test:only` | all pass (Phase B) |
| Typecheck | `pnpm check` | 0 errors (Phase B) |
| Build + package | `pnpm build` | exit 0 |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| One e2e spec | `PW_PORT=4219 pnpm exec playwright test <spec>` | see each step |
| Docs | `pnpm --dir docs build`, `pnpm --dir docs check`, `pnpm --dir docs test` | exit 0 / 0 errors / pass |

Playwright's `webServer` runs `npm run build && npm run preview` on `PW_PORT`, so each run rebuilds.

## Scope

**In scope** (create unless noted):

- `src/lib/utils/animate.svelte.ts` (modify: `AnimationScope`, `resolveScopedAnimate`, JSDoc)
- `src/lib/utils/animate.spec.ts` (modify: new cases, extend the compile-only block)
- `src/lib/components/__tests__/UseAnimateConfigHarness.svelte`
- `src/lib/utils/animateValue.ts` (modify: `SvelteMotionAnimate` return/option types and JSDoc)
- `src/lib/index.ts` (modify: one `export type { … } from 'motion'` block next to `export { animate }`)
- `src/lib/index.spec.ts` (modify: tripwire test, compile-only type block)
- `src/lib/__tests__/motionExportAllowlist.ts`
- `src/routes/tests/useAnimate/timeline/+page.svelte`, `e2e/utilities/use-animate-timeline.spec.ts`
- `src/routes/+page.svelte` (modify: one link after "useAnimate")
- `docs/src/routes/docs/use-animate/+page.svx`, `docs/src/routes/examples/use-animate/+page.svelte`,
  `docs/src/lib/examples/use-animate/demos/Timeline.svelte`, `docs/src/lib/compare-data.ts` (GSAP entry only)
- `.changeset/use-animate-timeline.md`

**Out of scope**:

- Wrapping or re-implementing `Timeline`. It is motion's; we only re-type and re-export.
- A runtime `Timeline` export (upstream exports it as a type only).
- Guarding pre-attach selector calls. Upstream throws; keep the throw, fix the JSDoc.
- `useReducedMotionConfig` itself, `MotionConfig`, `package.json`, `pnpm-lock.yaml`.
- Re-exporting any runtime name the tripwire reports as missing. Allowlist it and list it in your report; deciding
  new public API is not this plan's call.
- The compare-data rows of other competitors, and the GSAP `ScrollTrigger` row (`:247-250`).

## Git workflow

- Lane branch `lane/1471-animate` in `../svelte-motion-1471-animate`, created by the dispatcher from the wave-0
  SHA (Motion 14.6.0).
- Conventional commits. Phase A: `test(use-animate): MotionConfig reducedMotion reaches useAnimate animations`,
  `test(use-animate): timelines from the scoped animate`, `test(exports): tripwire for unreviewed motion exports`,
  `test(use-animate): timeline demo page`. Phase B: the merge commit, then
  `fix(use-animate): pass reducedMotion and write MotionConfig settings onto the scope`,
  `feat(types): animate returns a Timeline; re-export timeline and sequence types`,
  `docs(use-animate): timelines`, `chore(changeset): use-animate timelines`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Phase A — on Motion 14.6.0

Confirm `grep -n '"motion": "14.6.0"' package.json` prints a line. If not, STOP.

`pnpm check` may report errors in Phase A **only** in the files you create, and only where they use 14.7 APIs
(`tl.add`, `playTo`, `getLabelTime`, `autoplay`). Don't silence them with casts; list them in the report.

### Step 1: Red tests for the scope settings (our port)

Create `src/lib/components/__tests__/UseAnimateConfigHarness.svelte`, modelled on `UseAnimateSkipHarness.svelte`:
props `reducedMotion?: 'always' | 'never' | 'user'`, `skip?: boolean`, `onScope?: (scope) => void`,
`onAnimate?: (animate) => void`, `configuredChild?: boolean`. The outer branch (`configuredChild` false) renders
`<MotionConfig reducedMotion={reducedMotion} skipAnimations={skip}>` around itself with `configuredChild` and
forwards `onScope`/`onAnimate`; it does **not** call `useAnimate`'s callbacks itself. Only the inner
(`configuredChild` true) instance, the one inside `MotionConfig`, calls `useAnimate<HTMLDivElement>()`, then
`onScope?.(scope)` and `onAnimate?.(animate)` once at init. (Call `useAnimate` only in the inner branch, e.g.
inside an `{#if configuredChild}`-guarded child component or by calling it unconditionally but invoking the
callbacks only when `configuredChild`; the outer instance's scope must never reach the test.) It renders `<div {@attach scope} data-testid="scope">` containing
`<div data-testid="box" style="opacity: 0"></div>` and a button `data-testid="run-x"` whose click runs
`animate('[data-testid="box"]', { x: 100, opacity: 1 }, { duration: 2 })`.

In `src/lib/utils/animate.spec.ts` add `describe('useAnimate MotionConfig settings (upstream use-animate.ts @ v14.7.1)')`:

1. `passes reducedMotion="always" to the animations it starts`: render the harness with
   `reducedMotion: 'always'`, click `run-x`, `await sleep(100)` → the box's inline `transform` contains
   `translateX(100px)` (reduced motion makes positional keys instant) while its opacity is still below 1 (opacity
   still animates).
2. `the scope always reflects the current MotionConfig settings`: harness with
   `reducedMotion: 'always', skip: true`, capture the scope via `onScope` → **without calling `animate`**,
   `scope.reduceMotion` is `true` and `scope.skipAnimations` is `true`;
   `await rerender({ reducedMotion: 'never', skip: false })` → `false` and `false`, again without any call.
   (Upstream writes both on every render, `use-animate.ts:23-24`; here they are live.)
3. `outside a component, reduceMotion defaults to false like React's MotionConfig default`: at module scope,
   `const [scope] = useAnimate()` → `scope.reduceMotion` is `false` and `scope.skipAnimations` is `undefined`.
4. Guard, `selector calls before the attachment fires throw, like upstream`: `const [, animate] = useAnimate()`
   → `expect(() => animate('li', { opacity: 1 })).toThrow(TypeError)`; and `animate(el, { opacity: 0.5 }, { duration: 0.01 })`
   on a fresh element does not throw.

**Verify**: `pnpm exec vitest run src/lib/utils/animate.spec.ts` → cases 1, 2, 3 **FAIL** (transform still
tweening / `scope.reduceMotion` undefined); case 4 and every existing case pass. If case 4 fails, STOP (the
behaviour differs from what this plan assumes).

### Step 2: Red tests for timelines through the scoped animate (come with the bump)

Add `describe('useAnimate timelines (Motion 14.7)')` to `src/lib/utils/animate.spec.ts`. Use motion values
(`motionValue` from `motion`) as subjects so no DOM timing is involved, a `scope` attached to a fresh `div`, and
`sleep` for waits. Cite each upstream test name in a comment.

1. `segments added after it starts run, and detaching the scope stops them`
   (`"segments can be added after creation"`, `"registers with a scope so it stops with it"`):
   `const tl = animate([[a, 100, { duration: 0.2 }]])`; `tl.add([b, 50, { duration: 0.2 }])`; `await sleep(0)`;
   expect `scope.animations` to contain `tl`; run the attachment cleanup; `await sleep(450)` → `b.get()` is
   `< 50` and `scope.animations` is empty.
2. `segments can be offset from a label` (#2204): `const tl = animate([[a, 100, { duration: 1 }], 'mid', [a, 200, { duration: 1 }], [b, 50, { duration: 1, at: 'mid+0.5' }]], { autoplay: false })`
   → `tl.duration` is `2.5` (14.6.0 places `b` at the end: `3`) and `tl.getLabelTime('mid')` is `1`.
3. `playTo() plays to a label and pauses`: `animate([[a, 100, { duration: 0.2, ease: 'linear' }], 'end', [a, 200, { duration: 0.2, ease: 'linear' }]], { autoplay: false, defaultTransition: { ease: 'linear' } })`,
   `tl.playTo('end')`, `await sleep(400)` → `a.get()` is `100` (±1) and `tl.state` is `'paused'`.
4. `MotionConfig skipAnimations reaches segments added later` (`"inherits skipAnimations from a useAnimate() scope"`):
   use `UseAnimateConfigHarness` with `skip: true`, capture `animate` through `onAnimate`, then
   `const tl = animate([[a, 100, { duration: 10 }]])`, `tl.add([b, 50, { duration: 10 }])`, `await sleep(100)` →
   `a.get()` is `100` and `b.get()` is `50`.
4b. `a MotionConfig change after the timeline is created reaches its next rebuild`: harness with `skip`
   **unset** (`undefined`), capture `animate`; `const tl = animate([[a, 100, { duration: 10 }]])`;
   `await rerender({ skip: true })`; `tl.add([b, 50, { duration: 10 }])`; `await sleep(100)` → `b.get()` is `50`
   (the rebuild read `scope.skipAnimations`, timeline `index.ts:470-478`). Start from `undefined`, not `false`:
   upstream's timeline lets the options captured at creation win over the scope (`Object.assign(playback, options)`),
   so a `false` → `true` change wouldn't reach the rebuild in Motion either. Don't assert that direction.
   This case also stays red after the merge until Step 7 (our scope fields don't exist yet).
5. Guard, `onComplete fires when played in reverse without onReverseComplete` (`2efca17cf`):
   `const c = animate(0, 100, { duration: 0.05, ease: 'linear', onUpdate: (v) => out.push(v), onComplete })`;
   `c.time = c.duration; c.speed = -1; await c` → `onComplete` called once and the last output is `0`. Passes on
   14.6.0 too (plain animations already did this); it guards the timeline wrapper.

**Verify**: `pnpm exec vitest run src/lib/utils/animate.spec.ts` → cases 1-4 and 4b **FAIL** (`tl.add is not a
function`, `tl.getLabelTime is not a function`/duration `3`, `tl.playTo is not a function`); case 5 passes.

### Step 3: Export-drift tripwire (guard)

1. Create `src/lib/__tests__/motionExportAllowlist.ts` exporting
   `export const MOTION_EXPORTS_NOT_REEXPORTED: ReadonlySet<string>`. Top comment: every runtime export of
   `motion` must be either re-exported from `src/lib/index.ts` or listed here; when a Motion bump makes the
   tripwire fail, decide per new name (re-export with docs, or add here under the right group with a reason).
2. In `src/lib/index.spec.ts` add:
   ```ts
   it('re-exports or deliberately skips every runtime export of motion', async () => {
       const motionExports = Object.keys(await import('motion')).sort()
       const ours = (await import('./index.js')) as Record<string, unknown>
       const unaccounted = motionExports.filter(
           (name) => !(name in ours) && !MOTION_EXPORTS_NOT_REEXPORTED.has(name)
       )
       expect(unaccounted, 'motion exports that are neither re-exported nor allowlisted').toEqual([])
       const stale = [...MOTION_EXPORTS_NOT_REEXPORTED].filter(
           (name) => !motionExports.includes(name) || name in ours
       )
       expect(stale, 'allowlist entries motion no longer exports, or that we now re-export').toEqual([])
   })
   ```
3. Run it once with an empty set. Copy the reported `unaccounted` names into the set, **grouped** with a one-line
   comment per group (for example: renderer and VisualElement internals; projection and layout internals;
   animation engine classes (`JSAnimation`, `NativeAnimation`, …); keyframe resolvers and value types; frameloop
   and stats internals; gesture and drag internals; effect internals; colour/mix/number utilities not yet
   re-exported; optimized-appear internals). Don't comment every name.

**Verify**: `pnpm exec vitest run src/lib/index.spec.ts` → all pass. Report the allowlist size.

### Step 4: Timeline demo page and e2e

Create `src/routes/tests/useAnimate/timeline/+page.svelte`: header comment (Motion 14.7 `Timeline` via the scoped
`animate`; upstream `timeline.test.ts` @ v14.7.1), `const [scope, animate] = useAnimate()`, a stage
`<div {@attach scope} data-testid="stage" data-hydrated={hydrated}>` (set `hydrated` in `onMount`, like
`src/routes/tests/useAnimate/+page.svelte`) with three 40×40 boxes `.a`, `.b`, `.c` (`data-testid` `box-a` …).
On mount build `tl = animate([['.a', { x: 200 }, { duration: 1, ease: 'linear' }], 'mid', ['.b', { x: 200 }, { duration: 1, ease: 'linear' }]], { autoplay: false, onUpdate: (t) => (time = t), onComplete: () => (completed += 1) })`.
Buttons: `add-c` (`tl.add(['.c', { x: 200 }, { duration: 1, ease: 'linear' }], 'mid+0.5')`), `play-to-mid`
(`tl.playTo('mid')`), `play` (`tl.play()`), `reverse` (`tl.reverse()`). Readouts (`data-testid`): `duration`
(`tl.duration.toFixed(2)`, refreshed after each button and from `onUpdate`), `time` (2 decimals), `state`,
`completed` (count). Add a guided TesterPanel (steps: Add C → duration reads 2.50; Play to mid → A slides, stops,
state paused; Play → B, then C half a second after B starts; Reverse → everything slides back and "completed"
increments) with a live verdict that is skipped under `@isPlaywright=true`.

Create `e2e/utilities/use-animate-timeline.spec.ts` (load `/tests/useAnimate/timeline?@isPlaywright=true`, wait
for `data-hydrated="true"`):

1. `duration` reads `2.00`; click `add-c` → `2.50`.
2. click `play-to-mid` → within 2 s `state` is `paused`, `time` is `1.00` (±0.05), `box-a` translateX ≈ 200,
   `box-b` ≈ 0.
3. click `play` → within 3 s `completed` is `1` and `box-c` ≈ 200; click `reverse` → within 4 s `completed` is
   `2` and all three boxes ≈ 0.

Link it from `src/routes/+page.svelte` right after the "useAnimate" link (`:1126-1133`): "useAnimate — timelines
(Motion 14.7)".

**Verify**: `PW_PORT=4219 pnpm exec playwright test e2e/utilities/use-animate-timeline.spec.ts e2e/utilities/use-animate.spec.ts`
→ the new spec **FAILS** (on 14.6.0 `autoplay: false` is ignored and `tl.add`/`playTo` are not functions, so
readouts don't match); `use-animate.spec.ts` passes.

### Step 5: Phase A gate, then STOP

`trunk fmt` / `trunk check` on every file you created or changed. `pnpm test:only` → the only failures are Step 1
cases 1-3 and Step 2 cases 1-4 and 4b. `pnpm check` → errors only in your new code, only for 14.7 APIs. Commit (the four
`test(...)` commits). **STOP and report "phase A red"** with a table of every new test → PASS / FAIL (with the
failure) / "not red on 14.6.0: reason", the allowlist size, the `pnpm check` error list, and the commit SHAs.

### Phase B — after the dispatcher says 001 is merged

### Step 6: Merge the bump; the timeline tests go green

1. `git merge --no-ff feat/motion-14.7.1`, then `pnpm install --frozen-lockfile`. Confirm
   `grep -n '"motion": "14.7.1"' package.json` prints a line and `grep -m1 '"version"' node_modules/motion/package.json`
   shows `14.7.1`. If not, STOP.
2. `find node_modules/.pnpm -path '*framer-motion@14.7.1*' -name 'index.mjs' -path '*animation/timeline*'` → one
   path; `grep -c "reduceMotion" <that path>` ≥ 1. If not found, STOP.
3. `pnpm exec vitest run src/lib/utils/animate.spec.ts` → Step 2 cases 1-5 **pass**; Step 1 cases 1-3 and
   Step 2 case 4b still **FAIL** (our port: the scope has no live settings yet).
4. `pnpm exec vitest run src/lib/index.spec.ts` → the tripwire still passes. If it now lists names, add them to
   the allowlist under a `// new in Motion 14.7.1 — not yet reviewed for re-export` group and list them in your
   report.
5. `PW_PORT=4219 pnpm exec playwright test e2e/utilities/use-animate-timeline.spec.ts` → **passes**.

If a Step 2 test or the e2e is still red, re-run it alone once; if still red, STOP and report the value.

### Step 7: Port the scope settings in `useAnimate`

In `src/lib/utils/animate.svelte.ts`:

1. Add to `AnimationScope` (`:20-25`), with JSDoc in the file's style:
   `readonly reduceMotion?: boolean` ("MotionConfig's resolved `reducedMotion`, read live from the nearest
   `MotionConfig`. Timelines created with this scope follow it when they rebuild.") and
   `readonly skipAnimations?: boolean` (same, for `skipAnimations`). `readonly` because they are getters.
2. Add a module-private resolver that mirrors `useReducedMotionConfig`'s policy without hooks (it must work at
   module scope):
   ```ts
   const resolveReduceMotion = (config: MotionConfigProps | undefined): boolean | undefined => {
       const policy = config?.reducedMotion ?? 'never'
       if (policy === 'always') return true
       if (policy === 'never') return false
       if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
       try {
           return window.matchMedia('(prefers-reduced-motion: reduce)').matches
       } catch {
           return undefined
       }
   }
   ```
   Comment: upstream `use-animate.ts:17` is `useReducedMotionConfig() ?? undefined`, and React's MotionConfig
   context defaults to `"never"`, hence `false` with no config.
3. Upstream writes both onto the scope on **every render** (`use-animate.ts:23-24`), so a timeline rebuilt by a
   later `tl.add()` sees the current MotionConfig. Svelte has no re-render to hook, so make them live getters on
   the scope, defined once right after `scope.animations = []` (`:92-93`):
   ```ts
       // Upstream use-animate.ts:23-24 writes these every render; getters keep
       // them current without one. Read by Timeline rebuilds (timeline index.ts:470-478).
       Object.defineProperties(scope, {
           reduceMotion: { get: () => resolveReduceMotion(motionConfig), enumerable: true },
           skipAnimations: { get: () => motionConfig?.skipAnimations, enumerable: true }
       })
   ```
   `motionConfig` must be declared before this (move the `defineProperties` call below the `try/catch` at
   `:105-110` if needed). In `resolveScopedAnimate`, read both values per call and rebuild the cached scoped
   animate when either changes:
   ```ts
       const skipAnimations = motionConfig?.skipAnimations
       const reduceMotion = resolveReduceMotion(motionConfig)
       if (!hasCached || cachedSkip !== skipAnimations || cachedReduce !== reduceMotion) {
           // …
           cachedScoped = createScopedAnimate({
               scope: scope as MotionAnimationScope<T>,
               reduceMotion,
               skipAnimations
           }) as SvelteMotionAnimate
       }
   ```
   (Upstream passes both keys even when `undefined`; `createScopedAnimate` ignores `undefined`.)
4. Fix the JSDoc (`:41-48`): replace the "ignores calls" sentence with: "Selector strings resolve against
   `scope.current`, so calling `animate('li', …)` before the attachment fires throws, as in Motion. Element and
   motion-value subjects work at any time. Trigger selector animations from user events or `$effect` after
   mount." Extend the MotionConfig paragraph: `reducedMotion` and `skipAnimations` are both read per call, passed
   to every animation, and exposed live on `scope` so timelines rebuilt later (`tl.add(…)`) follow them. Add one
   sentence that `animate` returns a `Timeline` (Motion 14.7) and link `https://motion.dev/docs/animate`.

**Verify**: `pnpm exec vitest run src/lib/utils/animate.spec.ts` → all pass, including Step 1 cases 1-3 and
Step 2 case 4b.

### Step 8: Types and re-exports

1. `src/lib/utils/animateValue.ts`: import `type Timeline` and `type TimelineOptions` from `motion`. Change every
   signature in `SvelteMotionAnimate` to return `Timeline`, and the sequence one to
   `(sequence: AnimationSequence, options?: Omit<TimelineOptions, 'scope'>): Timeline`, matching upstream
   `animate/index.ts:39-108` @ v14.7.1 (keep our `AnyMotionValue` widening and the overload order). Drop the
   now-unused imports (`AnimationPlaybackControlsWithThen`, maybe `SequenceOptions`). Update the interface JSDoc:
   returns a mutable `Timeline` (Motion 14.7) and the `:105-106` re-check note now cites v14.7.1.
2. `src/lib/index.ts`: right after `export { animate } from '$lib/utils/animateValue'` (`:51`) add
   ```ts
   // Motion 14.7: animate() returns a mutable Timeline. Type-only upstream too.
   export type {
       AnimationSequence,
       NestedSequence,
       ObjectTarget,
       Segment,
       SequenceInfo,
       SequenceOptions,
       Timeline,
       TimelineCallback,
       TimelineItem,
       TimelineOptions
   } from 'motion'
   ```
   If any name is already exported elsewhere in `index.ts` (plan 001 may have added some), don't duplicate it.
3. `src/lib/index.spec.ts`: add a compile-only block (same pattern as `src/lib/utils/animate.spec.ts:161-187`)
   importing those ten types from `./index.js` and asserting, e.g.:
   ```ts
   function timelineTypeAssertions() {
       const tl: Timeline = animate([['.a', { opacity: 1 }], 'mid'], { autoplay: false })
       const item: TimelineItem = ['.b', { opacity: 0 }]
       tl.add(item, 'mid+0.5')
       const onCross: TimelineCallback = (direction) => void direction
       tl.call(onCross, 1)
       const nested: NestedSequence = { sequence: [['.c', { x: 10 }]], at: 0.5 }
       const sequence: AnimationSequence = [nested, 'end']
       const segment: Segment = sequence[0]
       const options: Omit<TimelineOptions, 'scope'> = { onReverseComplete: () => {} }
       const sequenceOptions: SequenceOptions = { duration: 1, reduceMotion: true }
       const info: SequenceInfo = { duration: 1 }
       const target: ObjectTarget<{ n: number }> = { n: 1 }
       const [, scoped] = useAnimate()
       const fromValue: Timeline = scoped(0, 100)
       // @ts-expect-error the scope comes from useAnimate(), not per call
       scoped([['.a', { opacity: 1 }]], { scope: undefined })
       void [segment, options, sequenceOptions, info, target, fromValue]
   }
   void timelineTypeAssertions
   ```
   Also extend `animate.spec.ts`'s `typeAssertions()` with `const tl: Timeline = scopedAnimate('.box', { opacity: 0.5 })`
   and `tl.add(['.box', { opacity: 1 }])`.

**Verify**: `pnpm check` → 0 errors (this also typechecks the Step 2 and Step 4 code). If `pnpm check` reports the `@ts-expect-error` above as unused (the per-call `scope` option compiles), STOP and report it; don't loosen or delete the assertion. `pnpm exec vitest run src/lib/index.spec.ts src/lib/utils/animate.spec.ts` → all pass.

### Step 9: Docs

1. `docs/src/routes/docs/use-animate/+page.svx`: replace the "API Reference / Returns" text (`:125-145`): `scope`
   gains `scope.reduceMotion` / `scope.skipAnimations`; `scope.animations` holds the timelines started through it;
   `animate` returns a `Timeline` (Motion 14.7). Add a "## Timelines" section before "## Cleanup" covering:
   `add(item, at?)`, `call(callback, at?)`, `addPause(at?)`, `move`, `remove`, `clear`, labels and label offsets
   (`'mid+0.5'`), nesting (a timeline or `{ sequence, at }` as an item), `seek`/`playTo`/`reverse`, `progress`,
   `time`, `speed`, the options `autoplay`, `onUpdate(time)`, `onRepeat`, `onReverseComplete`, and that changes are
   batched per microtask and rebuilt without a jump. Add "## MotionConfig": `reducedMotion` and `skipAnimations`
   apply to everything started through the scoped `animate`, including segments added later. Note under the
   first example that selector calls before the attachment fires throw. Embed the new demo with
   `<Example isSmall exampleUrl="/examples/use-animate">`.
2. `docs/src/lib/examples/use-animate/demos/Timeline.svelte`: three bars on a timeline with a label, buttons
   "Add", "Play to label", "Reverse", and a live time readout. Add it as a second `ExampleSection`
   (`figId: 'FIG-002'`) in `docs/src/routes/examples/use-animate/+page.svelte`, matching the first section's
   shape.
3. `docs/src/lib/compare-data.ts`, GSAP entry only: replace the `:225` row with two rows,
   `{ name: 'Timelines with labels / nesting / reverse', us: 'animate() Timeline (labels, offsets, nesting, playTo)', them: 'Best-in-class' }`
   and `{ name: 'Timeline scrubbing', us: 'Partial (set progress / time; scroll-linked via useScroll)', them: 'Best-in-class (ScrollTrigger scrub)' }`.
   Replace the `:280` consUs line with
   `'Timelines cover labels, nesting and reverse, but scrub and ScrollTrigger-style pinning are still GSAP territory'`.
   Leave the ScrollTrigger row and the verdict as they are.
4. `.changeset/use-animate-timeline.md` (bump `minor`): "`animate()` and `useAnimate()`'s scoped `animate` return
   Motion 14.7's mutable `Timeline`: add, move and remove segments, labels (with offsets like `'mid+0.5'`),
   callbacks and pauses while it plays, nest timelines, `playTo` a label and `reverse`. The `Timeline`,
   `TimelineCallback`, `TimelineItem`, `TimelineOptions`, `AnimationSequence`, `NestedSequence`, `ObjectTarget`,
   `Segment`, `SequenceOptions` and `SequenceInfo` types are exported. `useAnimate` now passes
   `<MotionConfig reducedMotion>` to its animations (it already passed `skipAnimations`) and writes both onto
   `scope`, as Motion does. Like Motion, with no `MotionConfig` it animates transforms regardless of the OS
   reduced-motion setting."

**Verify**: `pnpm build` (exit 0), then `pnpm --dir docs build` (exit 0), `pnpm --dir docs check` (0 errors),
`pnpm --dir docs test` (all pass; `docs/scripts/geo-seo-output.test.ts` reads the compare data). If the docs build
fails only because the network blocks the GitHub stats fetch, record that and continue.

### Step 10: Search for stale return-type claims

`grep -rn "AnimationPlaybackControlsWithThen" src/lib/utils/animate.svelte.ts src/lib/utils/animateValue.ts docs/src/routes/docs/use-animate`
→ only the `scope.animations` element type in `animate.svelte.ts` (if kept) and nothing in docs. Fix any other
hit in those files.

### Step 11: Phase B gate

`pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm package` (publint clean),
`PW_PORT=4219 pnpm exec playwright test e2e/utilities e2e/motion/arc-use-animate.spec.ts e2e/drag/mobile-drawer.spec.ts`
(all pass; these are every spec whose page uses `useAnimate`; re-run a failing spec alone once before reporting). `trunk fmt` /
`trunk check` on every changed file (clean). `git diff --check` clean. `git status` shows only in-scope files.
Report the results.

## Test plan

- Red-first anchors:
  - Our port (red on 14.6.0 and still red after the merge until Step 7): Step 1 cases 1-3, Step 2
    case 4b.
  - Comes with the bump (red on 14.6.0, green after Step 6): Step 2 cases 1-4; the timeline e2e.
- Guards: Step 1 case 4 (pre-attach selector throw, matches upstream), Step 2 case 5 (reverse `onComplete`,
  green on 14.6.0 because plain animations already fired it), the tripwire (green in both phases; it fails only
  when Motion adds or drops a runtime export), and the existing `animate.spec.ts`, `index.spec.ts`,
  `e2e/utilities/use-animate.spec.ts`.
- Compile-only: the Step 8 type blocks, checked by `pnpm check`.
- Patterns: `src/lib/utils/animate.spec.ts` (harness and compile-only block),
  `src/lib/components/__tests__/UseAnimateSkipHarness.svelte`, `e2e/utilities/use-animate.spec.ts`,
  `src/routes/tests/drag/disable-from-ondrag/+page.svelte` (TesterPanel).

## Done criteria

- [ ] Phase A report lists every new test with its 14.6.0 result; the red ones fail for the stated reasons
- [ ] Phase B: `pnpm test:only` passes; `pnpm check` 0 errors; `pnpm package` clean; listed Playwright specs pass
- [ ] `grep -n "defineProperties(scope" src/lib/utils/animate.svelte.ts` → 1 match and `grep -n "scope.reduceMotion = \|scope.skipAnimations = " src/lib/utils/animate.svelte.ts` → none (live getters, no writes); `grep -n "ignores calls before" src/lib/utils/animate.svelte.ts` → none
- [ ] `grep -c "): Timeline" src/lib/utils/animateValue.ts` → 6
- [ ] `src/lib/index.ts` type-exports the ten names; the tripwire test exists and passes
- [ ] New page has a TesterPanel hidden under `@isPlaywright=true` and is linked from `src/routes/+page.svelte`
- [ ] Docs page, demo + example section, GSAP rows and `.changeset/use-animate-timeline.md` exist; docs build/check/test pass
- [ ] `trunk check` clean on changed files; no out-of-scope files modified

## STOP conditions

- Phase A isn't on motion 14.6.0, or Phase B isn't on 14.7.1 after the merge and install.
- Step 1 case 4 fails in Phase A (pre-attach behaviour differs from this plan's reading).
- A Step 2 case or the timeline e2e is still red in Phase B after one solo re-run.
- Any of the ten type names isn't exported by `motion` 14.7.1 (`pnpm check` reports it missing).
- The Step 8 `@ts-expect-error` (per-call `scope`) is reported unused. Report it; don't loosen the assertion.
- Re-typing `SvelteMotionAnimate` breaks existing callers in `src/` or `docs/` in a way that needs more than a
  type annotation change. Report the call sites instead of changing runtime code.
- The tripwire's `unaccounted` list is not empty after Step 6 and contains names that look like public API
  (functions documented on motion.dev). Allowlist them as instructed, but call them out in the report.

## Maintenance notes

- The tripwire is the bump-time check: when it fails after a Motion upgrade, triage each new name (re-export with
  docs, or allowlist with a group reason). Don't delete the stale-entry assertion; it keeps the list honest.
- `resolveReduceMotion` duplicates `useReducedMotionConfig`'s policy because hooks can't run at module scope. If
  the policy changes (a new `ReducedMotionConfig` value), update both; consider extracting a shared pure resolver
  then.
- Behaviour change to flag in review: with no `MotionConfig`, `useAnimate` now passes `reduceMotion: false`, as
  Motion's React `useAnimate` does, so transforms animate even when the OS asks for reduced motion. Components
  already default to `'never'`, so this aligns `useAnimate` with them.
- `scope.reduceMotion`/`scope.skipAnimations` only matter for timelines rebuilt from `scope`; explicit options on
  a call still win (timeline `index.ts:470-478`).
- If a later plan (010, 011 or any other) re-exports a `motion` runtime name that is on
  `MOTION_EXPORTS_NOT_REEXPORTED`, that plan must remove the name from the allowlist in the same change, or the
  tripwire's stale-entry assertion fails. Dispatchers merging those lanes after this one: check for it.
- Deferred: a runtime `Timeline` export (upstream has none) and GSAP-style scrub/pinning helpers.
