# Guard report — 003 hover-baseline-authored-values (amended)

**Recommendation: PASS (via amended plan, exec/plan-003b)** — the ORIGINAL
plan's approach was proven structurally wrong by its executor and was BLOCKED,
amended, and re-executed. Final fix delivers upstream `getBaseTarget` semantics:
authored non-transform base values captured ONCE at element creation at rest.
**Reviewed at** exec/plan-003b `f13b903` · 2026-07-23 · **Planned at** `6746859`, amended 2026-07-22
**Integrated** — cherry-picked to `style/brutalist-examples` 2026-07-23, zero conflicts.

## Execution history (two cycles — the process working as designed)

1. Original chain-reorder fix regressed `hover-opacity.test.ts` line 92 (string
   endpoint artifact). Guard approved a numeric-coercion amendment (REVISE).
2. Coercion exposed the deeper defect 3/3-reproducibly: baseline captured at
   hover-START reads mid-animation transients (~0.5) on rapid cycles. Executor
   STOPPED with an evidence table rather than improvising — correct conduct.
   Guard BLOCKED, amended the plan (creation-time capture, `_MotionContainer`
   baseline sourcing brought in scope), preserved the red tests (`86b29b9`) and
   the reorder+coercion diff as a patch asset, and re-dispatched on plan 011's tip.

## Done criteria (amended gate — stricter than original)

| Criterion                                       | Result | Evidence                                                              |
| ----------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `pnpm check` 0 errors; unit suite green         | met    | Guard reproduced: 653 passed                                          |
| Cherry-picked red tests pass unchanged          | met    | Unit cases + authored-opacity e2e green; assertions unweakened        |
| Four-spec e2e set                               | met    | Guard reproduced on port 4313: 10 passed                              |
| `hover-opacity.test.ts` 3 consecutive full runs | met    | Guard reproduced: 3/3/3 green (lines 59 AND 92)                       |
| Red authenticity                                | met    | Guard red-run at `13e557b` → authored-opacity fails; restored → green |

## Spirit

`baseStyleValues` (opacity) is read via `getComputedStyle` in the mount effect
BEFORE any animation, mirroring `VisualElement.baseTarget`; `computeHoverBaseline`
prefers it over neutral defaults, with live computed style only as an at-rest
fallback that production never reaches for threaded keys. Fully-numeric strings
coerce to `Number` (motion mishandles numeric-string endpoints).

## Scope & conduct

- Amended scope held (`_MotionContainer` baseline sourcing only). Capture
  limited to `opacity` per amendment ("at minimum"); generalization noted as
  follow-up. The record-first/live-fallback resolution of the amendment's
  "never live" clause vs "unit cases unchanged" was a sound structural judgment,
  accepted.
