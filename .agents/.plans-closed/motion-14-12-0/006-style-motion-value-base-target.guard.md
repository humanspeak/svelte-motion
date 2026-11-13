# Guard log: plan 006 (style motion value base target)

- **Executor**: Claude Opus 5.5, harness worktree `t3/style-motion-value-base-target`, cut from `7329e0fa`.
- **Guard**: session agent, 2026-11-12.
- **Commits judged**: `5aced046`, `ff15b87c`.

## Final pass

| Done criterion | Reproduced by guard | Result |
| --- | --- | --- |
| New spec passes; tests 1, 2, 4 red before the fix | 5/5 inside the full unit run. Red state not re-run by guard; the executor reported tests 1-4 red (`expected 0.5 to be 1`, `expected 100 to be 20`). | PASS |
| `pinch.spec.ts` → 23 passed | Guard saw 3 failed / 20 passed before the merge and 0 failures after | PASS |
| `pnpm test:only` → 0 failures | 122 files, 1711 tests passed | PASS |
| `pnpm check` → 0 errors | 0 errors, 36 warnings | PASS |
| `pnpm build` | Not re-run by guard; executor reported exit 0 | executor's run |
| Full chromium e2e | Not re-run in full. Executor: 949 passed, 1 failed, 2 skipped, on the pre-amend commit. See below. | PASS with note |
| Only in-scope files | `git diff --stat 7329e0fa..ff15b87c`: probe, spec, `_MotionContainer.svelte` (one 24-line hunk in `createNodes`), changeset | PASS |
| `style: styleProp` count unchanged | 4 before, 4 after | PASS |

## The one e2e failure

`e2e/animate-presence/pop-layout-container-move.spec.ts:282` ("exiting item holds after two adds (fixed, transform-centred container)") failed once in the executor's full run and intermittently under `--repeat-each` both with and without the fix (3 of 10 vs 1 of 10).

Guard's finding: the test page (`src/routes/tests/animate-presence/pop-layout-container-move/+page.svelte`) binds no style motion value, so the new loop iterates over nothing on that page and cannot change its behaviour. The whole spec passed 35/35 in guard's run on the merged branch. Treated as an existing intermittent failure, not caused by this plan. It should be looked at separately.

## Fix as landed

After the late-node reset in `createNodes`, the node's own scraper runs over `{ style }`; each motion-value key with no `baseTarget` entry gets `setBaseTarget(key, value.get())`. `latestValues` is not written, `update` is not moved, and style is still omitted from the creation props. `baseTarget` is read through a cast because motion-dom marks it `@internal`.

## Deviations

- Plan text cited `getBaseTarget`; at v14.12.0 the fallback lives in `animateChanges`. The executor followed the code, not the plan's wording. Accepted.
- The fix commit was amended once before handback (rephrasing only); the full e2e ran on the pre-amend version. Unit tests, check and lint were re-run on the final one.

## Noted, out of scope

With `initial` set, upstream moves a style motion value to the `initial` value at mount; ours leaves it. Not addressed here.

## Verdict

PASS. Fast-forwarded onto `feat/motion-14.12.0` at `ff15b87c`.
