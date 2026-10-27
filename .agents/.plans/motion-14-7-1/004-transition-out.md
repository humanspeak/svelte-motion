# Plan 004: Support `transition.out`, including the SSR optimized-appear animation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **This is a two-phase plan.** Phase A (Steps 1-5) runs on Motion **14.6.0** and writes only tests and test
> pages. It must end with the new tests failing in the ways listed. After Step 5 you **STOP and report
> "phase A red"** with the per-test results table. Do not start Phase B until the dispatcher tells you to.
> Phase B (Steps 6-11) merges plan 001's bump to 14.7.1, confirms the runtime half went green on its own,
> then ports the SSR half (our code) and the types, docs and changeset.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4214** (`PW_PORT=4214`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/utils/optimizedAppear.ts src/lib/utils/optimizedAppear.spec.ts src/lib/html/_MotionContainer.svelte src/lib/html/_MotionContainer.ssr.spec.ts src/lib/types.ts src/routes/tests/optimized-appear src/routes/+page.svelte e2e/motion docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts docs/src/routes/docs/optimized-appear package.json`
> Expected: no output. On any output, compare the "Current state" excerpts with the live code; on a mismatch,
> STOP. (In Phase B, run the same command against `feat/motion-14.7.1` instead of `HEAD` after the merge, and
> expect only plan 001's and other merged plans' changes; re-check the excerpts below before editing.)

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (the runtime half is upstream's; the SSR generator and the timing-sensitive e2e specs are ours)
- **Depends on**: 001 (Phase B only: `transition.out` is implemented in motion-dom 14.7.1's
  `createAnimationState`/`animateTarget`, and its `out` type lives in motion-dom 14.7.1's `ValueTransition`; plan
  001 pins 14.7.1). Phase A runs on 14.6.0 and depends on nothing.
- **Wave**: 1 for Phase A; Phase B after 001 is committed on `feat/motion-14.7.1`
- **Category**: direction (upstream parity, new public transition option)
- **Planned at**: commit `f8ac71aa` (main after the 14.6.0 release, `motion`/`motion-dom` pinned `14.6.0`), 2026-10-27

## Why this matters

Motion 14.7 adds `transition.out` (#1725): the transition a value uses when it **leaves** a state for a
lower-priority one. `whileHover={{ scale: 2, transition: { out: true, duration: 0.2 } }}` makes hover end use
hover's own transition; `initial={{ scale: 0, transition: { out: { delay: 1 } } }}` delays only the mount
animation, not every later return to `animate`. Before this, the state being entered always chose the
transition, so a mount-only delay also delayed hover-end, a frequent complaint.

The runtime half is motion-dom's and reaches us through plan 001's bump, because our components drive
motion-dom's `createAnimationState`. Two parts are ours:

1. **SSR optimized appear.** Our server-side generator builds the WAAPI appear animation from the `transition`
   prop only. Upstream's rule (commits `ad11115e9` then `1a451de16`) is: build it from `initial`'s
   `transition.out` when set, otherwise from `animate`'s transition. The runtime's mount animation (and so the
   hydration handoff) follows that rule. If the generator doesn't, the hydrated runtime continues with a
   different duration from the same start time, and the element visibly jumps on hydration. The generator also
   ignores `animate.transition` today, a pre-existing gap the same rule fixes.
2. **Types.** `MotionInitial` and `MotionAnimate` don't accept an inline `transition`, so
   `initial={{ opacity: 0, transition: { out: … } }}` doesn't typecheck.

This plan also adds the tests that prove the runtime half works through our components, test pages, docs, an
example and a changeset.

## Current state

### Our wiring (verified at `f8ac71aa`)

- `src/lib/utils/visualElementCore.ts` creates the node; its `animationState` is motion-dom's
  `createAnimationState`. `src/lib/html/_MotionContainer.svelte:1641-1649` `runAnimateChanges()` calls
  `void animationState.animateChanges()`. Mount, variants and gestures all go through it, so the runtime half
  needs no source change.
- The node's props carry `initial`, `animate`, `while*`, `exit` and `transition` with any inline `transition`
  intact. `_MotionContainer.svelte:544` sends `initial: filterReducedMotionDefinition(effectiveInitialProp)`,
  `:566` sends `transition: mergeTransitions(motionConfig?.transition ?? {}, transitionProp ?? {})`.
  `filterReducedMotionKeyframes` (`src/lib/utils/reducedMotionConfig.svelte.ts:69-79`) only removes transform
  keys, so `transition` survives.
- The SSR generator call, `_MotionContainer.svelte:1321-1327`:
  ```ts
      const optimizedAppearEntries = $derived(
          createOptimizedAppearData(
              initialKeyframes as Record<string, unknown> | undefined,
              animateKeyframes,
              mergedTransition
          )
      )
  ```
  `initialKeyframes` (`:1260-1265`) is `filterReducedMotionKeyframes(getInitialKeyframes(resolvedInitial))`, and
  `resolvedInitial` (`:1216-1218`) is `resolveInitial(effectiveInitialProp, variantsProp, effectiveCustom)`.
  `resolveInitial` (`src/lib/utils/variants.ts:130-140`) returns an object `initial` as-is and resolves labels
  with `resolveVariantList`, which **merges** a list of labels (`variants.ts:82-107`). So `initialKeyframes`
  carries `initial.transition`, and for a list of labels it carries the **last** label's transition.
  `animateKeyframes` (`:1271-1276`) likewise carries `animate.transition`. `mergedTransition` (`:712-714`) is
  `mergeTransitions(motionConfig?.transition ?? {}, transitionProp ?? {})`. `effectiveInitialProp` is defined at
  `:1011-1018`; `variantsProp`/`effectiveCustom` are in scope there.
- `src/lib/utils/optimizedAppear.ts:247-292`, `createOptimizedAppearData(initial, animate, transition?)`. Every
  entry's options come from the third argument only:
  ```ts
          options: toNativeOptions(getValueTransition(transition, 'opacity'))   // :265
          options: toNativeOptions(getValueTransition(transition, 'transform')) // :275
          options: toNativeOptions(getValueTransition(transition, key))         // :287
  ```
  Neither `initial.transition` nor `animate.transition` is read. `toNativeOptions` (`:154-172`) reads only
  `duration` (default 0.3 s), `delay` and `ease`. The local `getValueTransition` (`:190-206`) mirrors upstream's.
- Stale comment, `optimizedAppear.ts:174-182`:
  ```ts
  /**
   * Non-composite values the appear bootstrap may animate by name. Mirrors
   * upstream motion-dom's `acceleratedValues` allowlist: WAAPI-safe properties
   * that need no Motion-side normalization. `opacity` and the composite
   * `transform` are handled by their dedicated paths in
   * {@link createOptimizedAppearData}; `backgroundColor` stays on the main
   * thread, matching upstream (disabled pending Chromium issue 41491098).
   */
  const APPEAR_VALUES = new Set(['filter', 'clipPath'])
  ```
  Upstream 14.7.1 removed `backgroundColor` from `acceleratedValues` for a different reason (`f9e080f21`,
  see below).
- Types, `src/lib/types.ts`: `MotionInitial` (`:84`) is
  `DOMKeyframesDefinition | string | string[] | false | undefined`. `MotionAnimate` (`:197-208`) is
  `DOMKeyframesDefinition | { [K in keyof DOMKeyframesDefinition]: DOMKeyframesDefinition[K] | null } | string | string[] | AnimationControls | undefined`.
  Neither object form has `transition`. motion-dom's `DOMKeyframesDefinition` omits a `transition` key (its
  `CSSStyleDeclarationWithTransform` omits `"transition"`). Compare the gesture types, which already have it,
  e.g. `MotionWhileHover` (`:286-291`): `(Record<string, unknown> & { transition?: AnimationOptions }) | …`, and
  `VariantTarget` (`:41`): `DOMKeyframesDefinition & { transition?: AnimationOptions }`. `AnimationOptions` is
  imported from `motion` at `:3`. `MotionTransition = AnimationOptions | undefined` (`:247`). At 14.7.1
  `AnimationOptions` includes `ValueTransition`, which gains `out?: boolean | Transition`, so `transition.out`
  typechecks once the pins move. No change to `MotionTransition` is needed.
- Tests:
  - `src/lib/utils/optimizedAppear.spec.ts`: generator unit tests, e.g. `:92-107`
    `'resolves per-key transitions like upstream getValueTransition'`. Model new cases on it.
  - `src/lib/html/_MotionContainer.ssr.spec.ts:106-118` renders a `MotionContainer` and asserts the appear
    script is in `container.innerHTML`. Its `beforeEach` (`:6-13`) resets the appear globals. Model on it.
  - `src/lib/html/_MotionContainer.spec.ts` mocks `motion` and `motion-dom` at the top, so it can't observe real
    transitions. Don't add cases there. The real-runtime harness to copy is `src/lib/utils/animate.spec.ts:8-17`
    (real timers, `requestAnimationFrame` → `setTimeout(…, 16)`, `sleep` from `$lib/utils/testing`), plus the
    `matchMedia` stub for hover from `_MotionContainer.spec.ts:604-621`, plus `latestValuesOf` from
    `_MotionContainer.spec.ts:84-89` (reads `visualElementStore.get(el).latestValues`). Tap uses
    `fireEvent.pointerDown(el)` / `fireEvent.pointerUp(el)` (`_MotionContainer.spec.ts:187-188`).
  - Harness components live in `src/lib/components/__tests__/` (for example `PresenceMotionExitHarness.svelte`).
  - e2e: `e2e/motion/optimized-appear.spec.ts` samples opacity every frame from an `addInitScript`; its page is
    `src/routes/tests/optimized-appear/+page.svelte`. TesterPanel exemplar:
    `src/routes/tests/drag/disable-from-ondrag/+page.svelte` with
    `src/routes/tests/layout/_parity/TesterPanel.svelte` (`TesterStep` = `{ text, expected, action? }`; the
    live verdict is skipped when `window.location.search` includes `@isPlaywright=true`).
  - Links: `src/routes/+page.svelte:309-316` is the "Optimized appear animations" link (pattern:
    `<li><a class="text-blue-300 hover:underline" href={resolve('/tests/…') + searchParams}>…</a></li>`).

### Upstream (read with `git -C ~/Github/motion show v14.7.1:<path>`)

- `packages/motion-dom/src/animation/types.ts:520-538`, `ValueTransition.out?: boolean | Transition` with JSDoc
  ("The transition a value uses when it leaves this state for a lower-priority one… `true` reuses this
  transition… On `initial`, it's used for the mount animation.").
- `packages/motion-dom/src/render/utils/animation-state.ts`:
  - `getOutTransition = (transition) => transition?.out === true ? transition : transition?.out`
  - `resolveInitial(definition = initial)` resolves `Array.isArray(definition) ? definition[0] : definition`, so
    for a list of labels, `out` is read from the **first** label.
  - `initialOut = isMounting && getOutTransition(resolveInitial(initial ?? (source && source.props.initial))?.transition)`;
    variant children inherit the parent's `initial` (`6c6a96940`).
  - Per type, one `out` (the last label in a list that sets it, `34968ee4b`); `removedKeys` maps a key to the
    out of the highest-priority state it leaves.
- `packages/motion-dom/src/animation/interfaces/visual-element-target.ts:99-105`:
  ```ts
          const valueTransition = {
              delay,
              ...getValueTransition(
                  animationTypeState?.out[key] || transition || {},
                  key
              ),
          }
  ```
  `transition` there is `animate`'s own `transition` resolved with `resolveTransition(transition, defaultTransition)`
  (merges only on `inherit: true`), else the element's `transition` prop (`:45-48`).
- `packages/motion-dom/src/animation/utils/is-transition-defined.ts`: `"out"` is an orchestration key
  (`7a56387a9`), so `{ out: … }` alone keeps the value's default transition (springs for `x`, etc.).
- `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx` @ v14.7.1: the 17 runtime tests ported
  below (one is `test.each` over StrictMode, which has no Svelte equivalent, so 16 cases).
- `dev/html/public/optimized-appear/initial-out.html` @ v14.7.1: `initial` `{ opacity: 0, transition: { out: { duration: 2.4, ease: "linear" } } }`,
  `animate` `{ opacity: 1 }`, `transition` `{ duration: 0.6, ease: "linear" }`; the appear animation is started
  with the out transition (2400 ms linear); hydration after 150 ms; samples opacity every frame and fails if it
  drops by more than 0.02 or rises by more than `dt / 2.4 s + 0.08`.
- `packages/framer-motion/src/animation/optimized-appear/__tests__/handoff-out.test.tsx` @ v14.7.1: the handoff
  call shape is unchanged (`MotionHandoffAnimation(id, value, frame)`, 3 args). Commit `1a451de16` message: "The
  generator builds the appear animation from initial's transition.out when it's set, otherwise from animate's
  transition, and the runtime's mount animation, handoff included, already follows that rule."
- `packages/motion-dom/src/animation/waapi/utils/accelerated-values.ts` @ v14.7.1 (`f9e080f21`):
  "Colors aren't included: WAAPI mixes them in sRGB, but JS animations (and the sampler that estimates a WAAPI
  value on interrupt) mix them in linear color space, so interrupting one would visibly jump."
- motion-dom exports `resolveTransition` (`packages/motion-dom/src/index.ts`,
  `export * from "./animation/utils/resolve-transition"`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install (Phase B) | `pnpm install --frozen-lockfile` | exit 0 |
| One unit file | `pnpm exec vitest run <path>` | see each step |
| Unit tests | `pnpm test:only` | all pass (Phase B) |
| Typecheck | `pnpm check` | 0 errors (Phase B) |
| Build + package | `pnpm build` | exit 0 |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| One e2e spec | `PW_PORT=4214 pnpm exec playwright test <spec>` | see each step |
| Docs | `pnpm --dir docs build`, `pnpm --dir docs check`, `pnpm --dir docs test` | exit 0 / 0 errors / pass |

Playwright's `webServer` runs `npm run build && npm run preview` on `PW_PORT`, so each run rebuilds. Batch specs
into one command where you can.

## Scope

**In scope** (create unless noted):

- `src/lib/utils/optimizedAppear.ts` (modify: `createOptimizedAppearData` and its JSDoc, the `APPEAR_VALUES`
  comment at `:174-181`)
- `src/lib/utils/optimizedAppear.spec.ts` (modify: new cases)
- `src/lib/html/_MotionContainer.svelte` (modify: **only** the `optimizedAppearEntries` `$derived`, `:1321-1327`)
- `src/lib/html/_MotionContainer.ssr.spec.ts` (modify: new cases)
- `src/lib/html/_MotionContainer.transitionOut.spec.ts`
- `src/lib/components/__tests__/TransitionOutVariantsHarness.svelte`
- `src/lib/types.ts` (modify: `MotionInitial` `:84` and `MotionAnimate` `:197-208`, plus their JSDoc)
- `src/routes/tests/transition-out/mount/+page.svelte`, `src/routes/tests/transition-out/gestures/+page.svelte`
- `src/routes/tests/optimized-appear/initial-out/+page.svelte`
- `e2e/motion/transition-out-mount.spec.ts`, `e2e/motion/transition-out-gestures.spec.ts`,
  `e2e/motion/optimized-appear-initial-out.spec.ts`
- `src/routes/+page.svelte` (modify: three links, next to "Optimized appear animations")
- `docs/src/routes/docs/transition-out/+page.svx`, `docs/src/routes/examples/transition-out/+page.svelte`,
  `docs/src/lib/examples/transition-out/demos/Default.svelte`
- `docs/src/lib/docsNav.ts` (modify: one entry), `docs/src/lib/examplesIndex.ts` (modify: one entry; plan 007 also adds one), `docs/src/routes/docs/optimized-appear/+page.svx` (modify: one
  paragraph)
- `.changeset/transition-out.md`

**Out of scope**:

- Any other region of `_MotionContainer.svelte`. Plans 006/007/010 also edit it; keep your diff to `:1321-1327`.
- `src/lib/utils/visualElementCore.ts`, `src/lib/utils/variants.ts`, the animation-state wiring. The runtime half
  is motion-dom's. If a Phase B runtime test can only pass by editing them, STOP.
- `toNativeOptions`' handling of `type: 'spring'` / `type: false` (it ignores `type` today). Porting spring →
  `linear()` easing for appear animations is a separate parity item; note it in your report, don't do it.
- Optimized appear for variant children. Today a child with no own `initial` has no `initialKeyframes`, so no
  appear animation; unchanged here.
- `package.json`, `pnpm-lock.yaml` (plan 001 owns the bump; you receive it via merge).
- `MotionTransition`, the `while*` / `exit` types (they already accept `transition`).

## Git workflow

- Lane branch `lane/1471-transout` in `../svelte-motion-1471-transout`, created by the dispatcher from
  the wave-0 SHA (Motion 14.6.0).
- Conventional commits. Phase A: `test(transition): port upstream transition.out runtime tests (#1725)`,
  `test(transition): transition.out mount and gesture pages`,
  `test(optimized-appear): appear animation follows initial's transition.out`. Phase B: the merge commit, then
  `fix(optimized-appear): build the appear animation from initial's out or animate's transition`,
  `feat(types): accept an inline transition on initial and animate`,
  `docs(transition): document transition.out`, `chore(changeset): transition.out`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Phase A — on Motion 14.6.0

Confirm `grep -n '"motion-dom": "14.6.0"' package.json` prints a line. If not, STOP.

In Phase A, `pnpm check` is expected to report errors **only** in the files you create, and only because
`out` isn't in 14.6.0's `AnimationOptions` or `transition` isn't in `MotionInitial`/`MotionAnimate`. Don't add
casts to silence them; list them in the Phase A report. Vitest and the Vite build don't typecheck, so tests run.

### Step 1: Generator red tests (our code)

In `src/lib/utils/optimizedAppear.spec.ts`, add a `describe('createOptimizedAppearData mount transition (#1725)')`
with these cases. Each asserts on `entries.find((e) => e.name === …)!.options`:

1. `uses initial's transition.out when set`: initial
   `{ opacity: 0, transition: { out: { duration: 2.4, ease: 'linear' } } }`, animate `{ opacity: 1 }`,
   transition `{ duration: 0.6, ease: 'linear' }` → opacity `duration` 2400, `easing` `'linear'`.
2. `out: true reuses initial's own transition`: initial
   `{ opacity: 0, transition: { out: true, duration: 1.2 } }`, animate `{ opacity: 1 }`, transition
   `{ duration: 0.6 }` → 1200.
3. `resolves value-specific keys inside the out transition`: initial
   `{ opacity: 0, y: 10, transition: { out: { duration: 1, opacity: { duration: 2 } } } }`, animate
   `{ opacity: 1, y: 0 }`, transition `{ duration: 0.3 }` → opacity 2000, transform 1000.
4. `falls back to animate's own transition`: initial `{ opacity: 0 }`, animate
   `{ opacity: 1, transition: { duration: 2 } }`, transition `{ duration: 0.6 }` → 2000.
5. `animate's transition merges the prop only with inherit: true`: animate
   `{ opacity: 1, transition: { inherit: true, delay: 0.5 } }`, transition `{ duration: 0.8 }` → `duration` 800,
   `delay` 500.
6. `an initial transition without out doesn't time the mount`: initial
   `{ opacity: 0, transition: { duration: 5 } }`, animate `{ opacity: 1 }`, transition `{ duration: 0.6 }` →
   600 (upstream only reads `out` from `initial`).
7. `the 4th argument overrides where out is read from`: call
   `createOptimizedAppearData({ opacity: 0, transition: { out: { duration: 9 } } }, { opacity: 1 }, { duration: 0.6 }, { out: { duration: 1.5 } } as never)`
   → 1500. This is the hook the container uses for a list of `initial` labels (Step 8).
7b. Guard, `a null 4th argument means the first label has no transition`: call
   `createOptimizedAppearData({ opacity: 0, transition: { out: { duration: 9 } } }, { opacity: 1 }, { duration: 0.6 }, null)`
   → 600 (no fallback to the merged `initial.transition`; upstream reads only `definition[0]`). Passes on 14.6.0
   because the old generator ignores `out`; it must still pass after Step 7.

Keep every existing case unchanged (they pass no `transition` on initial/animate and must stay green).

In `src/lib/html/_MotionContainer.ssr.spec.ts` add two cases after `:106-118`, rendering `MotionContainer` like
that test:

8. `the appear script uses initial's transition.out`: props `{ tag: 'div', initial: { opacity: 0, transition: { out: { duration: 2.4, ease: 'linear' } } }, animate: { opacity: 1 }, transition: { duration: 0.6, ease: 'linear' } }`
   → `container.innerHTML` contains `"duration":2400` and not `"duration":600`.
9. `with a list of initial labels, out comes from the first label`: props
   `{ tag: 'div', variants: { a: { opacity: 0, transition: { out: { duration: 1.5 } } }, b: { scale: 0.5, transition: { out: { duration: 9 } } }, shown: { opacity: 1, scale: 1 } }, initial: ['a', 'b'], animate: 'shown', transition: { duration: 0.6 } }`
   → `innerHTML` contains `"duration":1500` and not `"duration":9000`.
10. `when the first initial label has no transition, a later label's out is ignored`: props
   `{ tag: 'div', variants: { a: { opacity: 0 }, b: { scale: 0.5, transition: { out: { duration: 9 } } }, shown: { opacity: 1, scale: 1, transition: { duration: 1.2 } } }, initial: ['a', 'b'], animate: 'shown', transition: { duration: 0.6 } }`
   → `innerHTML` contains `"duration":1200` (animate's own transition) and not `"duration":9000`. On 14.6.0 it
   reads `"duration":600` (animate's transition ignored), so it **fails** in Phase A; it must pass after Step 8.

**Verify**: `pnpm exec vitest run src/lib/utils/optimizedAppear.spec.ts src/lib/html/_MotionContainer.ssr.spec.ts`
→ cases 1, 2, 3, 4, 5, 7, 8, 9, 10 **FAIL** (durations are the prop's 600/300/800, and case 7 fails because the
4th argument is ignored); cases 6 and 7b and every pre-existing case pass. If case 6, 7b or any pre-existing case
fails, STOP.

### Step 2: Runtime red tests through our component (upstream's 16 cases)

Create `src/lib/html/_MotionContainer.transitionOut.spec.ts`. **Do not** `vi.mock('motion')` or
`vi.mock('motion-dom')`: the tests must run the real animation state. Copy the harness from
`src/lib/utils/animate.spec.ts:8-17` (real timers; `requestAnimationFrame` → `setTimeout(() => cb(performance.now()), 16)`
and the matching `cancelAnimationFrame`), stub `matchMedia` for `(hover: hover)` / `(pointer: fine)` in
`beforeEach` like `_MotionContainer.spec.ts:606-620`, `vi.unstubAllGlobals()` in `afterEach`, and copy
`latestValuesOf`. Add `const frames = (n = 3) => sleep(20 * n)` (`sleep` from `$lib/utils/testing`). Header
comment: port of `packages/framer-motion/src/motion/__tests__/transition-out.test.tsx` @ v14.7.1, commits
`369c6fb5d`, `7a56387a9`, `6c6a96940`, `34968ee4b`. Like upstream, "instant" means `{ type: false }` and the
contrast is `delay: 10` / `duration: 10`, so a few frames tell them apart however loaded the machine is.

Render with `render(MotionContainer as unknown as any, { props: { tag: 'div', … } })`, read
`container.firstElementChild`, interact with `fireEvent.pointerEnter/pointerLeave/pointerDown/pointerUp`, change
props with `await result.rerender({ … })` (pass the full prop set). For the two parent/child cases create
`src/lib/components/__tests__/TransitionOutVariantsHarness.svelte`: props `variants`, `initial`, `animate`,
`whileHover`; renders `<motion.div data-testid="parent" …>` with a child
`<motion.div data-testid="child" {variants} />`.

Port these cases (upstream name → expectation; "→" separates interaction steps):

1. `initial's out transition is used for the mount animation only`: initial
   `{ opacity: 0, transition: { out: { type: false } } }`, animate `{ opacity: 1 }`, transition `{ delay: 10 }` →
   after `frames()` opacity 1 → rerender animate `{ opacity: 0.5 }` → opacity still 1.
2. `initial's out transition from a variant label`: variants `hidden { opacity: 0, transition: { out: { type: false } } }`,
   `visible { opacity: 1, transition: { delay: 10 } }`, initial `'hidden'`, animate `'visible'` → opacity 1.
3. `variant children use the inherited initial's out transition on mount` (harness) → parent and child opacity
   `[1, 1]`.
4. `initial's out doesn't apply to values initial doesn't change on mount`: initial
   `{ x: 0, transition: { out: { type: false } } }`, animate `{ x: 0 }`, transition `{ delay: 10 }` → rerender
   animate `{ x: 10 }` → x still 0.
5. `the issue's example: delay applies to the mount animation, not hover end`: initial
   `{ scale: 0, transition: { out: { delay: 10 } } }`, animate `{ scale: 1, transition: { type: false } }`,
   whileHover `{ scale: 2, transition: { type: false } }` → scale 0 → enter → 2 → leave → 1.
6. `out: true reuses whileHover's transition when hover ends`: initial `false`, animate
   `{ opacity: 0.5, transition: { delay: 10 } }`, whileHover `{ opacity: 1, transition: { type: false, out: true } }`
   → enter → 1 → leave → 0.5.
7. `without out, the state being entered defines the transition (unchanged)`: as 6 without `out` → leave →
   opacity still 1. **Control.**
8. `out can be a separate transition for leaving`: animate `{ opacity: 0.5 }`, transition `{ delay: 10 }`,
   whileHover `{ opacity: 1, transition: { type: false, out: { type: false } } }` → enter → 1 → leave → 0.5.
9. `applies when no lower state defines the value`: no initial/animate, `style: 'opacity: 0.5'`, transition
   `{ delay: 10 }`, whileHover `{ opacity: 1, transition: { type: false, out: true } }` → enter → 1 → leave →
   0.5. (Upstream used a style MotionValue of 0.5. If our string style doesn't seed `latestValues.opacity` as 0.5,
   use `style: { opacity: 0.5 }`, the object style form; if neither seeds it, mark this case `it.todo` with that
   reason and report it.)
10. `value-specific transitions inside an out transition`: animate `{ opacity: 0.5, x: 0 }`, transition
    `{ delay: 10 }`, whileHover `{ opacity: 1, x: 10, transition: { type: false, out: { delay: 10, opacity: { type: false } } } }`
    → enter → `[1, 10]` → leave → `[0.5, 10]`.
11. `a higher-priority state entering uses its own transition`: animate `{ scale: 1 }`, whileHover
    `{ scale: 1.5, transition: { type: false, out: true } }`, whileTap `{ scale: 0.5, transition: { delay: 10 } }`
    → enter → 1.5 → down → 1.5 → up → 1.5 → leave → 1.
12. `whileTap out applies when returning to whileHover`: animate `{ scale: 1 }`, transition `{ delay: 10 }`,
    whileHover `{ scale: 1.5 }`, whileTap `{ scale: 0.5, transition: { type: false, out: true } }` → enter + down
    → 0.5 → up → 1.5.
13. `works with variants, including variant children` (harness): variants
    `rest { opacity: 0.5, transition: { delay: 10 } }`, `hover { opacity: 1, transition: { type: false, out: true } }`,
    initial `false`, animate `'rest'`, whileHover `'hover'` → enter parent → `[1, 1]` → leave → `[0.5, 0.5]`.
14. `is used once: the next change into animate uses animate's transition`: animate
    `{ opacity: 0.5, transition: { delay: 10 } }`, whileHover `{ opacity: 1, transition: { type: false, out: true } }`
    → enter, leave → 0.5 → rerender animate `{ opacity: 0, transition: { delay: 10 } }` → still 0.5.
15. `setting only out keeps the value's default transition into the state`: animate `{ x: 0 }`, whileHover
    `{ x: 100, transition: { out: { type: false } } }`. Subscribe to the node's `x` MotionValue
    (`visualElementStore.get(el).getValue('x')`) `on('change', …)` before entering → enter → `frames(40)` →
    max sample `> 100` (x's default transition is an underdamped spring).
16. `with a list of labels, the last label that sets out applies to all its values`: variants
    `rest { opacity: 0.5, x: 0, transition: { delay: 10 } }`, `fade { opacity: 1, transition: { type: false, out: true } }`,
    `move { x: 10, transition: { type: false } }`, animate `'rest'`, whileHover `['fade', 'move']` → enter →
    `[1, 10]` → leave → `[0.5, 0]`.

Upstream's 17th test (exit while hovered) is covered by the e2e in Step 3, because exit runs through
`AnimatePresence`.

Add a compile-only block at the end like `src/lib/utils/animate.spec.ts:161-187` (`function typeAssertions()`
plus `void typeAssertions`) that assigns `const i: MotionInitial = { opacity: 0, transition: { out: { delay: 1 } } }`
and `const a: MotionAnimate = { opacity: 1, transition: { out: true, duration: 0.2 } }`. It typechecks only after
Steps 6 and 9.

**Verify**: `pnpm exec vitest run src/lib/html/_MotionContainer.transitionOut.spec.ts` → cases 4 and 7 (guards:
on 14.6.0 the `delay: 10` already applies to the later change and to hover end) **pass**; every other case
**FAILS** (instant `out` transitions ignored on 14.6.0, so values are still at their
pre-interaction value; case 15 fails because `{ out: … }` counts as a defined transition on 14.6.0 and x tweens
without overshoot). If case 4 or 7 fails, or if case 1's "after mount" assertion reads 1, the harness isn't
observing real animations: STOP and report.

### Step 3: e2e pages and specs for the runtime half

Create two pages, each with a header comment citing #1725 and the upstream test it ports, a guided TesterPanel
(import `TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'`) with a live verdict
chip per card that is skipped under `@isPlaywright=true`, and fixed-size cards (160×100) with `data-testid`s.
Use `delay: 2`/`duration: 2` where upstream uses 10, and `{ type: false }` for instant.

`src/routes/tests/transition-out/mount/+page.svelte` (mount runs on load; add a "Remount" button that toggles a
`{#key}` block so testers can replay). **Render every card client-only**: wrap the cards in
`{#if mounted}…{/if}` with `let mounted = $state(false)` set in `onMount`. Otherwise the server renders them with
`initial` + `animate` and emits an optimized-appear script from the generator this plan only fixes in Step 7,
which would make the Phase A and Step 6 results depend on hydration timing. The SSR appear behaviour is tested
separately on the `optimized-appear/initial-out` page (Step 4). Add a comment saying so. Measure the e2e
timings below from when the cards appear (wait for `getByTestId('mount-out')` to be attached), not from
`page.goto`.

- `mount-out`: the issue's example. `initial={{ scale: 0, transition: { out: { delay: 1.5 } } }}`,
  `animate={{ scale: 1, transition: { duration: 0.15 } }}`, `whileHover={{ scale: 1.3, transition: { duration: 0.15 } }}`.
- `mount-label` / `mount-label-child`: parent with variants
  `hidden { opacity: 0, transition: { out: { type: false } } }`, `visible { opacity: 1, transition: { delay: 2 } }`,
  `initial="hidden" animate="visible"`, and a child `motion.div` with the same `variants` and no
  `initial`/`animate`.
- `mount-unchanged`: `initial={{ x: 0, transition: { out: { type: false } } }}`, `animate={{ x: target }}`,
  `transition={{ delay: 2 }}`, and a button `move-unchanged` that sets `target = 100`.

`e2e/motion/transition-out-mount.spec.ts` (load `/tests/transition-out/mount?@isPlaywright=true`; read values
with `getComputedStyle` and `new DOMMatrix(transform)`):

1. `mount-out`: ~600 ms after the card appears the scale is `< 0.05`; by 2.5 s it is `1` (±0.01). Then hover →
   ~1.3 within 600 ms → move the mouse away → back to 1 within 600 ms (no 1.5 s delay).
2. `mount-label` and `mount-label-child`: opacity `1` within 500 ms of the cards appearing (not delayed 2 s).
   Also assert neither card has a `data-framer-appear-id` attribute (proves they are client-only).
3. `mount-unchanged`: click `move-unchanged` → 500 ms later x is still `0` (the `delay: 2` applies). **Control.**

`src/routes/tests/transition-out/gestures/+page.svelte`, all with `initial={false}` unless stated:

- `out-true`: `animate={{ opacity: 0.5, transition: { delay: 2 } }}`,
  `whileHover={{ opacity: 1, transition: { type: false, out: true } }}`.
- `no-out` (control): the same without `out`.
- `tap-to-hover`: `animate={{ scale: 1 }}`, `transition={{ delay: 2 }}`, `whileHover={{ scale: 1.5 }}`,
  `whileTap={{ scale: 0.5, transition: { type: false, out: true } }}`.
- `label-list`: variants `rest { opacity: 0.5, x: 0, transition: { delay: 2 } }`,
  `fade { opacity: 1, transition: { type: false, out: true } }`, `move { x: 40, transition: { type: false } }`,
  `animate="rest" whileHover={['fade', 'move']}`.
- `out-only`: `animate={{ x: 0 }}`, `whileHover={{ x: 100, transition: { out: { type: false } } }}`.
- `used-once`: `animate={{ opacity: usedOnceTarget, transition: { delay: 2 } }}`,
  `whileHover={{ opacity: 1, transition: { type: false, out: true } }}`, a button `used-once-change` setting
  `usedOnceTarget = 0` (starts at 0.5).
- `exit-hovered`: use the **owned** AnimatePresence form, so the real node exits through its `animationState`
  (the legacy `{#if}` form exits a static clone, which would make the test trivially true). Pattern from
  `src/routes/tests/animate-presence/owned-child/+page.svelte:243-251`:
  ```svelte
  <AnimatePresence present={exitVisible}>
      {#snippet child()}
          <motion.div data-testid="exit-hovered" initial={false} animate={{ opacity: 0.5 }}
              whileHover={{ opacity: 1, transition: { type: false, out: true } }}
              exit={{ opacity: 0, transition: { delay: 1.5, duration: 0.2 } }} />
      {/snippet}
  </AnimatePresence>
  ```
  plus a button `exit-toggle` that flips `exitVisible`.

`e2e/motion/transition-out-gestures.spec.ts` (load `/tests/transition-out/gestures?@isPlaywright=true`; hover
with `locator.hover()`, leave with `page.mouse.move(0, 0)`):

1. `out-true`: hover → opacity 1 within 300 ms → leave → 0.5 within 400 ms.
2. `no-out`: hover → 1 → leave → 400 ms later still 1. **Control.**
3. `tap-to-hover`: hover, `page.mouse.down()` → scale 0.5 within 300 ms → `page.mouse.up()` → 1.5 within 400 ms.
4. `label-list`: hover → `[1, 40]` → leave → `[0.5, 0]` within 400 ms.
5. `out-only`: sample `x` every frame (record in `page.evaluate` with a rAF loop for 1 s) after hover → max
   `> 100`; then leave → x `0` within 300 ms.
6. `used-once`: hover, leave → 0.5 within 400 ms → click `used-once-change` → 500 ms later still 0.5.
7. `exit-hovered`: hover the card, then **without moving the mouse** focus `exit-toggle` and press Enter
   (`await page.getByTestId('exit-toggle').focus(); await page.keyboard.press('Enter')`) → 600 ms later the card
   is still in the DOM with opacity 1 (exit's 1.5 s delay applies, not hover's instant out) → it is gone within
   3 s. Also assert the element still there at 600 ms is the original node (grab an `elementHandle` before the
   toggle and check `isConnected`), so the test is about the real-node exit, not a clone. **Guard** (passes on
   14.6.0 too: there `out` is ignored entirely). If the original node is replaced by a clone, STOP: the owned
   form isn't being used.

Link both pages from `src/routes/+page.svelte` right after the "Optimized appear animations" link
("transition.out — mount (#1725)", "transition.out — gestures (#1725)").

**Verify**: `PW_PORT=4214 pnpm exec playwright test e2e/motion/transition-out-mount.spec.ts e2e/motion/transition-out-gestures.spec.ts`
→ guards (mount 3, gestures 2 and 7) **pass**; every other test **FAILS** on its first transition.out
assertion. If a control fails, STOP.

### Step 4: Optimized-appear page and per-frame spec

Create `src/routes/tests/optimized-appear/initial-out/+page.svelte`, a port of upstream
`dev/html/public/optimized-appear/initial-out.html` with a header comment citing `ad11115e9`, `1a451de16`, #1725,
and a TesterPanel (steps: hard-reload; expected: each box fades in slowly and evenly over ~2.4 s, with no snap
back or jump around hydration; live verdict from a rAF opacity sampler applying upstream's thresholds, skipped
under `@isPlaywright=true`). Two boxes, 100×100:

- `initial-out-box`: `initial={{ opacity: 0, transition: { out: { duration: 2.4, ease: 'linear' } } }}`,
  `animate={{ opacity: 1 }}`, `transition={{ duration: 0.6, ease: 'linear' }}`.
- `animate-transition-box`: `initial={{ opacity: 0 }}`,
  `animate={{ opacity: 1, transition: { duration: 2.4, ease: 'linear' } }}`,
  `transition={{ duration: 0.6, ease: 'linear' }}` (the "otherwise animate's transition" half).

Create `e2e/motion/optimized-appear-initial-out.spec.ts`. For each box:

1. **Generator check (deterministic)**: `const html = await (await page.request.get('/tests/optimized-appear/initial-out?@isPlaywright=true')).text()`;
   find the box's inline bootstrap payload (the box carries `data-framer-appear-id="svelte-motion-…"`; the
   payload is `{"id":"<that id>","entries":[…]}` inside the `<script>` that follows it) and assert its opacity
   entry has `"duration":2400`.
2. **Per-frame continuity**: in `addInitScript`, sample `[performance.now(), opacity]` for both boxes every rAF
   (as `e2e/motion/optimized-appear.spec.ts:5-23` does). After load, poll until both reach opacity `1`
   (timeout 5 s). Then assert, from the first sample above 0.01: no sample drops more than 0.02 below the
   previous one; no step rises more than `(dt / 1000) / 2.4 + 0.08`; and the first sample at least 1000 ms after
   that start is `≤ 0.75` (a 0.6 s animation would be at 1 by then).
3. `__SvelteMotionAppear.started` contains an `opacity` entry for the box (the appear ran).

Link the page from `src/routes/+page.svelte` after the two transition.out links ("Optimized appear —
initial transition.out (#1725)").

**Verify**: `PW_PORT=4214 pnpm exec playwright test e2e/motion/optimized-appear-initial-out.spec.ts e2e/motion/optimized-appear.spec.ts`
→ the new spec **FAILS** for both boxes on check 1 (`"duration":600`) and on the `≤ 0.75` rate check;
`optimized-appear.spec.ts` passes.

### Step 5: Phase A gate, then STOP

`trunk fmt` and `trunk check` on every file you created or changed. `pnpm test:only` → the only failures are the
red cases from Steps 1 and 2. `pnpm check` → errors only in your new files, only about `out`/`transition`. Run
`PW_PORT=4214 pnpm exec playwright test e2e/motion e2e/utilities/transform-template-optimized-appear.spec.ts` →
the only failures are the red tests from Steps 3 and 4. Re-run any other failing spec alone once; if it still
fails, STOP and report it.

Commit (the three `test(...)` commits in "Git workflow"). **STOP and report "phase A red"** with a table of every
new test → PASS / FAIL (with the failure value) / "not red on 14.6.0: reason", the `pnpm check` error list, and
the commit SHAs.

### Phase B — after the dispatcher says 001 is merged

### Step 6: Merge the bump; the runtime half goes green

1. `git merge --no-ff feat/motion-14.7.1`, then `pnpm install --frozen-lockfile`. Confirm
   `grep -n '"motion-dom": "14.7.1"' package.json` and `grep -n '"motion": "14.7.1"' package.json` print lines,
   and `grep -m1 '"version"' node_modules/motion-dom/package.json` shows `14.7.1`. If not, STOP.
2. Confirm upstream's runtime is installed:
   `grep -n "getOutTransition\|prevOut" node_modules/motion-dom/dist/es/render/utils/animation-state.mjs` (≥1
   match; minified names may differ, so if 0, `grep -rn "\.out\[" node_modules/motion-dom/dist/es/animation/interfaces/visual-element-target.mjs`
   must match) and `grep -n '"out"' node_modules/motion-dom/dist/es/animation/utils/is-transition-defined.mjs`
   (1 match). If either is missing, STOP.
3. `grep -n "out?: boolean | Transition" node_modules/motion-dom/dist/index.d.ts` → 1 match.
4. `pnpm exec vitest run src/lib/html/_MotionContainer.transitionOut.spec.ts` → **all pass**.
5. `PW_PORT=4214 pnpm exec playwright test e2e/motion/transition-out-mount.spec.ts e2e/motion/transition-out-gestures.spec.ts`
   → **all pass**.
6. `pnpm exec vitest run src/lib/utils/optimizedAppear.spec.ts src/lib/html/_MotionContainer.ssr.spec.ts` → the
   Step 1 cases are **still red** (the generator is ours). The appear e2e is also still red; on 14.7.1 it may now
   additionally show a snap-back on hydration (the runtime continues with 2.4 s from the appear start while the
   WAAPI animation ran 0.6 s). That is the jump this plan exists to prevent.

If a runtime test is still red, re-run it alone once. If still red, STOP and report which, the value, and whether
the cause is in our container (prop forwarding) or motion-dom. Don't edit `visualElementCore.ts`/`variants.ts`.

### Step 7: Port the generator rule

In `src/lib/utils/optimizedAppear.ts`:

1. Import `resolveTransition` from `motion-dom` (it is exported there; add it to the existing import at `:4-9`).
2. Add a 4th parameter to `createOptimizedAppearData`:
   `initialTransition?: AnimationOptions | null`, documented as "The `initial` definition's transition to read
   `out` from. `undefined` (omitted) means `initial.transition`. When `initial` is a list of labels, pass the
   first label's transition, or `null` when the first label has none: upstream reads `out` only from
   `definition[0]`, so `null` must not fall back to the merged `initial.transition`."
3. At the top of the function (after the null guard), resolve the mount transition with upstream's rule:
   ```ts
   // Upstream (#1725, 1a451de16): the generator builds the appear animation
   // from initial's transition.out when it's set, otherwise from animate's
   // transition, the rule the runtime's mount animation (and so the handoff)
   // follows (motion-dom animation-state.ts `initialOut`,
   // visual-element-target.ts `animationTypeState?.out[key] || transition`).
   const fromInitial = (initialTransition === undefined
       ? (initial as { transition?: AnimationOptions }).transition
       : (initialTransition ?? undefined)) as (AnimationOptions & { out?: unknown }) | undefined
   const out = fromInitial?.out === true ? fromInitial : fromInitial?.out
   const animateTransition = (animate as { transition?: AnimationOptions }).transition
   const mountTransition = (out ||
       (animateTransition ? resolveTransition(animateTransition, transition) : transition)) as
       | AnimationOptions
       | undefined
   ```
   Then use `mountTransition` instead of `transition` in all three `toNativeOptions(getValueTransition(…))` calls
   (`:265`, `:275`, `:287`). Match the file's style; the cast shape is a suggestion. Upstream's
   `getOutTransition` returns `undefined` for `out: false`, which `fromInitial?.out` also gives you.
4. Update the function's JSDoc: describe the rule, the new parameter, and add an `@example` with
   `initial: { opacity: 0, transition: { out: { duration: 2.4 } } }`. Google style, like the existing block.
5. Replace the stale part of the `APPEAR_VALUES` comment (`:178-180`) with: "`backgroundColor` and other colours
   stay on the main thread, matching upstream: WAAPI mixes colours in sRGB, but Motion's JS animations (and the
   sampler that estimates a WAAPI value on interrupt) mix them in linear colour space, so interrupting one would
   visibly jump (motion-dom `acceleratedValues`, f9e080f21)."

**Verify**: `pnpm exec vitest run src/lib/utils/optimizedAppear.spec.ts` → all pass, including Step 1 cases 1-7
and 7b.

### Step 8: Pass the first label's transition from the container (`_MotionContainer.svelte:1321-1327` only)

Replace the `optimizedAppearEntries` `$derived` with:

```ts
    const optimizedAppearEntries = $derived(
        createOptimizedAppearData(
            initialKeyframes as Record<string, unknown> | undefined,
            animateKeyframes,
            mergedTransition,
            // Upstream reads initial's `transition.out` from the FIRST label of a
            // list (motion-dom animation-state.ts `resolveInitial`), while
            // `initialKeyframes` merges the list (last label wins). `null` = the
            // first label has no transition: don't fall back to the merged one.
            Array.isArray(effectiveInitialProp)
                ? (((resolveInitial(effectiveInitialProp[0], variantsProp, effectiveCustom) ||
                      undefined) as { transition?: AnimationOptions } | undefined)?.transition ??
                  null)
                : undefined
        )
    )
```

`resolveInitial` is already imported in this file (it is used at `:1217` and `:1240`). Touch nothing else in the
file.

**Verify**: `pnpm exec vitest run src/lib/html/_MotionContainer.ssr.spec.ts` → all pass, including cases 8, 9
and 10.
`git diff feat/motion-14.7.1 -- src/lib/html/_MotionContainer.svelte` shows only this hunk.

### Step 9: Types

In `src/lib/types.ts`, give the object forms of `MotionInitial` and `MotionAnimate` upstream's
`TargetAndTransition` shape (motion-dom `node/types.ts:49-52`: `Target & { transition?: Transition; transitionEnd?: ResolvedValues }`;
`initial?: TargetAndTransition | VariantLabels | boolean`):

- `MotionInitial = (DOMKeyframesDefinition & { transition?: AnimationOptions; transitionEnd?: DOMKeyframesDefinition }) | string | string[] | false | undefined`
- In `MotionAnimate`, add the same `& { transition?: AnimationOptions; transitionEnd?: DOMKeyframesDefinition }`
  to both object members (keep the null-widening comment).

Add a sentence and an example to `MotionInitial`'s JSDoc block (`:66-83`) showing an inline `transition` with
`out`. `MotionAnimate` (`:197`) has **no** JSDoc today: create a Google-style block for it, modelled on
`MotionInitial`'s (object / variant label / label list / `AnimationControls`, the scalar-`null` hold, and an
inline `transition` example).

**Verify**: `pnpm check` → 0 errors (this also typechecks the Step 2 compile-only block and every new page). If
`pnpm check` reports errors in files you didn't touch, STOP and report them.

### Step 10: Docs, example, changeset

1. `docs/src/routes/docs/transition-out/+page.svx`, modelled on `docs/src/routes/docs/on-update/+page.svx`
   (frontmatter, `getSeoContext` block with `seo.title = 'transition.out | Docs | Svelte Motion'`, `ogSlug`
   `docs-transition-out`). Sections: what `out` is (quote the upstream JSDoc meaning in your own words),
   `out: true`, an `out` object, `out` on `initial` (mount only, used once), value-specific keys inside `out`,
   a list of labels (the last label that sets `out` applies to all its values), "setting only `out` keeps the
   value's default transition", exit uses exit's transition, and SSR: the optimized appear animation follows
   `initial`'s `out` when set, otherwise `animate`'s transition. Embed the example with
   `<Example isSmall exampleUrl="/examples/transition-out">`. End with "Based on Motion's `transition.out`
   (Motion 14.7, #1725)."
2. `docs/src/lib/examples/transition-out/demos/Default.svelte`: the issue's example as a small interactive card
   (pops in after a 0.6 s mount delay from `initial`'s `out`, hover scales up quickly, leaving uses hover's own
   `out: true` transition, plus a "Replay" button). `docs/src/routes/examples/transition-out/+page.svelte`,
   modelled on `docs/src/routes/examples/on-update/+page.svelte` (literal `seo.title = 'transition.out | Svelte Motion'`,
   breadcrumbs, one `ExampleSection`).
3. `docs/src/lib/docsNav.ts`: add `{ title: 'transition.out', href: '/docs/transition-out', icon: … }` to the
   Animation group (`:78-91`), directly after `{ title: 'transformTemplate', … }` and before
   `{ title: 'Variants', … }` (the group isn't alphabetical; place it there). Reuse an icon already imported in
   that file (for example `Activity`).
   Also add `'transition-out': { title: 'transition.out', description: 'Choose the transition a value uses when it leaves a state, with a mount-only delay from initial.' }`
   to `EXAMPLES` in `docs/src/lib/examplesIndex.ts`, keeping its slug order (after `'transform-page-point'`,
   before `'use-animate'`). Plan 007 also adds an entry there: on a merge conflict keep both entries.
4. `docs/src/routes/docs/optimized-appear/+page.svx`: after the "enables optimized appear when" list, add one
   paragraph: the appear animation's timing comes from `initial`'s `transition.out` when set, otherwise from
   `animate`'s own transition, otherwise the `transition` prop, matching the runtime so hydration doesn't jump;
   link `/docs/transition-out`.
5. `.changeset/transition-out.md` (bump `minor`): "`transition.out` (Motion 14.7, #1725): set the transition a
   value uses when it leaves a state, for example `whileHover={{ scale: 1.2, transition: { out: true } }}`. On
   `initial` it times only the mount animation. SSR optimized appear animations now follow `initial`'s
   `transition.out` when set, otherwise `animate`'s own transition, so hydration no longer jumps when they
   differ from the `transition` prop. `initial` and `animate` objects accept an inline `transition` and
   `transitionEnd` in their types."

**Verify**: `pnpm build` (exit 0), then `pnpm --dir docs build` (exit 0), `pnpm --dir docs check` (0 errors),
`pnpm --dir docs test` (all pass). If the docs build fails only because the network blocks the GitHub stats
fetch, record that and continue.

### Step 11: Phase B gate

`pnpm check` (0 errors), `pnpm test:only` (all pass), and
`PW_PORT=4214 pnpm exec playwright test e2e/motion e2e/utilities e2e/animate-presence e2e/variants` (all pass;
re-run a failing spec alone once before reporting, and say it was re-run). `trunk fmt` / `trunk check` on every
changed file (clean). `git diff --check` clean. `git status` shows only in-scope files. Report the results.

## Test plan

- Red-first anchors (fail on 14.6.0, pass in Phase B):
  - Generator (our port): Step 1 cases 1-5, 7 (unit) and 8-10 (SSR render). They stay red after the merge and go
    green with Steps 7-8.
  - Runtime (comes with the bump): Step 2 cases 1-3, 5-6, 8-16; e2e mount 1-2 (client-only cards, so no SSR
    appear script is involved), gestures 1, 3-6.
  - Appear e2e: red on 14.6.0 on the deterministic payload check and the rate check; after the merge but before
    Step 7 it is also expected to show the hydration jump; green after Step 8.
- Guards (pass in both phases): Step 2 cases 4 and 7; Step 1 cases 6 and 7b; e2e mount 3, gestures 2 and 7
  (owned real-node exit); the existing
  `optimized-appear.spec.ts` and `transform-template-optimized-appear.spec.ts`.
- Patterns: `src/lib/utils/optimizedAppear.spec.ts:92-107`, `src/lib/html/_MotionContainer.ssr.spec.ts:106-118`,
  `src/lib/utils/animate.spec.ts:8-17` (real-runtime harness), `e2e/motion/optimized-appear.spec.ts` (per-frame
  sampling), `src/routes/tests/drag/disable-from-ondrag/+page.svelte` (TesterPanel).

## Done criteria

- [ ] Phase A report lists every new test with its 14.6.0 result; the red ones fail for the stated reasons
- [ ] Phase B: `pnpm test:only` passes; `pnpm check` 0 errors; the listed Playwright suites pass
- [ ] `grep -n "resolveTransition" src/lib/utils/optimizedAppear.ts` → matches; `grep -n "Chromium issue 41491098" src/lib/utils/optimizedAppear.ts` → none
- [ ] `git diff feat/motion-14.7.1 -- src/lib/html/_MotionContainer.svelte` touches only the `optimizedAppearEntries` block
- [ ] Three new test pages, each with a TesterPanel hidden under `@isPlaywright=true`, linked from `src/routes/+page.svelte`
- [ ] Docs page, nav entry, example, optimized-appear paragraph and `.changeset/transition-out.md` exist; docs build/check/test pass
- [ ] `trunk check` clean on changed files; no out-of-scope files modified

## STOP conditions

- Phase A isn't on motion-dom 14.6.0, or Phase B isn't on 14.7.1 after the merge and install.
- A guard (Step 1 cases 6 or 7b, Step 2 cases 4 or 7, e2e mount 3, gestures 2 or 7) fails in Phase A: the
  harness is wrong.
- Step 2 case 1 reads opacity 1 after mount on 14.6.0: the harness isn't running real animations.
- A runtime test (Step 2, Step 3) is still red in Phase B after one solo re-run. Report it; don't edit
  `visualElementCore.ts`, `variants.ts` or other parts of `_MotionContainer.svelte`.
- Making a test pass seems to need `_MotionContainer.svelte` edits outside `:1321-1327`, a loosened threshold, or
  a skipped test (except the documented `it.todo` fallback for Step 2 case 9).
- `pnpm check` reports errors in files you didn't touch after Step 9.

## Maintenance notes

- The generator and the runtime must keep reading the mount transition from the same props. If upstream changes
  `initialOut` or `animateTarget`'s transition choice, update `createOptimizedAppearData` and re-run
  `e2e/motion/optimized-appear-initial-out.spec.ts`; its per-frame check is the one that catches a mismatch.
- `toNativeOptions` ignores `type` (springs, `type: false`) and defaults to 0.3 s. An `initial` `out` of
  `{ type: false }` or a spring therefore still yields a 0.3 s tween on the server. Deferred: port Motion's
  spring → `linear()` easing for appear animations as its own parity item.
- Variant children get no optimized appear animation (no own `initialKeyframes`). Unchanged; if that is ported
  later, it must read the inherited `initial`'s `out`, as upstream's `6c6a96940` does at runtime.
- Reviewers: check that the e2e thresholds follow upstream's fixture (0.02 drop, `dt / 2.4 s + 0.08` rise) and
  were not widened.
