# Guard log: plan 001 (declare the `esm-env` dependency)

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-001`. No STOP conditions fired.
- **Red reproduced by the guard:** with `package.json` reverted, `vitest run src/lib/__tests__/declaredImports.spec.ts` → 1 failed with `undeclared runtime imports: esm-env (first imported by src/lib/html/_MotionContainer.svelte)`.
- **Green reproduced:** 2/2 pass.
- **Diff read in full:**
  - `package.json` moves `esm-env` `^1.2.2` from devDependencies to dependencies, with the range unchanged.
  - The lockfile only moves that one entry within the root importer.
  - The new spec and the changeset are added.
- **Accepted deviation:** the scanner first flagged `@humanspeak/svelte-motion` from a string literal in `motionKind.ts:86`. The executor tightened it so static imports must start a line, as the plan allows, and added a string-literal case to the scanner test.
- **Executor-reported, not re-run:** `pnpm build` and publint ok, `pnpm check` 0 errors, the vite6 consumer passes, Trunk clean.
  - The first full unit run had 2 failures, in `_MotionContainer.transitionOut.spec.ts` and `motionDomProjection.spec.ts` (9c), while 11 lanes loaded the machine. Both specs passed 140/140 alone, and the second full run passed 1734/1734.
- **Note:** open PR #518 also edits `package.json` (the `@playwright/test` pin). Whichever lands second rebases.
- **Integrated:** `96a6a979` on `fix/2.14.1`.

## 2026-11-21, integration correction

- `96a6a979` was missing the lockfile half of this plan. The lane's `pnpm-lock.yaml` had been reverted before the guard committed it, and the guard didn't notice. As a result, `pnpm install --frozen-lockfile` failed on the batch tip with `ERR_PNPM_OUTDATED_LOCKFILE`; plan 003's executor reported it.
- **Fixed in `3d748bf6`:** `pnpm install --lockfile-only` moved the `esm-env` 1.2.2 entry to the root importer's dependencies, the same 3-line change the executor made, and `--frozen-lockfile` passes again.
- From now on, the guard's merge step leaves out a lane's lockfile unless the plan owns it.
