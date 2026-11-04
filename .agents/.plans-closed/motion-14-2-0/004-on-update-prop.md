# Plan 004: Motion components get upstream's `onUpdate(latest)` prop, which also keeps their transforms on the main thread

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update this plan's status row in
> `.agents/.plans/motion-14-2-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Workspace**: `/Users/jasonkummerl/Github/svelte-motion-1420`, branch `feat/motion-14.2.0`
> (Motion 14.2.0 is already installed there by plan 001).
>
> **Drift check (run first)**: `git diff --stat b49d7885..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/types.ts src/lib/index.ts e2e/independent-transforms src/routes/tests/independent-transforms docs/src/lib/docsNav.ts`
> Expect no output. On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P1 (blocks plan 001's parity spec from going green)
- **Effort**: S–M
- **Risk**: LOW. The prop is new; nothing passes it today.
- **Depends on**: 001 (landed as `a5e4da8d`)
- **Category**: feature (upstream parity)
- **Planned at**: commit `b49d7885`, 2026-10-13

## Why this matters

Upstream Motion's motion components accept `onUpdate(latest)`, called once per frame while any of the
element's values change, with every current value (`{ x: 42, opacity: 0.5, … }`). svelte-motion never
had it: `<motion.div onUpdate={fn}>` is silently dropped and `fn` never runs.

Motion 14.2.0 makes the gap visible. Independent transforms now run as one compositor (WAAPI) animation
per element, and upstream keeps an element on the main thread when it has an `onUpdate` prop, because
the callback needs every value on every frame. svelte-motion's port of upstream's parity spec fails on it:

```
e2e/independent-transforms/basic.spec.ts:55  "transformTemplate and onUpdate stay on the main thread"
expect(await count(page, 'on-update')).toBe(0)   →   Expected: 0, Received: 1
```

The maintainer decided to add the prop properly rather than drop that check.

## Current state

### Upstream (`~/Github/motion` @ `v14.2.0`): motion-dom already does all the work once the prop reaches it

`packages/motion-dom/src/render/VisualElement.ts`:

```ts
const propEventHandlers = [
    "AnimationStart", "AnimationComplete", "Update", "BeforeLayoutMeasure",
    "LayoutMeasure", "LayoutAnimationStart", "LayoutAnimationComplete",
] as const
// …in bindToMotionValue, on every value "change":
this.props.onUpdate && frame.preRender(this.notifyUpdate)
// …
notifyUpdate = () => this.notify("Update", this.latestValues)
// …in update(props, presenceContext):
if ((props.transformTemplate && !transformTemplate) || (props.onUpdate && !onUpdate)) {
    transformGroups.get(this.current!)?.demote()      // adding onUpdate mid-animation moves to main thread
}
// then for each propEventHandlers key: subscribe props["on" + key] via this.on(key, listener)
```

`packages/motion-dom/src/animation/waapi/transforms/TransformAnimation.ts` `canAccelerateTransform`:
`const { onUpdate, transformTemplate } = owner.getProps()` … `!onUpdate && !options.hasOnUpdate && …`.
`options.hasOnUpdate` comes from a **transition-level** `onUpdate` (`animation/interfaces/motion-value.ts:62`).

Prop type, `packages/motion-dom/src/node/types.ts:270`: `onUpdate?(latest: ResolvedValues): void`.
`ResolvedValues` is a public type export of `motion-dom` (verified in `node_modules/motion-dom/dist/index.d.ts`).

So svelte-motion only has to (1) accept the prop, (2) keep it out of the DOM `...rest` spread, and
(3) put it on the props object handed to `visualElement.update(...)`. It must **not** call the callback itself.
Doing so would double-fire.

### svelte-motion

- `src/lib/html/_MotionContainer.svelte:165-226`: the `$props()` destructure. Lifecycle callbacks are
  destructured with a `Prop` suffix, e.g. `onAnimationStart: onAnimationStartProp,` /
  `onAnimationComplete: onAnimationCompleteProp,` (lines ~179-180). Anything not destructured lands in
  `...rest` and is spread onto the DOM element.
- `buildMotionNodeProps()` (object literal ending ~line 605) is the props object passed to
  `visualElement.update(next, nextPresenceContext)` (~line 2233) on every reactive change. It already
  forwards callbacks that motion-dom reads. Excerpt:
  ```ts
            onDragStart: onDragStartProp,
            onDrag: onDragProp,
            onDragEnd: onDragEndProp,
            // `buildHTMLStyles(state, latestValues, transformTemplate)` reads the
            // template off the props, so the VE composes templated transforms
            // natively — the job `applyMotionStyleEffect` used to do.
            transformTemplate: transformTemplateProp,
            transformPagePoint: effectiveTransformPagePoint,
            exit: exitProp,
            layoutId: scopedLayoutId
        }) as MotionNodeOptions
  ```
  Because that effect reruns when a read prop changes, adding or removing `onUpdate` later reaches
  `visualElement.update`, which triggers upstream's demote and re-subscribes the handler.
- `src/lib/types.ts:373-380`: callback types, one exported alias each:
  ```ts
  /**
   * Animation lifecycle callbacks for motion components.
   */
  export type MotionAnimationStart =
      ((_definition: DOMKeyframesDefinition | undefined) => void) | undefined
  export type MotionAnimationComplete =
      ((_definition: DOMKeyframesDefinition | undefined) => void) | undefined
  ```
  and the props interface, lines ~578-581:
  ```ts
      /** Called right before a main animate transition starts */
      onAnimationStart?: MotionAnimationStart
      /** Called after a main animate transition completes */
      onAnimationComplete?: MotionAnimationComplete
  ```
- `src/lib/index.ts:~120-131`: the exported type list (`MotionOnProjectionUpdate`, `ProjectionUpdatePayload`, …).
- `mergeTransitions` (`src/lib/utils/animation.ts:21`) is a plain object spread, so a transition-level
  `onUpdate` function already reaches motion-dom. Step 1 adds a test for that path. No change is expected there.
- The parity page `src/routes/tests/independent-transforms/basic/+page.svelte` already renders
  `<motion.div id="on-update" … onUpdate={() => {}} />`. Its spec is the red anchor.

### Exemplar for the docs footprint: `transformTemplate`

`docs/src/routes/docs/transform-template/+page.svx` (docs page),
`docs/src/routes/examples/transform-template/+page.svelte` (example route),
`docs/src/lib/examples/transform-template/demos/Default.svelte` (demo component),
`docs/src/lib/docsNav.ts:86` (`{ title: 'transformTemplate', href: '/docs/transform-template', icon: Code },`).
Run `grep -rn "transform-template" docs/src` to find every registration site and mirror each one.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Parity e2e | `pnpm playwright test e2e/independent-transforms` | see steps |
| New e2e | `pnpm playwright test e2e/motion/on-update.spec.ts` | see steps |
| Unit | `pnpm vitest run src/lib/html/_MotionContainer.spec.ts` | all pass |
| All unit | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint/format | `trunk fmt` then `trunk check` | clean |
| Build | `pnpm build` | exit 0 |

**Port 4198 rule**: before any Playwright run, check `lsof -ti :4198 -sTCP:LISTEN`. If anything is listening,
STOP and ask. Never kill it. Do NOT set `PW_REUSE_SERVER`. Port 4199 may be serving this worktree's build for
the maintainer's in-app browser; leave it alone.

## Scope

**In scope**:

- `src/lib/types.ts` (new `MotionOnUpdate` type + prop on the motion props interface)
- `src/lib/index.ts` (export the type next to its siblings)
- `src/lib/html/_MotionContainer.svelte` (destructure + forward in `buildMotionNodeProps`; nothing else)
- `src/lib/html/_MotionContainer.spec.ts` (unit cases)
- `src/routes/tests/motion/on-update/+page.svelte` (create) + link in `src/routes/+page.svelte`
  (in the "Independent transforms (Motion 14.2)" section, ~line 407)
- `e2e/motion/on-update.spec.ts` (create)
- Docs: `docs/src/routes/docs/on-update/+page.svx`, `docs/src/routes/examples/on-update/+page.svelte`,
  `docs/src/lib/examples/on-update/demos/Default.svelte` (all create), plus each registration site
  `transform-template` uses (`docsNav.ts` at minimum)
- `.changeset/on-update-prop.md` (create, `minor`)

**Out of scope**:

- `e2e/independent-transforms/basic.spec.ts` and its page. They're upstream ports and must go green
  **unchanged**.
- The `#layout` failure in the same spec (layout elements are never accelerated). That's a separate
  triage item; it will still fail after this plan.
- Calling `onUpdate` from svelte-motion code, adding frame loops, or changing `mergeTransitions`.
- `src/lib/utils/motionDomProjection.ts`, `drag.ts`, `layout.ts`.

## Steps

### Step 1: Red tests

1. **Unit** (`src/lib/html/_MotionContainer.spec.ts`; follow its existing harness, which already renders
   components with `onAnimationStart`/`onAnimationComplete` around line 142). Add a `describe('onUpdate')` with:
   - a motion div with `animate={{ opacity: 0.5 }}` and `transition={{ duration: 0.05 }}`. `onUpdate` is called
     at least once, and its last call's argument has `opacity === 0.5`. Use the file's existing wait/timer pattern;
     don't invent a new one.
   - `onUpdate` doesn't show up as a DOM attribute or listener: `element.getAttribute('onupdate') === null` and
     `element.getAttribute('onUpdate') === null`.
2. **e2e page** `src/routes/tests/motion/on-update/+page.svelte`. Pattern: the parity page next door, with the
   same `countTransformAnimations` helper and the `TesterPanel` (`../../layout/_parity/TesterPanel.svelte`) hidden
   under `@isPlaywright=true`. Boxes (100×50, `transition={{ duration: 1, ease: 'linear' }}`, `animate={{ x: 100 }}`):
   - `#prop`: `onUpdate={(latest) => …}` writes the latest `x` (rounded) into `data-testid="prop-latest"` and
     counts calls into `data-testid="prop-calls"`.
   - `#transition`: no prop, `transition={{ duration: 1, ease: 'linear', onUpdate: () => {} }}` (transition-level).
   - `#late`: no `onUpdate` until 300 ms after mount, then `onUpdate={() => {}}` (use `$state` + `setTimeout`, like
     the parity page's `isWide`).
   - `#control`: no `onUpdate` at all.
3. **Spec** `e2e/motion/on-update.spec.ts` (viewport 500×500, go to `?@isPlaywright=true`, wait 150 ms):
   - `#prop` has 0 transform animations; after 1.2 s `prop-latest` reads `100` and `prop-calls` > 10.
   - `#transition` has 0 transform animations.
   - `#late`: 1 at 150 ms, 0 after another 300 ms; its computed `m41` keeps rising afterwards (sample twice 100 ms apart).
   - `#control`: 1 (still accelerated, which proves the page measures something).

**Verify**:

- `pnpm vitest run src/lib/html/_MotionContainer.spec.ts` → the new `onUpdate` cases FAIL (never called).
  The attribute case may already pass; that's fine, say so.
- `pnpm playwright test e2e/motion/on-update.spec.ts` → `#prop` and `#late` assertions FAIL.
  `#transition` and `#control` should already PASS. If `#transition` fails, STOP and report it,
  because that means transition callbacks are being lost somewhere.
- `pnpm playwright test e2e/independent-transforms` → still exactly the 2 known failures (`on-update`, `layout`).

### Step 2: Type and export

In `src/lib/types.ts`, beside the lifecycle callback aliases:

```ts
/**
 * Called once per frame while any of the element's values change, with every
 * latest value (e.g. `{ x: 42, opacity: 0.5 }`). Mirrors Motion's `onUpdate`.
 * Having it keeps the element's transforms on the main thread.
 */
export type MotionOnUpdate = ((latest: ResolvedValues) => void) | undefined
```

Import `ResolvedValues` as a type from `motion-dom`. Add `onUpdate?: MotionOnUpdate` with a one-line JSDoc
next to `onAnimationComplete` in the props interface, and export `MotionOnUpdate` from `src/lib/index.ts` beside
`MotionOnProjectionUpdate`.

**Verify**: `pnpm check` → 0 errors.

### Step 3: Forward the prop to the VisualElement

In `_MotionContainer.svelte`:

1. Destructure `onUpdate: onUpdateProp,` directly after `onAnimationComplete: onAnimationCompleteProp,`.
2. In `buildMotionNodeProps()`, add `onUpdate: onUpdateProp,` beside `transformTemplate: transformTemplateProp,`
   with a short comment: motion-dom subscribes it through `propEventHandlers` (fires on `preRender` with
   `latestValues`), and `canAccelerateTransform` reads it to keep transforms off the compositor. Adding it
   later demotes a running group in `VisualElement.update`. Cite `VisualElement.ts` and `TransformAnimation.ts`
   @ v14.2.0. Don't invoke the callback anywhere.

**Verify**:

- `pnpm vitest run src/lib/html/_MotionContainer.spec.ts` → all pass.
- `pnpm playwright test e2e/motion/on-update.spec.ts` → all pass.
- `pnpm playwright test e2e/independent-transforms` → 4 passed, 1 failed: the `layout` test only.
  If `transformTemplate and onUpdate stay on the main thread` still fails, STOP.

### Step 4: Docs, example, changeset, links

1. Docs page `docs/src/routes/docs/on-update/+page.svx`, modelled on `transform-template/+page.svx` (SEO
   block, intro, code sample, `<Example>` embed). Cover: the signature; it runs once per frame while values change;
   the prop vs the transition-level `onUpdate` (per animation, gets that value only); and "Having `onUpdate` keeps the
   element's transforms on the main thread, so only use it when you need every frame. For a single value, prefer
   `useMotionValueEvent`." Link `/docs/use-motion-value-event` and `/docs/transform-template`.
2. Demo `docs/src/lib/examples/on-update/demos/Default.svelte`: a box animating `x`/`rotate` on a loop, with a
   live readout of `latest` printed from `onUpdate`. Example route `docs/src/routes/examples/on-update/+page.svelte`
   mirrors the transform-template example route.
3. Register at every site found by `grep -rn "transform-template" docs/src` (docsNav: `{ title: 'onUpdate', href: '/docs/on-update', icon: … }`,
   keeping the list's ordering convention).
4. Link the test page from `src/routes/+page.svelte` in the "Independent transforms (Motion 14.2)" section.
5. `.changeset/on-update-prop.md` (`minor`): motion components accept `onUpdate(latest)`, called once per frame
   with every latest value, as in Motion. Having it keeps the element's transforms on the main thread.
6. Google-style JSDoc on everything public you added.

**Verify**: `trunk fmt` then `trunk check` → clean; `pnpm check` → 0 errors; `pnpm build` → exit 0.

### Step 5: Final gate

**Verify**: `pnpm test:only` passes; `pnpm playwright test e2e/motion e2e/independent-transforms` → everything
passes except the known `independent-transforms … layout animation` test; `git status` shows only in-scope files.

## Test plan

- Red anchors: the parity spec's `on-update` assertion (upstream port, unchanged) and the new
  `e2e/motion/on-update.spec.ts` `#prop`/`#late` cases. All fail before Step 3 and pass after it.
- Unit: `onUpdate` is called with the latest values; it doesn't leak to the DOM.
- Controls: `#transition` (transition-level callback, already working) and `#control` (still accelerated).

## Done criteria

- [ ] Red observed in Step 1 (failure output quoted in your report), green after Step 3
- [ ] `pnpm playwright test e2e/independent-transforms` → only the `layout` test fails
- [ ] `pnpm playwright test e2e/motion/on-update.spec.ts` all pass
- [ ] `pnpm test:only` passes; `pnpm check` 0 errors; `pnpm build` exit 0; `trunk check` clean
- [ ] `MotionOnUpdate` exported; docs page, example, demo and nav entry present; changeset present
- [ ] No code path in `src/lib` invokes `onUpdate` directly (`grep -rn "onUpdateProp(" src/lib` → no output)

## STOP conditions

- `#transition` fails in Step 1 (transition-level callbacks are lost; the investigation is out of scope).
- After Step 3 the parity spec's `on-update` assertion still fails, or `onUpdate` fires twice per frame.
- Forwarding `onUpdate` changes any other existing e2e/unit result.
- Port 4198 occupied.

## Maintenance notes

- svelte-motion only forwards the prop. If upstream renames or reshapes `onUpdate` or `propEventHandlers`,
  the unit case catches it on the next Motion bump.
- The other `propEventHandlers` (`onAnimationStart`/`Complete`, `onLayoutMeasure`, …) are still fired by
  svelte-motion's own code, not forwarded. Don't forward them here: they would double-fire.
