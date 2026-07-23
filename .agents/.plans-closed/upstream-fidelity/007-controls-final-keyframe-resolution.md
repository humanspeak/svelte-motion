# Plan 007: Resolve wildcard/relative final keyframes before storing controls settle targets (investigate-first)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/variants.ts src/lib/html/_MotionContainer.svelte`
> Plans 005/006 edit `_MotionContainer.svelte` elsewhere; only
> `resolveRestingValues` and `applyAnimationControlsTarget` matter here.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (file-adjacent to 005/006; run after them to avoid merge noise)
- **Category**: bug (LOW confidence — investigate, then fix only if reproduced)
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

Upstream `controls.set()`/`start()` runs each value through `resolveFinalValueInKeyframes` (`~/Github/motion/packages/motion-dom/src/render/utils/setters.ts:46-52`): a trailing `null` keyframe (wildcard, "current value") and relative strings resolve to concrete values before being committed to motion values. Our `resolveRestingValues` takes `value[value.length - 1]` verbatim — so `controls.start({ x: [0, null] })` would store `x: null` into `lastAnimationControlsTarget`, and the settle-time inline-style builder may serialize garbage or drop the channel, snapping the element at settle. **Confidence is LOW**: the audit did not reproduce it; the WAAPI animation layer may reject or normalize these inputs earlier. Investigate first; fix only what reproduces.

## Current state

- `src/lib/utils/variants.ts:274-289` — verbatim:

```ts
export const resolveRestingValues = (
    keyframes: DOMKeyframesDefinition | undefined
): DOMKeyframesDefinition | undefined => {
    if (keyframes === undefined) return undefined
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(keyframes)) {
        if (Array.isArray(value)) {
            // An empty array has no resting value — omit the key rather than
            // emitting `value[-1]` (undefined).
            if (value.length > 0) out[key] = value[value.length - 1]
        } else {
            out[key] = value
        }
    }
    return out as DOMKeyframesDefinition
}
```

- `src/lib/html/_MotionContainer.svelte:1217-1220` — `applyAnimationControlsTarget` feeds `resolveRestingValues({...target, ...transitionEnd})` into the settle path (inline-style merge + `lastAnimationControlsTarget`).
- Upstream reference: `setters.ts` `resolveFinalValueInKeyframes`; also check how `motion`'s high-level `animate()` handles `[0, null]` at the WAAPI layer (it may throw or treat null as current — observe, don't assume).

## Commands you will need

| Purpose    | Command                                                                                                                            | Expected on success |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck  | `pnpm check`                                                                                                                       | exit 0              |
| Unit tests | `pnpm vitest run src/lib/utils/variants.spec.ts` (locate the actual spec file for variants.ts first: `ls src/lib/utils/*.spec.ts`) | all pass            |
| E2e        | `PW_REUSE_SERVER=1 npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line` if 4198 occupied, else drop env   | pass                |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- Investigation page work under `src/routes/tests/animation-controls/` (temporary additions allowed but must ship only if the fix ships)
- `src/lib/utils/variants.ts` (+ its spec) — only if reproduced
- `e2e/utilities/animation-controls.spec.ts` — only if reproduced

**Out of scope**:

- `applyAnimationControlsTarget` mechanics; plans 005/006 territory.

## Git workflow

- Current branch; if a fix ships: `test(controls): …` then `fix(controls): …`. If NOT reproduced: no source commits — update the plan README row to REJECTED with the observed behavior, and commit only that (`docs(plans): …`). Do NOT push.

## Steps

### Step 1: Reproduce (or fail to)

On the animation-controls test page, temporarily wire a button running `controls.start({ x: [0, null], transition: { duration: 0.3 } })` and one running `controls.start({ x: '+=50' })` (relative). In the browser (dev server) or via a quick Playwright probe, observe after each completes + after a reactive style poke (plan 005's poke button):

- Does the element's `transform` contain a valid `translateX`?
- Does `lastAnimationControlsTarget` corrupt the settle (element jumps/clears on the poke)?

Record exact observed behavior for both inputs.

**Verify**: written observation of both cases (screenshot or logged computed transform values).

### Step 2A (reproduced): red test + fix

Add an e2e test asserting the post-poke transform equals the animation's actual final value (fails per Step 1's observation). Then fix in `resolveRestingValues`: mirror upstream `resolveFinalValueInKeyframes` — accept an optional `current` resolver parameter or drop non-concrete finals: when the final array element is `null`/`undefined`, resolve to the PREVIOUS concrete element if one exists, else omit the key; when it is a relative string (`^[-+]=`), omit the key (with a comment citing `setters.ts` and noting full relative resolution needs the live value — omitting keeps the settle writer from serializing garbage, and the WAAPI layer already applied the real final). Update the function's JSDoc `@example` block. Unit tests: `[0, null]` → `0`; `[null]` → omitted; `['+=50']` → omitted; existing cases unchanged.

**Verify**: unit spec green; new e2e green; full `animation-controls.spec.ts` green.

### Step 2B (not reproduced): document and reject

Remove temporary page wiring. Update the plan README row: `REJECTED — [0, null]/relative inputs observed to <actual behavior>; settle uncorrupted`. Add one unit test pinning the CURRENT `resolveRestingValues` array behavior (so future changes are deliberate).

**Verify**: `pnpm vitest run` green; `git status` shows only spec + README changes.

### Step 3: Full gate

`pnpm check` → 0; `pnpm vitest run` → pass; `PW_REUSE_SERVER=1 npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line` → pass; `trunk fmt`/`trunk check` → clean.

## Test plan

- This plan's red test exists only in the 2A branch (the finding is LOW confidence; the investigation IS the first gate). If 2B, the pinning unit test documents current behavior instead — that substitution is the justified exemption.

## Done criteria

- [ ] Step 1 observations recorded in the completion report
- [ ] Either (2A) red e2e + fix + unit cases green, or (2B) REJECTED row + pinning test
- [ ] `pnpm check` and `pnpm vitest run` exit 0; no out-of-scope modifications

## STOP conditions

- `controls.start({ x: [0, null] })` throws synchronously in the WAAPI layer — that is a DIFFERENT divergence (upstream accepts it); report it, do not fix it here.
- The fix seems to require threading a live current-value resolver into `resolveRestingValues` call sites beyond `applyAnimationControlsTarget` — report the call-site list instead.

## Maintenance notes

- If 2A ships: `resolveRestingValues` is also used by declarative settle paths — the omit-key behavior must be verified against `animate={{ x: [0, null] }}` too (add that case to the unit spec).
