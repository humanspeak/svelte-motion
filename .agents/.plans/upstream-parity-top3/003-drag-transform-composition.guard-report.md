# Guard report — 003 drag-transform-composition

**Recommendation: PASS** — every done criterion reproduced green, the three
characterization tests confirmed red without the fix, and the diff delivers the
plan's intent through motion-dom's own `buildTransform`, exactly as prescribed.
**Reviewed at** `c3525d0` · 2026-07-10 11:44 · **Plan planned at** `634983b`
**Integrated** — PR <https://github.com/humanspeak/svelte-motion/pull/446>
opened via the `pr` skill for the reviewed snapshot `c3525d0`. Publication was
initially withheld per the plan's Git workflow ("Do NOT push or open a PR;
maintainer signs off on live demos first"); the maintainer drove the live demo
at `/tests/drag/while-drag-transforms` and signed off on 2026-07-10, after
which the PR was opened.

## Done criteria

| Criterion                                                        | Result | Evidence                                                                                                                  |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` exits 0                                             | met    | Reproduced: `COMPLETED 1018 FILES 0 ERRORS 32 WARNINGS` (warnings pre-existing, in unrelated routes)                      |
| `pnpm test` exits 0 with new unit cases                          | met    | Reproduced: 66 files / 759 tests passed; new cases at `drag.spec.ts:30-68`, `hover.spec.ts:219-252`                       |
| Playwright `e2e/drag e2e/reorder` exits 0 incl. 3 new char tests | met    | Reproduced: 76 passed / 1 skipped (2.9m), exit 0; `siblings-flip` (#379 gate) green                                       |
| Char tests genuinely characterize (Step 1 verify)                | met    | Red-verified: with `e0a88c7` source restored, exactly the 3 tests FAIL (rotation→0, y-drift, m23 lost); 1 nav test passes |
| `grep "only updates \`origin\`" drag.ts` returns no match        | met    | Reproduced: grep exit 1; deferral comment replaced by cross-axis rationale at `drag.ts:777-783`                           |
| `git status` clean outside in-scope list                         | met    | Tree fully clean at `c3525d0`; `git diff HEAD` empty after review                                                         |
| Batch README status row updated                                  | met    | README row 003 → DONE with gate results (`README.md:20,49-55`)                                                            |

## Spirit

The plan's north star was to stop the drag composer from clobbering every
transform channel it didn't own, and the diff delivers precisely that: a single
writer (`transformComposer.ts:22-35`) built on motion-dom's `buildTransform` —
the plan's preferred option over reimplementation — now composes drag
translation, whileDrag channels (each animated as its own MotionValue,
subscribed so the composer never reads the DOM, matching Step 2's preference),
cross-axis projection compensation (`drag.ts:781-786`, painting what
`adjustOrigin` previously only bookkept), authored style channels, and a live
`transformTemplate` (threaded through `_MotionContainer.svelte:1628`, replacing
the static-output-only path the plan called out). The hover partial rebuild —
the same disease in `hover.ts` — was routed through the identical writer rather
than left as a second implementation. Both preserved behaviors the plan fenced
off are demonstrably intact: the #379 sync/microtask/rAF write survives
(`drag.ts:634-642`, siblings-flip e2e green) and the #421 dual-write plus
empty-write guard survives (`drag.ts:592-593,616-624`, unit test
`drag.spec.ts:47-68`). No gap between letter and intent found.

## Scope & conduct

- In-scope only? Yes, with two intent-faithful deviations: (1) the hover fix
  landed in `hover.ts`/`hover.spec.ts` — the plan misnamed the file as
  `interaction.ts`, which contains no transform rebuild (plan defect, moot
  post-execution); (2) the shared writer is a new module
  `src/lib/utils/transformComposer.ts` rather than living inside `drag.ts` —
  required for hover reuse (Step 4) and aligned with the maintenance note to
  keep the writer's API small for Plan 004. `projection.ts` /
  `motionDomProjection.ts` untouched — the Plan 004 boundary held.
- STOP conditions respected? Yes. Char tests failed as predicted (red-verified
  by guard); `buildTransform` imported from motion-dom (no duplication clause
  triggered); no projection-path modification; siblings-flip never regressed.
- Plan amendments during execution: none. Plan file untouched by the executor
  (no tampering).

## Residual risk / follow-ups

- `transformComposer.ts` coverage is 66% statements — `splitGestureTransformValues`
  (lines 59-66) is exercised only indirectly via drag/hover paths; a dedicated
  spec file would be cheap insurance given Plan 004 will build on this seam.
- `addPixelOffset` (`drag.ts:420-431`) falls back to `calc()` for non-px
  authored x/y (e.g. `x: '10%'`); correct CSS, but untested — worth a case if
  percentage translations show up in issues.
- Restore-path generation guard (`drag.ts:817-830`) is new logic for rapid
  drag→release→drag cycles; the while-drag-restore e2e covers the common case,
  not the race.
- Plan 004 dependency is now unblocked: the writer's values-map is the seam it
  expects (`crossAxisOffset` + `gestureTransformValues` feeding `setXYImmediate`).
- Maintainer live-demo sign-off and the PR/publication gate are resolved:
  PR #446 is open and recorded in the plan 003 close-out.
