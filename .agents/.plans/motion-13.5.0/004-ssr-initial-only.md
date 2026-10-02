# Plan 004: The server render starts elements from `initial`, never from the `animate` target

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.5.0/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **NEVER use `git stash`** — it is shared across every worktree of this repo.
>
> **Drift check (run first)**:
> `git diff --stat 3d84ecd5..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/style.ts src/lib/html/_MotionContainer.ssr.spec.ts e2e/svg/unresolved-origin.spec.ts`
> On a mismatch with the excerpts below, STOP.

## Status

- **Priority**: P1 (user-visible: elements without `initial` don't animate on a server-rendered first load)
- **Effort**: M
- **Risk**: MED-HIGH (touches every motion element's server-rendered style; full e2e is the gate)
- **Depends on**: none (builds on 002's spec, already on the branch)
- **Category**: bug (upstream parity)
- **Planned at**: commit `3d84ecd5`, 2026-10-02

## Why this matters

When a motion element has no `initial`, our **server render** writes its
`animate` target into the inline style. So `<motion.div animate={{ '--x': 100 }}>`
ships from the server as `style="--x: 100"`. On hydration, motion-dom reads the
starting value from the DOM, gets 100, and there's nothing to animate. The
element sits at its final value instead of animating. Transforms (`x`, `scale`),
colors, and CSS variables visibly fail to animate on a server-rendered first
load. Client-side navigation is unaffected, which is why this went unnoticed.
The maintainer found it in an eye test of `/tests/svg/unresolved-origin`, where
the `--x` readout never left 100.

Measured on that page's server HTML at `3d84ecd5`:

```html
<div id="css-var" data-testid="css-var" style="--x: 100">
<polygon … points="0,20 550,38" … style="points: 720,38 712,50 389,50 380,36">
```

Upstream (Framer Motion) never does this. Its `makeLatestValues`
(`packages/framer-motion/src/motion/utils/use-visual-state.ts`, v13.5.0) seeds only
from `initial`, or from `animate` when the initial animation is **blocked**:

```ts
    let isInitialAnimationBlocked = presenceContext
        ? presenceContext.initial === false
        : false
    isInitialAnimationBlocked = isInitialAnimationBlocked || initial === false

    const variantToSet = isInitialAnimationBlocked ? animate : initial
    ...
                    if (Array.isArray(valueTarget)) {
                        // final keyframe when blocked, first keyframe otherwise
                        const index = isInitialAnimationBlocked ? valueTarget.length - 1 : 0
```

So with no `initial`, upstream renders nothing for that key. With
`initial={false}` it renders the `animate` values (last keyframe).

## Current state

### The client already follows upstream

`src/lib/utils/visualElementCore.ts` exports `makeLatestValues(props, context,
presenceContext, scrapeMotionValues)` (~line 367), a port of the function above.
The client VisualElement is created with it (`_MotionContainer.svelte` ~1090–1125,
passing `context: { initial: inheritedInitialVariant, animate: effectiveAnimate }`
and `presenceContext: buildPresenceContext()`).

### The server branch doesn't (`src/lib/html/_MotionContainer.svelte` ~1495–1521)

```ts
        // ... SSR has no VisualElement and falls
        // back to the initial/animate serialization, keeping the server-rendered
        // style byte-identical.
        visualElement
            ? mergeInlineStyles(
                  inlineStyleBaseWithHolds,
                  undefined,
                  readAnimationStateStyleSlot(),
                  transformTemplateProp
              )
            : mergeInlineStyles(
                  inlineStyleBaseWithHolds,
                  isLoaded === 'mounting' || isLoaded === 'initial' ? initialKeyframes : undefined,
                  {
                      ...((isNotEmpty(initialKeyframes) && !effectiveAnimate
                          ? initialKeyframes
                          : renderedAnimateBaseline) ?? {}),
                      ...(svgAttrSplit
                          ? computeSSRSVGStyleValues(svgAttrSplit.motionValueAttrs)
                          : {})
                  },
                  transformTemplateProp
              )
```

`mergeInlineStyles` (`src/lib/utils/style.ts` ~76–100) uses its third argument
(`animateFallback`) whenever the second (`initial`) is empty. That fallback dates
from the first SSR commit (`b207dc46`, Sep 2025), before the Framer Motion parity
work. It was never a parity decision.

### Tests that pin the legacy behavior (must be flipped deliberately)

- `src/lib/html/_MotionContainer.ssr.spec.ts:31`: "falls back to first animate
  keyframe when initial is empty" (`initial: {}`, `animate: { scale: [2], opacity: [0.8] }`,
  expects `opacity: 0.8` and `scale(2)`). Under upstream's rule, `initial: {}`
  renders **nothing**. Rewrite it to expect no `opacity`/`transform`.
- `src/lib/utils/style.spec.ts:54`: a unit test of `mergeInlineStyles`' fallback
  parameter. It tests the utility, not the container. **Leave it** unless you
  remove the parameter. Don't remove it unless every caller is gone
  (`grep -rn "mergeInlineStyles(" src/lib`).

### The weak e2e that missed it (`e2e/svg/unresolved-origin.spec.ts`)

The CSS-variable test asserts every sample is ≥ 49.9, the last is > 50.5, and the
value eventually reaches ≥ 60. A jump straight to 100 satisfies all three. Upstream
asserts `within(65, 85)` at 5s.

## Commands you will need

| Purpose          | Command                                                                   | Expected        |
| ---------------- | ------------------------------------------------------------------------- | --------------- |
| SSR unit         | `pnpm exec vitest run src/lib/html/_MotionContainer.ssr.spec.ts`          | all pass        |
| Units (full)     | `pnpm test:only`                                                          | all pass        |
| Types / package  | `pnpm check` ; `pnpm package`                                             | 0 errors ; All good |
| e2e (focused)    | `pnpm exec playwright test e2e/svg/unresolved-origin.spec.ts`             | all pass        |
| e2e (full)       | `pnpm exec playwright test --reporter=line`                               | see Step 5      |
| Lint             | `trunk fmt <files>` then `trunk check --no-fix <files>`                   | no issues       |

Port 4198: Playwright builds and previews there. Never kill it, and never set
`PW_REUSE_SERVER`. If it is busy, wait 60s and retry (up to 10 times), then report blocked.

## Scope

**In scope:** `src/lib/html/_MotionContainer.svelte` (the server-branch style
source and its comment), `src/lib/html/_MotionContainer.ssr.spec.ts`,
`e2e/svg/unresolved-origin.spec.ts`, `.changeset/ssr-initial-only.md` (create),
and the README status row.

**Out of scope:** the client (`visualElement`) branch; `visualElementCore.ts`
(reuse `makeLatestValues`, don't change it); optimized-appear logic; `style.ts`
beyond what Step 3 strictly needs; and every other e2e spec. Do NOT edit other
tests to make them pass (see Step 5).

## Steps

### Step 1: Red — make the tests capable of failing

1. In `e2e/svg/unresolved-origin.spec.ts`, keep the existing tests and add:
   - **Server HTML**: `const html = await (await page.request.get(ROUTE + '?@isPlaywright=true')).text()`.
     Expect it NOT to match `/id="css-var"[^>]*style="[^"]*--x:\s*100/` and NOT to
     contain `style="points:`.
   - **Mid-animation**: after `goto`, poll `--x` until ≥ 51 (it has started), then
     wait until 4.5–5.5s after navigation and assert the value is within
     `[60, 90]` (linear 50→100 over 10s gives ~75 at 5s). Mirror upstream's `within(65, 85)`
     intent with tolerance for timing.
2. In `_MotionContainer.ssr.spec.ts`, add red cases (render with
   `@testing-library/svelte` like the existing tests):
   - `animate: { '--x': 100 }` with no `initial` → style contains no `--x`.
   - `animate: { x: 100 }` with no `initial` → style contains no `transform`.
   - `animate: { opacity: [0, 1] }` with no `initial` → style contains no `opacity`.
   - Control (already passes): `initial: false, animate: { opacity: 0.5 }` →
     `opacity: 0.5`. With `animate: { opacity: [0.2, 0.7] }` and `initial: false`
     → `opacity: 0.7` (last keyframe).
   - Control (already passes): `initial: { opacity: 0.3 }`, `animate: { opacity: 1 }` → `opacity: 0.3`.

**Verify**: the new e2e assertions FAIL (server HTML contains `--x: 100`; the
mid-animation value is 100). The three no-`initial` SSR cases FAIL. The controls
pass. Record the verbatim failures.

### Step 2: Rewrite the legacy SSR test

Change `_MotionContainer.ssr.spec.ts:31` to assert upstream's rule for
`initial: {}` (no `opacity`, no `transform`), and rename it to match. Add a code
comment citing `use-visual-state.ts` `makeLatestValues`.

**Verify**: it now fails against current code (the fallback still applies).

### Step 3: Fix the server branch with one rule

Replace the server branch's third argument so the starting style comes from
**`makeLatestValues`**, the same function and arguments the client VisualElement
uses (`context: { initial: inheritedInitialVariant, animate: effectiveAnimate }`,
`presenceContext: buildPresenceContext()`, the HTML or SVG scraper as the client
picks). Keep merging `computeSSRSVGStyleValues(...)` and `transformTemplateProp`
as today. Pass `undefined` as `mergeInlineStyles`' `initial` argument if
`makeLatestValues` now supplies everything, so the legacy fallback can't fire.
Reduced-motion filtering (`filterReducedMotionKeyframes`) must still apply to
the seeded values. Mirror how `initialKeyframes` is filtered today.

If `makeLatestValues` can't be called on the server branch (for example, a
context value isn't available there), STOP and report what's missing. Do not
reimplement the precedence by hand.

Update the comment above the branch: SSR now seeds exactly like the client's
`makeLatestValues`, from `initial`, or from `animate` only when the initial
animation is blocked.

**Verify**: `pnpm exec vitest run src/lib/html/_MotionContainer.ssr.spec.ts` → all
pass (new cases, rewritten case, controls, and the existing optimized-appear test).
Then `pnpm exec playwright test e2e/svg/unresolved-origin.spec.ts` → all pass.

### Step 4: Changeset

`.changeset/ssr-initial-only.md` (patch): "Server-rendered motion elements now start
from `initial`, not from their `animate` target, matching Framer Motion. Elements
with `animate` but no `initial` now animate on the first server-rendered load
instead of appearing at their final state. Use `initial={false}` to start at the
`animate` values."

### Step 5: Full gate, and report e2e failures without fixing them

Run `pnpm test:only`, `pnpm check`, `pnpm package`, and the **full** e2e suite
(baseline on this branch: 567 passed, 2 skipped, plus the specs added since).

This change alters the server-rendered first paint of many pages. If **any** e2e
spec fails, do NOT edit it and do NOT change library code to satisfy it. STOP and
report a table with spec, test name, and verbatim assertion. The maintainer
reviews failures page by page (CLAUDE.md "Failed e2e review workflow") and
decides whether each one is a stale test that encoded the old SSR behavior or a
real regression.

## Test plan

- Red first: 3 SSR unit cases, the rewritten legacy case, 2 e2e assertions (server
  HTML, mid-animation). Controls guard `initial={false}` (last keyframe) and own `initial`.
- Regression: the full e2e suite, with failures triaged with the maintainer, not
  auto-fixed.

## Done criteria

- [ ] Step 1 failures recorded verbatim; all of them pass after Step 3
- [ ] The server branch seeds via `makeLatestValues` (grep the call in the SSR branch)
- [ ] `_MotionContainer.ssr.spec.ts` and `unresolved-origin.spec.ts` pass
- [ ] `pnpm test:only`, `pnpm check`, `pnpm package` → green
- [ ] Full e2e → 0 failed, or a STOP report with the failure table
- [ ] Changeset added; only in-scope files changed; README row updated

## STOP conditions

- `makeLatestValues` can't be used on the server branch.
- Any controls fail after Step 3 (`initial={false}` must still render the animate values).
- Any e2e failure in Step 5. Report it; don't fix it.
- Hydration warnings or mismatches appear in the browser console on the
  unresolved-origin page (check `page.on('console')` for "hydration").

## Maintenance notes

- The server and client now share one seeding rule (`makeLatestValues`). Any future
  change to first-paint values belongs in `makeLatestValues`, not in `mergeInlineStyles`.
- `mergeInlineStyles`' `animateFallback` parameter may become unused. Removing it
  is a follow-up once callers are confirmed gone.
