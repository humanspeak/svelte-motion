# Plan 003: Hover-end restores authored style values before falling back to neutral defaults

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/hover.ts`
> Plans 001/002 edit other regions of `hover.ts`; only `computeHoverBaseline`
> matters here. If ITS excerpt below doesn't match the live code, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001-hover-composed-default-transitions.md (file overlap only — land 001 first to avoid conflicts)
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

When a hover ends, the port computes a baseline to restore each hovered key to. The preference chain short-circuits at hardcoded neutral defaults (`opacity: 1`, `scale: 1`, `rotate: 0`, …) BEFORE ever consulting the element's authored styles. Upstream framer-motion (`VisualElement.getBaseTarget` → `getBaseTargetFromProps` → `baseTarget` read from the DOM at creation) has no neutral-default step: a value authored only via the `style` prop or a stylesheet restores to that authored value. Concrete divergence: an element with stylesheet `opacity: 0.8` and `whileHover={{ opacity: 1 }}` pops to `opacity: 1`… and stays there? No — it restores to the neutral `1` instead of the authored `0.8` on hover end. Same for a stylesheet-authored `transform: rotate(3deg)` restoring to `0`. Visible pop on hover exit for any style-authored value.

## Current state

- `src/lib/utils/hover.ts` — `computeHoverBaseline` (exported, lines 100-179 at plan time) computes the restore record.

Verbatim excerpt (the preference chain, `hover.ts:159-177`):

```ts
for (const key of Object.keys(whileHoverRecord)) {
    if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
        baseline[key] = animateRecord[key]
    } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
        baseline[key] = initialRecord[key]
    } else if (baseValuesRecord[key] !== undefined) {
        baseline[key] = baseValuesRecord[key]
    } else if (key in neutralTransformDefaults) {
        baseline[key] = neutralTransformDefaults[key]
    } else {
        // Check if inline style has a CSS variable for this property
        const inlineValue = getInlineStyleValue(key)
        if (inlineValue) {
            baseline[key] = inlineValue
        } else if (key in (cs as unknown as Record<string, unknown>)) {
            baseline[key] = (cs as unknown as Record<string, unknown>)[key]
        }
    }
}
```

Facts:

- `neutralTransformDefaults` (hover.ts:117-132) includes `opacity: 1` plus all transform channels — so for those keys the computed-style/inline-var fallbacks are UNREACHABLE.
- `baseValuesRecord` comes from the caller's `getBaseTransformValues()` (`_MotionContainer.svelte`, `getStyleTransformValues`), which is transform-channel-only. Authored `opacity` never arrives via `baseValues`.
- `cs` is `getComputedStyle(el)` captured at hover START — for `opacity` this reads the authored value correctly at that moment (hover hasn't animated yet; the baseline is computed in the hover-start callback before animations begin — see `attachWhileHover`'s hover-start ordering: `computeHoverBaseline` is called before `animateGestureTarget`).
- The docstring (hover.ts:87-99) documents the CURRENT preference order — it must be updated with the new order.
- Why neutral defaults exist at all (do not regress this): computed style for TRANSFORM channels can't be read per-channel from the matrix cheaply, and reading `cs.transform` returns a matrix string, not a channel value — restoring `scale` to a matrix string is meaningless. Neutral defaults are the safe fallback for transform channels ONLY when nothing authored exists.
- Upstream references (read-only): `~/Github/motion/packages/motion-dom/src/render/VisualElement.ts` (`getBaseTarget`, ~lines 901-941), `animation-state.ts` (removed keys fall back to `getBaseTarget`).

## Commands you will need

| Purpose       | Command                                                                                                                 | Expected on success |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                                                            | exit 0              |
| Unit tests    | `pnpm vitest run src/lib/utils/hover.spec.ts`                                                                           | all pass            |
| E2e           | `PW_REUSE_SERVER=1 npx playwright test e2e/motion/<spec> --reporter=line` if 4198 has a listener, else drop the env var | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                                             | clean               |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/utils/hover.ts` (`computeHoverBaseline` + its docstring only)
- `src/lib/utils/hover.spec.ts` (unit tests — `computeHoverBaseline` is a pure-ish exported function, ideal for jsdom unit testing)
- `src/routes/tests/motion/hover-authored-opacity/+page.svelte` (create)
- `e2e/motion/hover-authored-opacity.spec.ts` (create)

**Out of scope**:

- Transform-channel decomposition from computed matrices (plan 002 adds `readTransformChannels`; integrating it here is EXPLICITLY deferred — see Maintenance notes).
- `_MotionContainer.svelte` baseline sources.

## Git workflow

- Current branch; `test(hover): …` red commit then `fix(hover): …` commit. Do NOT push.

## Steps

### Step 1: Failing unit + e2e tests

Unit (`src/lib/utils/hover.spec.ts`, jsdom): create an element with a stylesheet-free inline `style="opacity: 0.8"`, call `computeHoverBaseline(el, { whileHover: { opacity: 1 } })` (no `initial`/`animate`/`baseValues`), and assert `baseline.opacity === '0.8'` (string from computed style is acceptable; assert `Number(baseline.opacity) === 0.8` to be format-agnostic). Current code returns `1` — the test fails. Add a second case: stylesheet-authored value via a `<style>` tag appended in the test (jsdom applies it) to cover non-inline authorship.

E2e: page `src/routes/tests/motion/hover-authored-opacity/+page.svelte` modeled on `src/routes/tests/motion/hover-transform-channels/+page.svelte`:

```svelte
<motion.div
    whileHover={{ opacity: 1 }}
    style="width: 100px; height: 100px; background: #247768; opacity: 0.8;"
    data-testid="motion-hover-authored-opacity"
/>
```

Spec (model on `e2e/motion/hover-opacity.test.ts`): read initial computed opacity (0.8) → hover → poll until ~1 → move mouse away → poll settle → assert final computed opacity is 0.8 ± 0.02 (currently settles at 1).

**Verify**: `pnpm vitest run src/lib/utils/hover.spec.ts` → new unit cases FAIL (got 1, expected 0.8). `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-authored-opacity.spec.ts --reporter=line` → FAILS (settles at 1).

### Step 2: Reorder the preference chain

In `computeHoverBaseline`, restructure the chain so authored sources outrank neutral defaults, matching upstream `getBaseTarget` semantics:

1. `animateRecord[key]`
2. `initialRecord[key]`
3. `baseValuesRecord[key]`
4. inline-style CSS-function value (`getInlineStyleValue(key)`)
5. **non-transform keys only**: computed-style value when the property exists on `cs` and parses meaningfully (e.g. `opacity`) — read it via `cs.getPropertyValue(kebabKey)` for reliability, falling back to the camelCase index access that exists today
6. `neutralTransformDefaults[key]` (now last)
7. final fallback: existing computed-style index access

Transform channels intentionally skip step 5 (a matrix string is not a channel value) and land on their neutral default as today — preserving the behavior the defaults were added for. Update the docstring's documented preference order (hover.ts:87-99) to match. Keep the ReDoS-safe `getInlineStyleValue` unchanged.

**Verify**: `pnpm vitest run src/lib/utils/hover.spec.ts` → unit cases PASS. E2e spec → PASSES.

### Step 3: Full gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils` → all pass. `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-authored-opacity.spec.ts e2e/motion/hover-opacity.test.ts e2e/motion/hover-and-tap.test.ts e2e/motion/hover-authored-transforms.spec.ts --reporter=line` → all pass. `trunk fmt`/`trunk check` on touched files → clean.

## Test plan

- Red anchor: authored `opacity: 0.8` restores to 1 today; 0.8 after the fix (unit + e2e).
- Unit matrix: key in `animate` (wins over style), key in `initial`, key only in `baseValues`, non-transform key only in style (NEW behavior), transform key with nothing authored (still neutral), key in none of them (computed fallback).
- Pattern: model unit tests on the existing describe/it style in `src/lib/utils/gestureCoordinator.spec.ts`.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm vitest run src/lib/utils` exits 0, incl. ≥6 new `computeHoverBaseline` cases
- [ ] Step 1 unit + e2e exist and pass (failed at plan time)
- [ ] Docstring order matches implementation (`grep -A8 "Preference order" src/lib/utils/hover.ts` or equivalent shows the new chain)
- [ ] Four-spec e2e set passes; no out-of-scope files modified; README row updated

## STOP conditions

- The excerpt chain doesn't match live code.
- The e2e red test PASSES against current code (would mean opacity restore already works through another path — report which path).
- `hover-opacity.test.ts` (existing spec) regresses after Step 2 — its expectations encode the old semantics; report the conflict rather than editing that spec's assertions.

## Maintenance notes

- Follow-up intentionally deferred: transform channels authored ONLY in stylesheets (e.g. CSS `transform: rotate(3deg)`) still restore to neutral. Fixing that needs per-channel matrix decomposition (plan 002's `readTransformChannels`) fed into step 5 for transform keys — do it later, on top of both plans, with its own red test.
- Reviewer: verify a hover key present in `animate` still restores to the `animate` value (chain order regression risk).
