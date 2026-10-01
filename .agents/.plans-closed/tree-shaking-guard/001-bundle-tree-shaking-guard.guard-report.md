# Guard report: 001 bundle-tree-shaking-guard

**Recommendation: PASS.** Every criterion was reproduced green, and the guard proved independently that the check fails on a real leak and names the offender.
**Reviewed at** 7d39fe5c · 2026-09-30 07:36 · **Plan planned at** 5e9d04a0 (plan committed at 261e9a0a; no in-scope drift)
**Integrated**: cherry-picked onto `chore/upstream-delta-2026-09-30` as 941f2640, at the operator's request ("bring them into this branch"). No PR was opened. The operator decides on the PR.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `verify-tree-shaking.mjs` and `src/TreeShakeOptimized.svelte` exist | met | `git diff --stat 261e9a0a..7d39fe5c` |
| `grep -n "verify-tree-shaking" tests/consumer-vite6/verify.mjs` returns 1 match | met | line 5: `import './verify-tree-shaking.mjs'` |
| `pnpm build && pnpm --filter …consumer-vite6 test` exits 0 and prints `Tree-shaking consumer checks passed.` | met | guard run: all 3 lines printed, 21 s |
| Step 4 deliberate breakage fails and names `arc` | met | guard run: `these exports pull in the motion component layer: arc`; passes again after rebuild |
| `pnpm check` 0 errors; `trunk check` no new issues | met | 0 errors / 33 pre-existing warnings; trunk "No issues" on the 3 files |
| No files outside the in-scope list | met | exactly 3 files, all in scope |
| README status row updated | met | updated by guard (the executor is not allowed to edit it) |

## Spirit

The plan exists so the tree-shaking docs page's promises can't silently rot. The check bundles through the real package `exports` map and asserts every promise: named exports, direct imports, and the Vite plugin. It also covers the whole non-component surface, derived automatically so new exports are covered without upkeep. Positive controls stop a broken marker from producing a false pass. On failure it names the offending export, so the failure can be acted on.

## Scope & conduct

- In-scope only: yes.
- STOP conditions respected: yes. The first dispatch correctly stopped on the missing plan file (a harness worktree-base issue, not the executor's fault).
- Plan amendments during execution: none.

## Residual risk / follow-ups

- The check runs only in CI's `unit-tests` job, after `pnpm build`. A local `pnpm test` does not run it.
- The fixture pins Vite 6.4.3. A move to Rolldown-based Vite needs the build recipe re-checked (see the plan's maintenance notes).
