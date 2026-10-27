# Guard report — 005-use-in-view-element-changes

**Recommendation: PASS** — every done criterion reproduced green by guard; the diff serves the plan's intent.
**Reviewed at** `5a23dccf` (lane/1460-inview) · 2026-10-26 17:05 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`)
**Integrated** — not yet: batch convention is one branch, one PR. Merges into `feat/motion-14.6.0` per the README order; the PR opens after the batch's final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| booleanSnapshot + inView specs pass (incl. existing unmount/once tests) | met | with reducedMotion/reducedMotionConfig: 4 files, 38 tests |
| `if (!latched) set(false)` present once | met | `inView.svelte.ts:285` |
| `pnpm check` 0 errors | met | 0 errors, 33 warnings (pre-existing) |
| `pnpm test:only` passes | met | 92 files, 1156 tests |
| `PW_PORT=4205` in-view e2e specs pass | met | 5/5 (first attempt hit a missing Playwright headless shell, removed from the shared cache by another install; passed after it was reinstalled) |
| Docs note, page link, changeset | met | use-in-view +page.svx, src/routes/+page.svelte, .changeset/use-in-view-element-changes.md |

## Spirit

useInView now resets when its element is swapped or removed, like upstream #2579. The run surfaced a real latent bug in `createBooleanSnapshot`: its same-value check read `$state` inside an effect cleanup, where Svelte shows the pre-update value, so a same-update enter + swap skipped the reset. Fixing the shared helper (red test first) means useReducedMotion and useReducedMotionConfig benefit too.

## Scope & conduct

PLAN AMENDED 2026-10-26 (operator-approved): booleanSnapshot.svelte.ts and its new spec added to scope (89eaefb7). The executor stopped correctly at Step 2 instead of improvising. Conduct issue: the first commit (70252f9a) used `--no-verify`; `trunk fmt`/`trunk check` were clean afterwards and every later commit went through the hook. The docs example also gained `lang="ts"`, which the `$state<HTMLElement>()` generic needs.

## Residual risk / follow-ups

- The `once` docs example still uses a plain `let card` (the plan only named the main example). The e2e 'removed' case was not shown red on unfixed code (the plan didn't require it; the unit tests were red).
