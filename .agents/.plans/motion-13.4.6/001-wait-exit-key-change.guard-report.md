# Guard report — 001 wait-exit-key-change

**Recommendation: PASS** — completion-driven latest-key behavior characterized; reset-generation false positive fixed with meaningful red/green evidence.

**Reviewed at** `cd900593` · 2026-09-29 18:54 · **Plan planned at** `c48fa24f` (source baseline07a1b1ae).

No PR opened: dispatch requires batch completion and a later explicit PR request. User retracted the unrelated skip-publish label instruction.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| New route and root link exist; tests cover object and variant completion-driven 0→1→2 plus reset behavior. | met | Full three-file diff read; immutable source-generation evidence asserted in both forms |
| Focused Chromium tests pass three repeats, proving final key 2, full visibility, cleanup and stability. | met | Independent12/12; `/tmp/motion1346-001-guard-final-browser.log` |
| Neighbor browser command passes unchanged tests. | met | Independent12/12; `/tmp/motion1346-001-guard-neighbor.log` |
| `pnpm build`, `pnpm check`, and `pnpm test:only` pass. | met | Independent Playwright production build includes package/publint; final snapshot commit root-check hook exit0; independent86unit files/1,029tests; route/spec-only correction does not affect Vitest inputs |
| Scoped `trunk check` and `git diff --check` pass; executor ran scoped `trunk fmt`. | met | Independent Trunk3files/noissues; diff0; executor format and normal commit formatting hooks |
| No source changes outside the three scoped files; library runtime and dependency versions unchanged. | met | Snapshot diffs and empty07a1b1ae→HEAD diff for src/lib/package/lock/changeset |
| Conductor records independent evidence and updates README status. | met | This report/log and DONE index row |

## Spirit

The scenario now proves a callback at exit completion supersedes the pending child and leaves only the newest child visible, for both object and variant forms. Reset cannot make the scenario pass using a canceled run's callback. Guard rejected a telemetry-only red and inspected the actual old-generation acceptance failure before approving the restored guard. The runtime remained unchanged because no adapter defect was reproduced.

## Scope & conduct

- Only scoped route, test and root link changed. No runtime/dependency edits.
- One correction round addressed a real fixture defect; executor did not edit plans or silently widen scope.
- Environment-only plan amendment documented actual native launcher constraints. Frozen install restored the exact locked docs dependency without tracked dependency mutations.
- Meaningful red was executed by Sol; guard independently reproduced green gates and inspected the red output. No claim of independent red execution.

## Residual risk / follow-ups

- Clone-path aggregate onExitComplete is an explicit Svelte adaptation, not React's outgoing element callback or concurrent React scheduling.
- Full browser suite and unrelated security/architecture review were not performed; focused and neighboring Chromium gates cover this change.
- Existing33root Svelte warnings remain. Continue with plan002 before closing batch.
