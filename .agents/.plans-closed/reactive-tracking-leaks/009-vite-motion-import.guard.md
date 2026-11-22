# Guard log: plan 009 (the Vite optimizer keeps the `motion` import)

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-009`. No STOP conditions fired.
- **Red reproduced by the guard:** with `src/lib/vite.ts` reverted, `vitest run src/lib/vite.spec.ts` failed the 5 predicted tests (template expression, original import with other names, `svelte:component`/`@const`, non-tag script member, HTML/CSS comment). The fix was then restored.
- **Green reproduced:** `vitest run src/lib/vite.spec.ts src/lib/html/componentNames.spec.ts` → 33/33.
- **Executor-reported, not re-run:** `pnpm test:only` 1738 passed, `pnpm check` 0 errors, `pnpm build` ok, Trunk clean, `git diff --check` clean.
- **Diff read in full.** It moves the two rewrite blocks ahead of the import decision unchanged, and adds the `hasMotionReference` helper with JSDoc. It also removes `MOTION_TEMPLATE_CLOSE_RE`, which became unused; that's in scope, and Trunk flagged it.
- **Accepted deviations:**
  - The dry run flipped 14 docs demos from keeping the import to dropping it, not the 3 the plan predicted. In every case the only extra `motion` mention is in a JS or CSS comment, which the plan strips on purpose, so dropping the import there is correct. No file flipped from dropping to keeping.
  - `grep -c hasMotionReference` prints 3: the JSDoc `@example` that Step 2 requires is the third hit.
- **Follow-up, not planned:** rewrite template-expression `motion.<tag>` references to the direct component, so pages that use them can drop the barrel import too.
- **Integrated:** `04a74f50` on `fix/2.14.1`.
