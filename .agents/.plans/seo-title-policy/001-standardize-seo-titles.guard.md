# Guard log — 001 standardize SEO titles

## Checkpoint 1 — 2026-07-10 07:30 — ON TRACK

`faad407` · after Step 1, intentional pre-fix red baseline

- Source snapshot is in scope: `git diff --name-status c89a3d5...faad407` reports only `A docs/src/lib/seo-title-policy.spec.ts`; the scoped `31225de..faad407` drift check adds only that planned test file.
- Discovery is guarded: `docs/src/lib/seo-title-policy.spec.ts:43-56` asserts exactly 60 direct example detail pages and reports every expected route whose literal title cannot be extracted; the current inventory contains 63 literal-title pages, all represented by the three standalone paths plus 60 details.
- The intentional red baseline is faithful: bounded server Vitest exited 1 with 1 failed file, 2 failed tests, and 3 passed tests; diagnostics list exactly five over-budget titles and 59 legacy suffix violations, while 60-page discovery, examples-index exactness, and uniqueness pass.
- Assertions are substantive: budget diagnostics include route, actual length, and title at `docs/src/lib/seo-title-policy.spec.ts:58-66`; suffix diagnostics include every detail route and title at `docs/src/lib/seo-title-policy.spec.ts:69-79`; index exactness and complete-title uniqueness are asserted at `docs/src/lib/seo-title-policy.spec.ts:82-100`.
- Setup artifacts are acceptable at this checkpoint: `git status --ignored --short` shows only ignored dependency, Trunk, SvelteKit, build, and generated docs mirrors/manifests; no lockfile, configuration, generated mirror, or other tracked source changed. Raw Prettier use did not alter scope, and the snapshot hook independently completed formatting, lint, and Svelte checks.
- Action: reported ON TRACK to the operator. The executor may continue to Step 2, but raw Prettier is not a substitute for the plan's final `trunk fmt` and `trunk check`; a repeated required-command failure must follow the STOP condition.

## Checkpoint 2 — 2026-07-10 07:35 — VIOLATING

`61ae8bd` · Step 2 worktree-boundary incident; no isolated source snapshot needed

- Hard execution boundary crossed: the operator verified that a relative-path `apply_patch` resolved against primary checkout `/Users/jasonkummerl/Github/svelte-motion` on `docs/seo-title-policy-plan`, not the authorized isolated worktree, and changed 59 example title files there. Guard classifies reaching outside the assigned worktree as VIOLATING even though the intended title edits were in the plan's product-file scope.
- Impact was contained: the operator's audit found exactly 59 title-only files with 59 insertions and 60 deletions; the executor stopped on the first retry mismatch and self-reported, and the operator restored only those accidental hunks. No accidental commit was created.
- Authorized worktree is intact: `git rev-parse --show-toplevel` reports `/private/tmp/svelte-motion-seo-title-exec`; `git status --short --branch` is clean at `61ae8bd`, `git diff --name-status 61ae8bd` is empty, and the scoped `31225de..HEAD` drift check still contains only the planned Step 1 test.
- Action: reported VIOLATING to the operator. Recommend one constrained retry, not blocking execution: require absolute `/private/tmp/svelte-motion-seo-title-exec/...` paths for every patch and verify `git rev-parse --show-toplevel` plus `git status --short` before and after the edit. Any second wrong-checkout write should block execution.
