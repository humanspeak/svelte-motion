# Approved CI corrections — 2026-09-09

User authorization: “Ok please move forward... this is a bit frustrating as it felt like a non major change”. Baseline 8ea80dbd. PR481 runner34387214998: 445 passed, four failed, one flaky, two skipped. Unit/build/lint passed.

## Scope and sequence

1. RED first: add focused component coverage in src/lib/components/Reorder/reorder.component.spec.ts proving document scrolling does not activate from a page-space point when the real client pointer is away from an edge. Cover both axes if practical. Existing harness may gain narrowly necessary MotionConfig/onDrag props in src/lib/components/Reorder/__tests__/ReorderHarness.svelte. Keep real drag callbacks and autoScroll behavior; assert meaningful absence of scrolling, not implementation syntax. Guard runs this before runtime edits.
2. Fix src/lib/components/Reorder/Item.svelte: autoScrollIfNeeded requires client coordinates; select event.clientX/clientY rather than info.point. Preserve public transformed/page callback info and all reorder behavior. No autoScroll engine changes.
3. e2e/drag/controls.spec.ts repeated-initial-snap fixture: replace exact font-dependent button x/width with invariant center/hit/viewport geometry. Preserve tile initial geometry, three sessions, pointer metadata, exact movement and <=2px drift assertions.
4. e2e/drag/axis-handoff.spec.ts foreign-retarget case: diagnose second-drag zero using runner trace. Add valid hit preconditions and bounded frame-aware sampling while held, preserving original -70..-50 movement bounds and all retarget/callback assertions. Do not conceal a runtime defect behind a timeout. If zero persists with correct hit and processed frames, report mechanism before expanding runtime scope.

## Evidence

Reorder scrollable.spec.ts:122 expected alpha,gamma,beta,delta, received alpha,gamma,delta,beta twice. Retry trace shows scrollTop750 jumping to1376 after call30. Item passes info.point to autoScroll, whose geometry is explicitly client-space. New pan extracts pageX/pageY. The mid-scroll test also fails pitch tolerance with 2.904388427734375 >1.5.
Controls.spec.ts:161 expects macOS button x581.609375/width116.78125; Linux returns x582.640625/width114.71875. Both centers640,417. Failure is before dragging.
Axis-handoff.spec.ts:199 second drag expected <-50, got0. Retarget-to420 and callback assertions pass. Six pointer steps take24ms, read starts immediately after. Timing is provisional; inspect hit/frames. Retry screenshot includes selected text, so do not assume frame sampling is the only cause.
Artifacts: /tmp/pr481-runner-artifacts-shard1 and shard2. Logs: /tmp/pr481-runner-shard1.log and shard2.log.

## Gates

Preserve all existing verification gates and prior red/parity evidence. Run new red test, then focused Reorder units with bounded workers, normal commit formatting/lint/Svelte checks. Push corrected PR for full unit/browser/build CI; no full local browser suite. One focused browser investigation is permitted if necessary. Existing Reorder browser assertions remain unchanged. Do not alter flaky snap-to-origin test, dependencies, pnpm, public gesture semantics, projection engine, unrelated demos or pending grid proposal. No minor PR label. Do not merge.

## Additional guard diagnosis

The separate full hosted run34387232431 independently produced the same four failures,445 passed,one flaky,two skipped. Existing-source targeted browser probe at4198 confirmed a real pointer hit on foreign-retarget-card and x420 to360 for a60px held move, remaining360 after200ms. A second probe with deliberately selected label text also reached360. Thus text selection alone is not established as the failure mechanism; bounded frame sampling and explicit hit preconditions should be verified on CI without relaxing movement. Reorder is the only internal component consumer passing info.point to viewport geometry (rg audit). T3 reviewed page-scroll, controls and axis-handoff before edits.

## RED proof

Guard ran pinned pnpm exec vitest run --maxWorkers=1 src/lib/components/Reorder/reorder.component.spec.ts -t "does not auto-scroll document axes from page-space drag points away from viewport edges". Both cases failed at the intended scroll-state assertion: x1200 became6499.84; y900 became7194.92. Public page-point callback assertions passed. Duration9.84s; fourteen unrelated tests filtered. Log /tmp/pr481-reorder-red.log. Executor suggested --project client, but this repository has no client project; guard used the actual configuration.

## Follow-up: axis-handoff fixture CSS

Hosted run34390333107 at74df2413:913 units pass; browser448 pass,1 fail,1 flaky,2 skipped. Both Reorder scroll regressions and controls pass. Axis handoff fails its new active-drag precondition after5seconds; exact-card hit passes. Timing-only diagnosis is disproven. Three traced local repetitions pass, so no unverified runtime fix is authorized.

Read-only runtime review finds lock released, foreign release bookkeeping cleared, no expected reactive detach, completed retarget420. Concrete fixture defect: route .card/.card-a/.card-b/.card-c selectors are scoped but motion.div owns its internal DOM; compiled browser DOM lacks page scope class and CI warns these selectors unused. T3 confirms width154.125 height24 userSelect:auto touchAction:auto versus authored width118 height84 userSelect:none touchAction:none. Linux screenshots show selected text. This is a definite fixture defect; its causal relation to the remaining drag failure must be verified on CI.

Continue standing user authorization to fix these runner failures with this necessary fixture correction. Add only src/routes/tests/drag/axis-handoff/+page.svelte, changing the four child card selectors to page-scoped .lane :global(.card...) so intended rules reach internal elements. Preserve declarations, all gesture props and instructions. Add preconditions in e2e/drag/axis-handoff.spec.ts proving actual intended card geometry and interaction styles, retaining ALL original movement/retarget/callback assertions and current hit/frame checks. Do not add gesture-runtime changes or change thresholds. Run focused browser tests against a freshly built preview with one worker, then existing full hosted gates.

## Fixture verification

Snapshot91e1b1cf changes only route selectors and fixture assertions. Guard ran the new assertion against the known old preview: RED at authored card dimensions/styles (actual154.125x24 auto/auto). Rebuilt app/package from91e1b1cf; build and publint pass. Replaced only this worktree preview4198 with fresh output. All4 axis-handoff browser tests pass in8.1s, preserving original assertions. T3 screenshot confirms colored118x84 cards. Normal commit formatting/lint/Svelte checks pass. Logs /tmp/pr481-axis-fixture-red.log, /tmp/pr481-axis-fixture-build.log, /tmp/pr481-axis-fixture-green.log. Final Linux verification pending push.
