# Plan 009: Layout observation covers bounded ancestor chains and survives re-parenting

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/layout.ts src/lib/html/_MotionContainer.svelte`
> Plan 008 adds a commit-dedup guard in `_MotionContainer.svelte` — expected.
> If `observeLayoutChanges` itself has drifted from the excerpt, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 008-layout-single-commit-guard.md (more observer traffic must not double-commit)
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

Upstream framer-motion measures the WHOLE projection tree on any tracked update (`create-projection-node.ts` `didUpdate` → `nodes.forEach(updateLayout)`), so a style change on ANY ancestor that re-slots a layout element animates. Our port's `observeLayoutChanges` watches only `el` and `el.parentElement`, captured ONCE at attach time. Two gaps: (1) a grandparent-or-higher change (e.g. `align-items` flipped two levels up) re-slots the element with no observed signal — it snaps; (2) after a DOM re-parent (portal, imperative move), the observers keep watching the OLD parent — subsequent new-parent changes snap. Both are silent fidelity gaps versus upstream's tree-global measurement.

## Current state

- `src/lib/utils/layout.ts:479-563` — `observeLayoutChanges(el, onChange)`. Key excerpt (parent wiring, verbatim):

```ts
if (el.parentElement) {
    childListObserver.observe(el.parentElement, { childList: true, subtree: true })
    parentAttributeObserver.observe(el.parentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        attributeOldValue: true
    })
}
```

- The style-mutation filter (`stripNonChildLayoutStyle`, `layout.ts:43-53`, unit-tested in `layout.spec.ts`) ignores animation-channel-only style changes; it MUST be applied at every observed ancestor level or FLIP/gesture writers on ancestors will cause commit storms — this is the documented reason the parent observer filters (comment at `layout.ts:519-527`).
- The caller: `_MotionContainer.svelte` (`observeLayoutChanges` is invoked in the layout `$effect` around `:2410-2440`; cleanup on teardown). The `$effect` deps are `element, layoutProp, isLoaded, hasLayoutFeatures` — re-parenting does not re-run it.
- Upstream reference (read-only): `~/Github/motion/packages/framer-motion/src/projection/node/create-projection-node.ts` (`didUpdate`, tree walk), `MeasureLayout.tsx` (every layout node's update reaches the ROOT).

## Commands you will need

| Purpose    | Command                                                                                         | Expected on success |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck  | `pnpm check`                                                                                    | exit 0              |
| Unit tests | `pnpm vitest run src/lib/utils/layout.spec.ts`                                                  | all pass            |
| E2e        | `PW_REUSE_SERVER=1 npx playwright test <specs> --reporter=line` if 4198 occupied, else drop env | pass                |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/utils/layout.ts` (`observeLayoutChanges` only)
- `src/lib/utils/layout.spec.ts` (extend)
- `src/routes/tests/motion/layout-grandparent-toggle/+page.svelte` (create)
- `e2e/motion/layout-grandparent-toggle.spec.ts` (create)

**Out of scope**:

- `_MotionContainer.svelte` — the observer helper's contract (`observeLayoutChanges(el, onChange) → cleanup`) must not change signature; all new behavior lives inside the helper.
- The projection adapter; `stripNonChildLayoutStyle`'s channel list.

## Git workflow

- Current branch; `test(motion): …` then `fix(layout): …`. Do NOT push.

## Steps

### Step 1: Failing e2e — grandparent re-slot snaps today

Page `src/routes/tests/motion/layout-grandparent-toggle/+page.svelte` (model on `src/routes/tests/motion/layout-align-toggle/+page.svelte`): grandparent flex container whose `align-items`/`justify-content` toggles via a button; a static middle wrapper div (plain, no styles that change); inside it, a `layout` motion.div. Toggling the GRANDPARENT re-slots the motion element; the middle wrapper's attributes never change.

Spec `e2e/motion/layout-grandparent-toggle.spec.ts` (model on `e2e/motion/layout-align-toggle.spec.ts`, including its hydration wait): click toggle, sample the element's `left` per frame (`sampleRectLeftSeries` from `e2e/_helpers/transform.ts`), assert ≥4 intermediate positions between start and end (animation), not a single jump. Current code: snap — the series has no intermediates.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/layout-grandparent-toggle.spec.ts --reporter=line` → FAILS (no intermediate positions).

### Step 2: Bounded ancestor walk with the same filter

In `observeLayoutChanges`, replace the single-parent wiring with a bounded ancestor chain: walk `el.parentElement` upward up to `MAX_OBSERVED_ANCESTORS = 4` levels (constant with a comment: bounded to cap observer cost; upstream is tree-global via its projection tree, cite `create-projection-node.ts`), attaching to EACH level the same filtered attribute observer logic (share ONE `MutationObserver` instance observing multiple targets — `observer.observe()` may be called per target; the mutation callback already filters per-mutation via `stripNonChildLayoutStyle`). Keep the immediate parent's `childList` observation as-is (subtree:true already covers descendants of the parent; do NOT add childList at higher levels — that widens noise, and re-slots from higher-level DOM insertion arrive via the element's own rect diff on the attribute path only when attributes change; document this boundary in a comment).

Unit tests (`layout.spec.ts`, jsdom + MutationObserver): grandparent style change (non-filtered property) triggers `onChange`; grandparent style change touching ONLY `transform` does NOT; change at level 5 (beyond bound) does NOT (documents the bound).

**Verify**: `pnpm vitest run src/lib/utils/layout.spec.ts` → new cases pass. Step 1 e2e → PASSES.

### Step 3: Re-bind on re-parent

Inside `observeLayoutChanges`, detect re-parenting and re-wire the ancestor observers: observe each currently-watched ancestor's `childList` (non-subtree) with a dedicated small observer watching for `el`'s chain changing — simplest robust approach: in `schedule()` (already invoked on every relevant signal) AND in a `childListObserver` callback, compare the current `el.parentElement` chain (up to the bound) against the captured chain; when different, disconnect and re-attach the ancestor observers to the new chain, then proceed with `onChange`. Chain comparison is a cheap array-of-references equality. Add a unit test: move `el` to a new parent (jsdom `newParent.appendChild(el)`), mutate the NEW parent's style (layout-affecting), assert `onChange` fires; mutate the OLD parent's style, assert it does NOT (post-move).

**Verify**: `pnpm vitest run src/lib/utils/layout.spec.ts` → re-parent cases pass.

### Step 4: Full regression gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils/layout.spec.ts` → pass. `PW_REUSE_SERVER=1 npx playwright test e2e/motion/layout-grandparent-toggle.spec.ts e2e/motion/layout-align-toggle.spec.ts e2e/motion/layout-class-toggle.spec.ts --reporter=line` (the last exists after plan 008) plus any `e2e/reorder/` and `e2e/layout/` specs present → all pass. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: grandparent toggle snaps (0 intermediates) today; ≥4 intermediates after.
- Unit: ancestor-level filtering, bound cutoff, re-parent re-bind (fires for new parent, silent for old).
- Regression: layout-align-toggle (immediate parent) and plan 008's single-commit guard under the increased observer traffic.

## Done criteria

- [ ] `pnpm check` exits 0; layout unit spec green with ≥5 new cases
- [ ] Step 1 spec exists and passes (failed at plan time)
- [ ] layout-align-toggle + layout-class-toggle specs green
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- The grandparent red test does NOT snap on current code (some other signal — e.g. ResizeObserver on the element — already catches it; report which signal fired and re-scope: the finding may only manifest for position-only re-slots that don't resize the element; adjust the page to guarantee position-only, e.g. fixed-size element, before concluding).
- Observer fan-out causes `layout-align-toggle` flakiness (commit storms) — report sample commit counts; do not tune filters ad hoc.
- Fix requires changing the `observeLayoutChanges` signature.

## Maintenance notes

- The `MAX_OBSERVED_ANCESTORS = 4` bound is a deliberate cost cap — a future deep-tree bug report should raise it consciously, not silently.
- When issue #449's projection-tree adoption lands, this DOM-scoped observation should be replaced by tree-global measurement; keep the helper self-contained so it can be swapped.
- Reviewer: the shared-observer teardown must disconnect ALL levels (leak check: `cleanup()` then mutate every previously-watched ancestor — no `onChange`).
