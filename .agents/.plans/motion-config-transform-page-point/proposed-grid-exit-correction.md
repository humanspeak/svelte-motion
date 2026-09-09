# Proposed grid-exit correction — awaiting review

Reviewed source: `54ab016e`, 2026-09-09. No runtime/test changes made during diagnosis.

## Evidence

The user approved the axis-handoff visual behavior and requested resolution of the remaining verification item. The full 452-test suite stopped earlier: 17 passed, grid-exit last-card removal failed, 434 did not run. The handoff case was not reached. Command: `PW_REUSE_SERVER=1 npm exec --yes --package=pnpm@11.24.0 -- pnpm exec playwright test --reporter=line --max-failures=1 --trace=retain-on-failure`. Current preview/source identity was verified before reuse.

The trace establishes all three cards at ready, opacity1 and transform none before removal. Card A is stable at462.671875 for the pre-click frames; while the exit clone exists, A moves to459.78125 (2.890625px), then returns. The generated placeholder width is112.155px, versus the roughly110.2px slot seen on the review page; this is a sizing lead, not a proven complete root cause. `presence.ts` uses the cached lastRect when the original child is disconnected, and copies rect.width into the placeholder. Investigate stale/transformed snapshots and layout sizing before prescribing a fix.

Three unchanged focused repeats pass (14.6s). T3 real-click review, after settled Reset, captured134 frames including the exit clone: A movement0px; placeholder110.203px. Do not infer that passing repeats clear the failure or establish the cause. Full trace/screenshot retained at `/tmp/grid-exit-review-evidence/full-suite-trace.zip` and `full-suite-failure.png`; textual run evidence is co-located here.

## Proposed bounded work

Treat stationary survivors as the correct behavior. Preserve the existing <2px movement assertions and all full-suite gates. First build a deterministic RED regression for the measured placeholder-sizing failure. Only after establishing its mechanism, correct the relevant presence snapshot/placeholder logic and verify RED to GREEN.

Requested additional scope: `src/lib/utils/presence.ts`, `src/lib/utils/presence.spec.ts`, and `e2e/animate-presence/grid-exit.spec.ts` for focused regression/setup evidence. Existing whitelisted container integration may be examined, but no unrelated engine, projection, API, dependency, or demo changes. Stop if evidence requires a different boundary. Do not weaken the no-movement assertion, extend timeouts to hide a jump, skip the failing test, or label the full suite green from isolated repeats.

After executor correction: guard verifies focused presence/grid coverage, prior feature gates affected by any runtime changes, and resumes the full browser suite with the one-failure-at-a-time review workflow. The original axis-handoff automated failure remains unresolved until independently cleared; the user already passed its visual review.

## Review page

T3: http://127.0.0.1:4198/tests/animate-presence/grid-exit?@isPlaywright=true

Click Reset, then Remove last. C should fade away while A and B stay completely still throughout. Browser-only instructions are displayed; source page untouched.
