# Guard log: plan 004 (animation-control subscribers in a plain `Set`)

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-004`. No STOP conditions fired.
- **Red reproduced by the guard:** with `animationControls.svelte.ts` reverted, `vitest run src/lib/utils/animationControls.svelte.spec.ts` → 4 failed, each with `expected 2 to be 1` (the effect ran twice).
- **Green reproduced:** that spec plus `animationControls.spec.ts` → 8/8.
- **Diff read in full:** the import is removed, `new SvelteSet` becomes `new Set`, and a three-line upstream comment plus a scoped `eslint-disable-next-line` are added. `subscribers` is private to the closure, so no caller depended on its reactivity.
- **Executor-reported, not re-run:** `pnpm test:only` 1736 passed, `pnpm check` 0 errors, `pnpm build` ok, `e2e/utilities/animation-controls.spec.ts` 13/13 on port 4214, Trunk clean.
- **Integrated:** `14dfc544` on `fix/2.14.1`.
