# Guard log — 004 projection-page-space-consolidation

## Checkpoint 0 — 2026-07-13 04:41 — ON TRACK

31b10ef · pre-flight baseline + executor dispatch; no executor work yet

- Dependency gate: Plan 003 marked **DONE** in batch README (2026-07-10 entry) — the plan's first STOP condition does not trigger.
- Drift check run: `git diff --stat 634983b..HEAD -- <in-scope files>` shows changes to `_MotionContainer.svelte` (+297/-148 net), `layout.ts`, `motionDomProjection.ts`. All attributable to Plan 003 (commit c3525d0), the declared dependency — anticipated drift, not a STOP.
- Anchor verification against live code: `wasViewportScrolledSinceLastLayout` present (now `_MotionContainer.svelte:2267-2354`, plan said ~2240-2310), `new ProjectionNode` at :362, `MotionDomProjectionAdapter` at :373, `measureLayoutRect` at :412, `adjustOrigin` at :2348, `computeFlipTransforms` call sites at :2201/:2359/:2398/:2463. All plan excerpts semantically intact; line numbers shifted ~+30-80.
- Executor dispatched: Opus 4.8 in an isolated worktree, instructed to `pnpm install` + `trunk install` first, red-first tests, human-drivable eye-test page, no commits/pushes/plan edits. Run gated at the plan's own spike checkpoint — Steps 1-2 only, report before migrating (plan line: "Do not skip the spike").
- Action: none needed; awaiting executor's Steps 1-2 checkpoint report.
- Note: this entry was first committed on `fix/drag-transform-composition` (073d9ff, main checkout); reproduced here verbatim so the plan branch carries the full log.

## Checkpoint 1 — 2026-07-13 05:08 — ON TRACK

b83713c + b33418d · after Steps 1-2 (characterization tests + spike); snapshot committed by guard, then judged

- Snapshot: guard committed the executor's uncommitted work as `b83713c` (test(projection): characterization spec + demo page + home-page link) and `b33418d` (docs(plans): spike findings + 004 status row). Tree clean after; executor made no commits itself, as instructed.
- Branch base: executor claimed it branched from `31b10ef`; actual base is `5a5dbe5` (main after PR #446 merged Plan 003). Substantively correct — the branch contains 003's work via the merge — claim inaccurate in detail only.
- Done-criteria checks reproduced by guard (not trusted from report):
    - `pnpm exec playwright test e2e/projection/scroll-during-layout.spec.ts` → **4 passed (26.3s)**. Case 2 is `test.fail()` — its "pass" is Playwright confirming the assertion genuinely fails today, i.e. the red-first evidence is structural: were the heuristic not snapping, the suite would error "expected to fail but passed".
    - Instrumentation removal: `grep -rn "spikeMark\|__projSpike\|SPIKE" src/ e2e/` → no matches; `git diff HEAD` empty.
    - Plan/guard file integrity: `git diff` on the plan + `*.guard*.md` → empty. No tampering.
    - README diff read in full: edits confined to the spike-findings section and plan 004's own status row (other rows changed only by table re-alignment). Within the plan's explicit allowance.
- Assertions read, not just run: spec samples computed `matrix()` translateY per frame; case 1 requires peak > 20px and ≥3 intermediate frames; case 3 pins swapped slot positions (`toBeCloseTo`), settled identity transform (< 2px), and no spurious replay during scroll-back (< 20px). Real assertions, not vacuous.
- Case 3 shipped as a PLAIN test, not `test.fail()`: plan-consistent — the plan marks case 3 expected-fail only "if today's behavior differs", and the executor verified empirically it does not. Reasoning documented in the spec header (e2e/projection/scroll-during-layout.spec.ts:19-26).
- Spike finding (material): motion-dom `commitObservedLayoutChange` is authoritative in only **1 of 5** flows. `layoutId` shared-element flows and size-corrected FLIP flows never touch it. Consequence: the plan's conditional scope item (`layoutId.ts` — "only if the spike shows shared-element routing is required") **resolves to IN SCOPE**, and size-correction replacement is named work. This is the outcome the plan pre-provisioned ("if it is nearly never taken, flag effort as larger") — informational gate, NOT a STOP; no plan amendment needed.
- Nits (no action required of executor yet; fold into a later step): spec header comment says boxes sit "below the fold" (e2e/projection/scroll-during-layout.spec.ts:6) — stale; the page places them above the fold and the case-1 comment + page comment say so correctly.
- Action: verdict ON TRACK reported to operator. Guard authorizes continuation to Steps 3-4 (page-space measurement + heuristic removal), next checkpoint after Step 4's full-suite gate. Guard log moves to the plan branch as canonical from this entry on.

## Checkpoint 2 — 2026-07-13 06:04 — ON TRACK

b8017e4 + aa6c5bc · after Steps 3-4 (page-space measurement + scroll-heuristic removal); snapshot committed by guard, then judged

- Process note: the executor first ended its turn "waiting" on a backgrounded full-suite run (nothing was actually running); guard resumed it with instructions to run the gate in the foreground. Corrected without incident; the interim ambiguous run (a truncated "311 passed" tail) was superseded by the authoritative enumerated run, disclosed by the executor unprompted.
- Snapshot: `b8017e4` (adapter `measurePageRect(phase)` + `updatePathScroll(phase)` + red-first unit spec) and `aa6c5bc` (container migration, heuristic deletion, flipped e2e, demo copy). Tree clean after; prior guard commits untouched (no rebase/amend).
- Done-criteria checks reproduced by guard on the snapshot:
    - `pnpm check` → 0 errors (32 pre-existing warnings). `pnpm test` → **762/762** across 67 files.
    - FULL `pnpm exec playwright test` → **340 passed / 2 skipped / 0 failed (8.6m)**, exit 0 — matches the executor's report; the 2 skips are the pre-existing ones from plan 002's close-out.
    - `grep -rn "wasViewportScrolledSinceLastLayout\|wasViewportOffscreenSinceLastLayout" src/` → no matches (done-criterion 3 already satisfied).
    - Plan/guard file integrity: `git diff -- .agents/` empty pre-snapshot. No tampering.
- Diffs read in full, judged faithful to the plan's letter and spirit:
    - Heuristic state, `rememberOffscreenScroll`, its `window` scroll listener, and the offscreen skip branch genuinely deleted (`_MotionContainer.svelte`, aa6c5bc). Presence-hold/placeholder early-outs and the drag `adjustOrigin` branch preserved as the plan requires; the presence-release skip keeps only `detail?.viewportScrolledDuringHold || isViewportOffscreen(viewportRect)` (presence.ts-owned semantics, out of scope) with a why-comment.
    - `measureLayoutRect(phase)` sources from `motionDomProjection.measurePageRect(phase)`; `$effect.pre` snapshot passes `'snapshot'` — the plan's phase-boundary requirement. Legacy `projection.measure()` retained solely as SSR fallback, as Step 3 specifies.
    - Case 2 flipped `test.fail()` → plain (the Step 4 gate); case 3's +900ms settle is a legitimate adjustment, not a weakened test — offscreen changes now animate (the plan's stated goal), assertions unchanged, and the invariant pinned is "no replay triggered BY scroll-back". Stale "below the fold" header fixed as guard requested.
    - Unit spec asserts the plan's exact Test-plan scenario (scrollY=500 element, identical page box across a 200px scroll between phases) with concrete values; executor confirmed red-first (3/3 TypeError before implementation).
- Documented deviation, ACCEPTED as bridge adaptation (not drift): `updatePathScroll` invalidates a same-phase scroll cache entry via `scroll.animationId = -1` because the observer bridge takes standalone reads where upstream's `animationId++` (in `startUpdate`) never fires. Adapter-local, JSDoc'd, covered by a dedicated same-phase-freshness unit test.
- Scope check: `layoutId.ts` and `layout.ts` untouched — consistent with guard's checkpoint-1 adjudication (touch only if a gate forces it; none did). All edits within the in-scope list.
- Carry-forward for close-out: `docs/src/routes/docs/layout-animations/+page.svx:95` ("viewport-relative coordinates") is now stale — the plan's Docs impact section requires updating `docs/layout-animations` before final. Flagged by the executor; guard will hold final on it.
- Action: verdict ON TRACK reported to operator. Guard authorizes Steps 5-6 (drag-pinning via didUpdate deltas; gated legacy-node retirement), next checkpoint at `guard final`.
