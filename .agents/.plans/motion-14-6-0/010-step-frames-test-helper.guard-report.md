# Guard report — 010-step-frames-test-helper

**Recommendation: PASS** — helpers match upstream, the specs pass, and the tarball check shows nothing ships to npm.
**Reviewed at** `10bf6595` (lane/1460-frames, from feat/motion-14.6.0 `772ad117`) · 2026-10-26 19:06 · **Plan planned at** `45a24c6e`
**Integrated** — not yet: batch convention is one branch, one PR.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `frames.ts` exports `stepFrames` and `withManualFrames`; `frames.spec.ts` passes | met | `vitest run frames.spec.ts effects.spec.ts` → 11/11 (5 + 6) |
| No `frameSteps.` left in `effects.spec.ts` | met | grep -c → 0 |
| `pnpm check` 0 errors; `pnpm test:only`; `pnpm build` | met | executor: 0 errors, 92 files / 1157 tests, build 0; hook svelte-check passed on 10bf6595. Guard re-runs `pnpm test:only` in the batch's final gate (deferred while the full e2e triage held the CPU) |
| Helpers absent from the `npm pack` tarball (amended) | met | `npm pack --dry-run` filter → `[]` |
| Report lists further specs that could move to `stepFrames` | met | 8 candidates (LazyMotion, onExitCompleteTiming, initial, _MotionContainer, layoutId, motionDomProjection, observeMove, style) plus 007's animationFrame |

## Spirit

Specs can now drive Motion's frameloop on a manual clock with `processFrame`, the same way upstream's tests do. `effects.spec.ts` still has the same 6 tests with its hand-rolled 8-step loop replaced, which shows `processFrame` is a drop-in. Case 3 runs under `withManualFrames()`, so the animation's start time is on the manual clock and the ≈50 check is deterministic. The executor saw it pass on three runs.

## Scope & conduct

- In scope (3 files). `MotionGlobalConfig` and `animate` come from `motion`, because motion-dom 14.6.0 doesn't export them (the plan allows either).
- PLAN AMENDED 2026-10-26 (maintainer-approved): the STOP condition checked `dist/`, which already contains every `__tests__` folder; it now checks the published tarball. The executor stopped correctly instead of improvising.

## Residual risk / follow-ups

- `MotionGlobalConfig.useManualTiming` is global; any new spec calling `stepFrames` without `withManualFrames` must reset it (documented in the JSDoc).
- Migrating the candidate specs is follow-up work, not part of this batch.
