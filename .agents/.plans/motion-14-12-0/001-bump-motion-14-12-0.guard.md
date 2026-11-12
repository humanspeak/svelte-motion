# Guard log: plan 001 (bump Motion to 14.12.0)

- **Executor**: Claude Opus 5.5, harness worktree `t3/bump-motion-14-12-0`, cut from the wave-0 SHA `2b5d70c5`.
- **Guard**: session agent, 2026-11-12.
- **Commits judged**: `043382f6`, `029777d9`, `ec3565ab`.

## Final pass

| Done criterion | Reproduced by guard | Result |
| --- | --- | --- |
| Two `"14.12.0"` pins, version `2.11.0` | `grep -c '"14.12.0"' package.json` → 2; diff shows `2.10.1` → `2.11.0` | PASS |
| `pnpm check` → 0 errors | 0 errors, 34 warnings (all in files this plan did not touch) | PASS |
| `pnpm test:only` all pass | 119 files, 1669 tests passed; `springVelocity.spec.ts` 19/19 on three more runs | PASS |
| `pinch` runtime export and types block | read in the diff of `src/lib/index.ts` | PASS |
| Full chromium e2e, no new failures | Not re-run by guard. Executor reported 935 passed, 0 failed, 2 skipped. Guard read `test-results/.last-run.json` in the executor worktree at 10:02 (`"status": "passed"`, no failed tests); the run started after `ec3565ab` was committed (09:31). | PASS on the executor's run |
| Only in-scope files changed | `git diff --stat 2b5d70c5..ec3565ab` lists the seven in-scope files | PASS |
| Changeset exists | `.changeset/motion-14-12-0.md`, no plan references | PASS |
| `pnpm build` | exit 0, publint "All good!" | PASS |

## Red-first check

Guard ran the final spec against the main checkout while it still had Motion 14.10.1 installed: 9 failed, 10 passed. The failures are test 1 (three option sets), "starts with the inherited velocity" (three sets) and the three `visualDuration` cases of the `animate()` interrupt test. The `stiffness`/`damping` case and both duration guards pass. This matches the plan and the executor's report.

## Deviations

- **Timing harness** (`029777d9`). The plan's fake-rAF `beforeEach` does not reach motion-dom's frameloop, which captures `vitest.setup.ts`'s rAF mock at module load. The executor stubbed `performance.now` with a clock that advances 1000/60 ms per awaited frame and replaced `await animation` with a `finish()` helper. The assertions are the plan's. The change is confined to the new spec. Accepted.
- **One commit for the bump, the re-export, the allowlist and the changeset**. They must land together for the tripwire. Accepted.
- **Branch name** differs from the plan's `lane/14120-bump` because the harness cut the worktree. Dispatcher's choice.

## Integrity

No existing spec was edited. No plan, README or guard file was touched by the executor. No push, PR, label or stash.

## Verdict

PASS. Fast-forwarded onto `feat/motion-14.12.0` at `ec3565ab`.
