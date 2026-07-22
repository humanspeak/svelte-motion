# Plan 010: Authored base transforms compose in upstream's canonical order (perspective first)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/transformComposer.ts`
> Mismatch against the excerpt = STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (opaque string parsing has sharp edges — the plan bounds it)
- **Depends on**: none (001 touches hover.ts, not this file's composition contract)
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

CSS transforms are non-commutative. Upstream motion-dom's `buildTransform` emits channels in a canonical order with `transformPerspective` FIRST (`~/Github/motion/packages/motion-dom/src/render/utils/keys-transform.ts` `transformPropOrder`; `build-transform.ts`). Our `buildGestureTransform` appends the authored raw base transform AFTER the generated channels — so an element authored with `transform: perspective(600px)` that gains a gesture scale renders `scale(…) perspective(600px)`, which projects differently than upstream's `perspective(600px) scale(…)`. Any 3D-flavored docs demo (tilt cards, flips) hovered/tapped will look subtly wrong versus framer-motion.

## Current state

- `src/lib/utils/transformComposer.ts:24-31` — verbatim:

```ts
export const buildGestureTransform = (
    latestValues: GestureTransformValues,
    baseTransform = '',
    transformTemplate?: TransformTemplate
): string => {
    const generated = buildTransform(latestValues, {}, transformTemplate)
    return [generated === 'none' ? '' : generated, baseTransform].filter(Boolean).join(' ')
}
```

- The doc example above it (line ~21-23) currently documents the wrong order (`'translateX(20px) rotate(4deg) perspective(600px)'`) — it must be updated with the fix.
- Callers: `src/lib/utils/hover.ts` (`writeComposedChannels`) and drag composition (search `buildGestureTransform` across `src/lib/` for the full caller list before changing behavior — `grep -rn "buildGestureTransform" src/lib/`).
- Upstream reference (read-only): `keys-transform.ts` `transformPropOrder` (perspective/transformPerspective index 0), `build-transform.ts` (~lines 36-63).
- Repo convention: pure utils in this file carry Google-style JSDoc with `@example` blocks and have colocated `*.spec.ts` unit tests.

## Commands you will need

| Purpose               | Command                                                                                                                                                                                                                    | Expected on success |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck             | `pnpm check`                                                                                                                                                                                                               | exit 0              |
| Unit tests            | `pnpm vitest run src/lib/utils`                                                                                                                                                                                            | all pass            |
| E2e (regression only) | `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-authored-transforms.spec.ts e2e/motion/tap-authored-transforms.spec.ts e2e/motion/pan-authored-transforms.spec.ts --reporter=line` if 4198 occupied, else drop env | pass                |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/utils/transformComposer.ts`
- `src/lib/utils/transformComposer.spec.ts` (create if absent — check `ls src/lib/utils/*.spec.ts`)

**Out of scope**:

- Callers (`hover.ts`, drag) — the fix is inside the composer; call sites unchanged.
- Full CSS transform parsing/reordering of arbitrary base strings (explicitly bounded below).

## Git workflow

- Current branch; `test(utils): …` then `fix(utils): …` commits. Do NOT push.

## Steps

### Step 1: Failing unit test

In `src/lib/utils/transformComposer.spec.ts`, add cases asserting upstream ordering:

```ts
expect(buildGestureTransform({ scale: 1.2 }, 'perspective(600px)')).toBe(
    'perspective(600px) scale(1.2)'
)
```

Plus: `perspective(600px) rotateX(20deg)` base + `{ scale: 1.2 }` → perspective must precede everything; a base WITHOUT any perspective function stays appended after generated channels (current behavior, unchanged); empty base unchanged; base-only (no channels) unchanged.

**Verify**: `pnpm vitest run src/lib/utils/transformComposer.spec.ts` → new perspective cases FAIL (perspective emitted last).

### Step 2: Hoist leading perspective functions

In `buildGestureTransform`, before joining: extract any `perspective(...)` function(s) from the base string with a conservative regex over top-level function tokens (`/\bperspective\([^)]*\)/g` — values cannot contain nested parens for perspective), remove them from the base remainder, and emit `[perspectiveParts, generated, baseRemainder]` in that order. Do NOT attempt to reorder any other function — upstream's canonical slots for rotate/skew/etc. cannot be honored for opaque strings without full parsing; document that bound in the JSDoc, citing `keys-transform.ts` `transformPropOrder`, and note that channelized props (the normal path) are already canonically ordered by `buildTransform`. Update the `@example` block to show the corrected output.

**Verify**: `pnpm vitest run src/lib/utils/transformComposer.spec.ts` → all cases pass.

### Step 3: Full gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils` → pass. The three authored-transforms e2e specs (regression — they exercise base-transform composition paths) → pass. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: perspective-ordering unit cases fail today, pass after.
- Edge cases in the spec: multiple perspective tokens, perspective with var() value (regex must not capture beyond the closing paren — add the case; if var() appears inside perspective, `[^)]*` stops early — assert current-behavior passthrough and document), base with only perspective.
- E2e is regression-only; no red e2e (the visual difference needs a 3D-authored demo that doesn't exist in tests — noted as the justification for a unit-level red anchor).

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm vitest run src/lib/utils` green incl. ≥5 new cases
- [ ] Step 1 cases pass (failed at plan time)
- [ ] Three authored-transforms e2e specs green
- [ ] JSDoc `@example` matches actual output
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- `grep -rn "buildGestureTransform" src/lib/` reveals a caller that depends on the base-last ordering (e.g. a snapshot test or drag math) — report it before changing behavior.
- var()-inside-perspective proves common in the codebase (grep docs/src for `perspective(var`) — the regex bound would corrupt it; report instead of shipping a broken parse.

## Maintenance notes

- If a future need arises to honor MORE canonical slots for opaque base strings, that's a real CSS transform parser — a dependency decision, not a regex extension. Don't grow this incrementally.
- Reviewer: confirm the non-perspective base path is byte-identical to before (only perspective hoisting changed).
