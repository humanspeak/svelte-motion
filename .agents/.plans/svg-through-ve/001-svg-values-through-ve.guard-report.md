# Guard report — svg-through-ve 001

**Recommendation: PASS** — SVG attributes and path drawing now render through
the SVGVisualElement; the one spec change was operator-ruled and the executor
strengthened the ruled probe with a red-first vacuity proof.
**Reviewed at** `c7f8a18` · 2026-07-25 15:38 · **Plan planned at** `f183b74`
(re-stamped post-squash; original authoring at `4758dcd` on the merged branch)
**Integrated** — no PR yet; operator sign-off policy applies (live demo before
push/PR). Branch `svg-through-ve`, not pushed.

## Done criteria

| Criterion                                        | Result | Evidence (guard-reproduced)                                                                                                                                                                                                                       |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` exits 0                             | met    | 0 errors (executor; hooks green on all landed commits)                                                                                                                                                                                            |
| `trunk check` no new issues                      | met    | pre-commit green on every landed commit; one executor-introduced lint issue fixed before landing                                                                                                                                                  |
| `pnpm test:only` exits 0                         | met    | **799 passed** (guard re-run; 813 → 799 is the audited coverage shift: −166 lines of `svg.spec.ts` white-box tests deleted WITH their subjects, +107 lines of `visualElementCore.spec.ts` behavioral coverage incl. the `"0.25 1"` dasharray pin) |
| Three-suite gate exits 0                         | met    | executor: 100 passed / 1 skipped; guard re-run of `e2e/svg` + `svg-path-length` + `vanilla-values`: **30 passed / 1 skipped / 0 failed** (the skip is the file's pre-existing pathOffset `test.skip`)                                             |
| `svgEffect(` gone from container                 | met    | grep 0 matches                                                                                                                                                                                                                                    |
| `transformSVGPathProperties` gone from container | met    | grep 0 matches; helpers deleted (−215 lines `svg.ts`)                                                                                                                                                                                             |
| `svgEffect` still publicly exported              | met    | `index.ts:45`, `effects.ts:81` untouched                                                                                                                                                                                                          |
| SSR pin unchanged                                | met    | 4 passed, no snapshot changes                                                                                                                                                                                                                     |
| README status row updated                        | met    | 001 → DONE (`c7f8a18`)                                                                                                                                                                                                                            |

## Spirit

Delivered, including the part that needed a human call. The migration hit a
genuine architectural fork (motion-dom has no style-routing hook; upstream
writes presentation attributes), the executor STOPped with a measured
side-branch attempt instead of improvising, and the OPERATOR ruled for the
upstream channel with one authorized spec change. The executor then found the
ruled probe vacuous — Svelte's spread diffs values, so a tracking-but-equal
recomputation writes nothing — PROVED it (untrack removed → ruled probe still
passes), and landed a stronger writer-count probe that fails on the broken
build. Deviation-in-service-of-intent, documented in-test with the measured
numbers, ruled-probe retained and labeled non-load-bearing: approved. The
pathLength STOP never fired because our semantics matched upstream
`buildSVGPath` exactly (now pinned by a unit test). Net: `svg.ts` −215 lines,
both conversion call sites gone, and **drag is the only writer left outside
the VisualElement**.

## Scope & conduct

- In-scope only: yes — `effects.ts` (public `svgEffect`) provably untouched;
  the spec file changed within the one-assertion grant (plus its own
  now-accurate comments).
- STOP conditions respected: yes — one STOP, correctly taken, with a
  preserved attempt branch (`svg-through-ve-step2-attempt` @ `2239321`)
  that made the ruling cheap.
- Red-first where behavior changed: the strengthened probe was verified to
  FAIL on a deliberately-broken build before landing; the stale-preview
  trap (reused 4198 server masking a red run) was caught and disclosed —
  kill the port before any 4198 measurement (now a known operational rule).
- `--no-verify` used only on explicitly-labeled wip checkpoints; every
  landed commit passed the full pre-commit.
- Documented behavior change (operator-accepted): bound SVG values moved
  from inline style to presentation attributes — they now lose to author
  CSS where inline style used to win, matching React framer-motion.
  Recorded in `432a558`'s commit message.

## Residual risk / follow-ups

- **Docs-only pass needed on `e2e/svg/motion-value-attributes.spec.ts`**:
  the file header and two test NAMES still describe the old style channel
  ("`cx cy r … -> element.style`"); those tests pass legitimately but the
  prose misdescribes the system. Deliberately not touched (scope
  discipline — the grant was one assertion). Recorded in the batch README.
- The cascade change is user-visible in the narrow author-CSS case;
  release notes for the next version should mention it.
- Batch complete: this was the batch's only plan. Remaining backlog:
  `drag-single-writer/` (5 plans) and `clone-exit-migration/` (spike).

## Post-close addendum (2026-07-25) — Codex adversarial review + operator ruling

A Codex adversarial review flagged that MotionValue `attrX`/`attrY`/`attrScale`
on a root `<motion.svg>` freeze (the renderer's root-svg early return drops
them). Guard verified: mechanism correct, headline overstated — `x`/`y` still
animate (as CSS transforms, upstream semantics); only explicit `attr*` on the
root `<svg>` tag freeze, and React framer-motion has the identical limitation
(same `buildSVGAttrs`). **Operator ruling: PARITY** — keep upstream behavior
until the library is 1:1, then enhance. Actions taken: issue #456 tracks the
post-1.x enhancement; `e2e/svg/nested-svg.spec.ts` + fixture pin BOTH facts
(x-as-transform live; attrX no-op, annotated to flip when #456 lands); the
docs guide gained an amber limitation callout; the motion-value-attributes
fixture's stale channel prose was corrected in the same pass.
