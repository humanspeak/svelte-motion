# Guard log: plan 015 (`useMotionValueEvent` supports every event)

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-015`. No STOP conditions fired.
- **Red reproduced by the guard:** with `motionValueEvent.ts` reverted, `vitest run src/lib/utils/motionValueEvent.svelte.spec.ts` → 5 failed, 3 passed, as predicted.
- **Green reproduced:** 8/8.
- **Diff read in full:**
  - Motion values are checked first (`isMotionValue`) and subscribe with `value.on(event, callback)`.
  - A readable store with any event other than `'change'` logs a DEV warning and returns a no-op.
  - A readable store with `'change'` keeps its skip-first-emission behaviour.
  - An augmented motion value with `'change'` now goes through `.on('change')` instead of `.subscribe`. Neither emits on subscribe, so its behaviour is unchanged.
  - The new `esm-env` import is covered by plan 001, which makes it a runtime dependency.
- **Executor-reported, not re-run:** `pnpm check` 0 errors (both `@ts-expect-error` lines are used), `pnpm test:only` 1740/1740 on the final run, `pnpm build` ok, Trunk clean.
  - The first full run had 1 failure, in `chromiumLaunchOptions.spec.ts`, under load from the other lanes. It passed alone.
- **Follow-up:** `docs/src/routes/docs/use-motion-value-event/+page.svx:15` still lists `'Auto Cleanup'` in `seo.ogFeatures`. It's out of the plan's scope and is recorded in the batch README for the docs pass.
- **Integrated:** `f2cf4603` on `fix/2.14.1`.
