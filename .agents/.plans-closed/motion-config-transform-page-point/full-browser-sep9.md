# Complete browser run — 2026-09-09

Tested HEAD `c01551b2`, unchanged source since `54ab016e`; matching production preview on4198 verified before reuse. No product, test, dependency, or release files changed in this run.

User direction: omit the `minor` PR label. This supersedes the earlier label request. No PR exists and no label was applied. Existing changeset metadata was not edited during this test-only request.

## Result

**439 passed, 10 failed, 1 flaky, 2 skipped; 452 tests total, 20.7 minutes.** The configured performance-test retries account for454 progress entries. No new retry policy, timeout increase, assertion change, or skip was added. Full browser verification remains failing.

Command:

```sh
PW_REUSE_SERVER=1 npm exec --yes --package=pnpm@11.24.0 -- pnpm exec playwright test --reporter=line --trace=retain-on-failure --output=/tmp/browser-pr-readiness-sep9-complete-results
```

The initial stop-first attempt failed on clone-fidelity opacityNaN. The complete run collected all results without stopping on the first failure; the repository's one-page-at-a-time workflow governs failure review and edits, not result collection. No new failure beyond the first was visually reviewed or modified.

## Interpretation and limits

- The exact earlier grid-exit **last-card** case passed; its **middle-card** case failed.
- The exact earlier axis-handoff **foreign retarget mid-glide** case passed; its **whileDrag release-glide** case failed.
- All11 drag transform-page-point cases and6 pan transform-page-point cases passed. These results do not establish that the full branch is regression-free.
- The first clone-fidelity test sampled opacity near the end of its450ms exit. It readNaN; the final failure DOM had removed the node and the exit count was1. T3 loaded this first review page. This points to a timing race; no test correction has been approved or made here.
- Machine load was unusually high early in the run: observed one-minute averages210.75 and296.74, falling to15.51 later. This can affect timing and performance checks; it does not prove that every failure is environmental or pre-existing.
- The earlier claim that there were only two verification items is superseded by this complete run. No baseline comparison, root-cause finding, or PASS is inferred for the newly collected failures.

## Failure summary

```text
  10 failed
    [chromium] › e2e/animate-presence/clone-fidelity.spec.ts:6:5 › AnimatePresence clone fidelity › PresenceChild runs a motion child exit on the real node 
    [chromium] › e2e/animate-presence/grid-exit.spec.ts:92:5 › AnimatePresence grid exit › middle card exit: survivors hold, then the right card slides into the gap 
    [chromium] › e2e/animate-presence/modes.spec.ts:114:5 › AnimatePresence modes › sync animates layout siblings when an entering child pushes them over 
    [chromium] › e2e/animate-presence/scroll-stress.spec.ts:335:5 › AnimatePresence scroll stress › anchors the exit clone to the original rect when hidden from a scrolled container 
    [chromium] › e2e/drag/axis-handoff.spec.ts:66:5 › drag/axis-handoff › whileDrag on the dragged axis does not cancel the release glide 
    [chromium] › e2e/drag/while-drag-transforms.spec.ts:144:5 › drag/whileDrag transform composition › release restores the authored rotate smoothly, without a settle-then-snap 
    [chromium] › e2e/motion/exit-animation.spec.ts:12:5 › AnimatePresence exit animation › animates out when toggled off with preserved shape 
    [chromium] › e2e/motion/svg-path-length.test.ts:4:5 › SVG pathLength Animation › animates pathLength 0→1 with normalized dash attributes and no flash 
    [chromium] › e2e/reorder/scrollable.spec.ts:122:5 › reorder/page-scroll › reorders exactly one slot with a non-zero window scroll 
    [chromium] › e2e/reorder/scrollable.spec.ts:152:5 › reorder/page-scroll › keeps positions consistent when the window scrolls mid-drag 
  1 flaky
    [chromium] › e2e/motion/ai-glow-border.spec.ts:68:5 › motion/ai-glow-border › frame budget: p95 < 25ms, no long frames after warmup 
  2 skipped
  439 passed (20.7m)
```

## Evidence and next review

Full text: `full-browser-sep9.log`. Per-failure traces and screenshots: `/tmp/browser-pr-readiness-sep9-complete-results/`. Original complete log: `/tmp/browser-pr-readiness-sep9-complete.log`.

First review page in T3: http://127.0.0.1:4198/tests/animate-presence/clone-fidelity?@isPlaywright=true

Toggle real node should fade/shrink the purple card, remove it, and increment the counter exactly once. Keep the suite result failing and the feature batch IN PROGRESS. No push, PR, runtime/test edits, or review waiver.
