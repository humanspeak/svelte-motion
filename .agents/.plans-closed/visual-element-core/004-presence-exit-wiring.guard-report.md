# Guard report — 004 presence-exit-wiring

**Recommendation: PASS** — exit is now an animationState type driven by real
presence context; both inherited layout-button specs pass and the branch is
fully green for the first time since the writer swap.
**Reviewed at** `73a131f` · 2026-07-24 22:54 · **Plan planned at** `7eba0bd`
**Integrated** — no PR by operator policy (live-demo sign-off precedes any
push/PR); publication deferred to batch close-out.

## Done criteria

| Criterion                                                                                                                                | Result | Evidence (guard-reproduced)                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `pnpm check` exits 0                                                                                                                     | met    | `1056 FILES 0 ERRORS 33 WARNINGS`                                                                |
| `trunk check` no new issues                                                                                                              | met    | pre-commit hooks green on all four commits                                                       |
| `pnpm test:only` exits 0                                                                                                                 | met    | 851 passed (up from 844 — 7 new exit-feature specs)                                              |
| `pnpm test:e2e e2e/animate-presence e2e/motion e2e/variants` exits 0, INCLUDING the two inherited layout-button specs with no exclusions | met    | Guard re-run: **140 passed, 1 skipped, 0 failed** — `layout-button.spec.ts:424` and `:460` green |
| `setActive('exit')` present                                                                                                              | met    | `visualElementCore.ts:219,226` (feature); container key-change path                              |
| Clone path untouched (`git diff 7eba0bd..HEAD -- presence.ts` empty)                                                                     | met    | diffstat empty for `presence.ts` AND `AnimatePresence.svelte`                                    |
| No files outside in-scope list                                                                                                           | met    | 4 commits touch only `_MotionContainer.svelte`, `visualElementCore.ts`(+spec), plan docs         |
| README status row updated                                                                                                                | met    | 004 → DONE (`73a131f`)                                                                           |

Executor additionally ran the whole `e2e/` directory: 377 passed / 0 failed /
2 skipped (guard's 002 close-out had 375/2/2 — the delta is exactly the two
specs this plan owned).

## Spirit

Delivered, and precisely on the deviation boundary the plan drew: the
PresenceChild path speaks upstream's `PresenceContextProps` contract
(`ExitAnimationFeature` ported with the re-enter rewind and completion
reporting), the key-change exit runs through `setActive('exit')`, and the
clone-based exit for direct AnimatePresence children remains untouched as the
documented architectural deviation. A milestone fell out: with the bespoke
exit writer gone there is **no legacy `animate()` call left anywhere in
`_MotionContainer.svelte`** — every animation in the container now flows
through the VisualElement. The two root causes behind the inherited failures
(`blockInitialAnimation` never cleared after the first render; the rewind
reading the lifetime-pinned `effectiveInitialProp` instead of the live
`initialProp`) were diagnosed in-browser with measured state, matching
upstream's remount semantics rather than patching symptoms.

## Scope & conduct

- In-scope only: yes (diffstat-verified; clone path provably untouched).
- STOP conditions respected: yes; the baseline's third failure
  (`modes.spec.ts:46`) was correctly triaged as pre-existing flake
  (3/3 isolated passes; also passed guard's 002 full-directory run) rather
  than papered over or blamed on the plan.
- Plan amendments during execution: none this run (the plan carried one
  pre-execution guard revision assigning the two specs).
- Git hygiene: executor soft-reset only within its own commits and verified
  all guard checkpoints present before reporting (the revision-#9 rule).

## Residual risk / follow-ups

- **Fresh presence-context object per `ve.update()` is load-bearing**:
  `prevPresenceContext` is the flip detector; a shared object with a live
  `isPresent` getter breaks exit detection silently. Recorded for anyone
  extending the adapter.
- **TDZ ordering in `_MotionContainer.svelte`** (three incidents across
  plans 002/004): anything the VE-creation block calls must be declared
  above it. A follow-up lint or file-structure comment may be warranted.
- Direct AnimatePresence children still exit via clones — batch-close
  follow-up candidate (migrate onto PresenceChild + VE exit), alongside the
  Step-6 SVG item from 002.
- `modes.spec.ts:46` is flaky on sub-pixel margins (12.469 vs ≤11.869
  threshold) — candidate for tolerance review, NOT loosened during this
  batch.
