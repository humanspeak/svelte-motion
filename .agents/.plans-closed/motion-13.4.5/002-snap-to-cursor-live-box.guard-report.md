# Guard report — 002-snap-to-cursor-live-box

**Recommendation: PASS** — upstream formula ported, ~133 lines of projection bookkeeping removed; new e2e numbers derived and observed identically
**Reviewed at** 3f7d00ef · 2026-09-28 16:25 · **Plan planned at** 67815169
**Integrated** — committed on chore/motion-13.4.5; no PR mid-batch (batch convention: one branch → one PR after maintainer sign-off)

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Step 3.1 symbol grep no matches | met | grep → none |
| no e.pageX in snap block | met | grep → none |
| pnpm test / pnpm check | met | 953/953; 0 errors |
| focused e2e + docs build/check | met | e2e/drag 94 passed; docs build exit 0, docs check 0 errors |
| only in-scope files; drag.ts shrank | met | net −133 lines |
| React reference confirmation | deferred | Plan 006 Step 4 (needs 13.4.5 on npm) |

## Spirit

Snap now centers the rendered box under the cursor exactly like upstream 13.4.5; the executor's derivation (716,−202) matches the observed bound values and the physical-centering assertions pass unchanged.

## Scope & conduct

- In-scope only: yes
- STOP conditions respected: yes (none fired)
- Plan amendments: none

## Residual risk / follow-ups

- Executor also removed `currentAxisValues` (only fed the deleted center helper) — within intent.
- Ported repeated-snap test was already green on old code in jsdom (no scroll/transform); the rewritten transformPagePoint test provided the red.
- Docs build regenerates docs/static/r/animated-tabs.json — reverted, not part of this plan.
- Maintainer visual sign-off still required before PR.
