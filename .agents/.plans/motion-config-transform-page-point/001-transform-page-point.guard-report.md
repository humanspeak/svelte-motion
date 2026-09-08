# Guard report — 001 transform-page-point

**Recommendation: NO-PASS** — coordinate-contract approval is outstanding and five targeted browser tests fail.

**Reviewed at** `13ec152` · 2026-09-08 05:32 · **Plan planned at** `14046a5`

Implementation is preserved in the isolated feature worktree. No push, PR, merge, or plan closure occurred.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Step 1 demonstrated expected 40/received 20 before implementation, then passed. | met | Inspected actual historical executor command output: sole `expected 20 to be 40`, control passed; repeated after primitive gate. Guard current 903-test suite passes. |
| `coordinate-contract.md` contains pinned upstream references and numerical outcomes for the measurement probes and all initially pending integration cases; no unresolved supported-case mismatch. | FAIL | Contract evidence recorded, but transformed-scroll policy awaits approval and integration matrix remains incomplete. |
| Public callback and MotionConfig types compile, context inheritance/identity reset work, and the VisualElement receives the callback. | met | Config/public API assertions pass in guard full unit run; Svelte snapshot hook passed. |
| Drag history, callbacks, ref measurements, snap-to-cursor and inertia share corrected units; numeric bounds remain unchanged. | FAIL | Unit corrected velocity is 2000 local units/s, but drag nonuniform/resize browser failures remain; snap arithmetic concern lacks valid nonzero-scroll proof. |
| Pan start/move/end/cancel, threshold, velocity and agreed scroll cases pass; callback updates never detach an active session. | FAIL | Pan units/lifecycle tests pass, but page-scroll browser expected 80, received 60; deterministic pan-velocity coverage is missing. |
| Both new demo routes have passing e2e files and links from the test index. | FAIL | Both pages and links exist; 5 of 14 new browser tests fail. |
| Root check, full unit tests, full e2e, package validation, docs gates, `trunk fmt`, `trunk check`, and `git diff --check` meet the command-table expectations. Baseline blockers are reported, not relabeled as success. | FAIL | 903 units, source commit gates and app/package build passed. Targeted e2e fails; full e2e and changed-docs final checks deferred. Baseline docs failures recorded separately. |
| New public docs, example page, reusable demo, metadata, mirrors and minor changeset exist. | partial | New source docs/example/demo/metadata/minor changeset exist; executor generated mirrors, but changed-docs gates remain unreproduced by guard. |
| Existing no-config drag/pan/reorder/layout tests remain green without loosened assertions. | partial | Full unit regression suite passes without weakened existing assertions; full no-config browser regression suite not run. |
| Review `git diff --name-only` and `git diff --cached --name-only` against Scope; preserve the unrelated intel edit and exclude it from any commit. | met | 29 source/test/docs files fall within plan whitelist. Original intel edit preserved. Guard artifacts only additional files. |
| Batch README status updated accurately; no push/PR without separate authorization. | met | Batch marked BLOCKED accurately. No push or PR; no retirement of active plan. |

## Reproduced browser failures

Command: `npm exec --yes --package=pnpm@11.24.0 -- pnpm exec playwright test e2e/drag/transform-page-point.spec.ts e2e/motion/pan-transform-page-point.spec.ts --reporter=line`. Result: **9 passed, 5 failed**, 2.1 minutes. This was the targeted new-feature suite, not a full e2e run.

- `e2e/drag/transform-page-point.spec.ts:49`: nonuniform y displacement error 164.73625946044922 screen px; allowed at most 2. Failure screenshot shows a tall card and reported local y -113.19 after the positive-y drag. Runtime versus unsettled fixture geometry still needs diagnosis.
- Same file `:80`: left boundary after resize/re-grab differs by 7.57611083984375 px; allowed at most 2.
- Same file `:102`: held-pointer card center expected 298.3125, received 328.3125, a 30 px shift. The fixture shifts its parent with CSS `translate`, so verify a real layout displacement before inferring that projection runtime needs changes.
- `e2e/motion/pan-transform-page-point.spec.ts:37`: 60-second timeout clicking `pan-inherit`; Playwright reports the element is outside the viewport even after scrolling. This is a fixture/actionability failure, not evidence that inheritance math is wrong.
- Same file `:93`: after attempted window x scroll, expected offset 80, received 60. The test does not assert actual `window.scrollX`; prove scrolling occurred before changing runtime.

The scrolled snap test passed, but it never asserts that page scroll remains nonzero after `scrollIntoViewIfNeeded`. Therefore it does not settle the known source-level mixed-domain concern at `src/lib/utils/drag.ts:1145`. A green assertion under an unverified scroll precondition is insufficient evidence.

## Spirit

The draft carries the feature end-to-end and demonstrates corrected units in unit tests, but the intended pointer-accurate scaled interaction is not yet proven in real browser conditions. The plan also overconstrains compatibility: installed Motion 13.2.0 mixes scroll domains, while the requested behavior requires consistent corrected units. The proposed amendment makes that difference explicit rather than lowering the behavior/test standard.

## Scope & conduct

- Source contribution: `git diff a79033e...13ec152`; source drift: scoped `git diff 14046a5..13ec152`. Read the runtime, tests, fixtures, docs and metadata changes. All 29 source/test/docs paths are whitelisted. No production projection, dependencies, workflows, or original intel changes.
- The executor advanced into docs before the upstream discrepancy was surfaced, then stopped on the guard evidence. It did not edit its own plan. The wrapper was interrupted; the nested executor's completed STOPPED report was recovered and preserved verbatim.
- Plan preflight revision only: baseline main v1.2.0 and host/executor tool responsibilities. No semantic amendment approved. The current proposed amendment remains explicitly unapproved.
- The original snapshot attempts failed lint, then test TypeScript checks. Two fresh Codex fixes addressed only the duplicate import and optional last-call type accesses. Final snapshot hooks passed without bypasses.
- Guard full unit command: `npm exec --yes --package=pnpm@11.24.0 -- pnpm test:only`, 82 files / 903 tests passed. App build/package validation passed during Playwright server startup (`publint: All good!`).
- Existing docs baseline check: five errors/13 warnings in unchanged examples; baseline docs build exit 0 and SEO metadata 5/5. Changed-docs final validation remains pending.
- No live in-app browser was connected. Repository Playwright ran; the first failure screenshot was inspected. No claimed live visual review.

## To reach PASS

Approve or revise [the proposed coordinate-contract amendment](proposed-amendment.md), then resume through a separate executor. Preserve the original red proof; add a valid scrolled-axis regression before snap correction. Diagnose/fix the five browser failures with actual scroll/layout readiness preconditions, add deterministic pan-velocity evidence, finish the integration matrix and docs checks, then run all remaining original gates. If projection runtime changes become necessary, stop for a separate scope decision.

Logs: `/tmp/transform-page-point-guard-unit.log`, `/tmp/transform-page-point-guard-browser.log`; failure screenshots/error contexts remain in this worktree's ignored `test-results/`. Full executor report and coordinate evidence are co-located with this report.
