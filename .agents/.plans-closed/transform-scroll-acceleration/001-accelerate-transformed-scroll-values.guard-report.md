# Guard report: 001 accelerate-transformed-scroll-values

**Recommendation: PASS.** `useTransform` now propagates acceleration with upstream's post-#3857 shape. Every criterion was reproduced, and the #3857 regression is now pinned by a mutation-verified e2e.
**Reviewed at** e0b8200a · 2026-09-30 07:42 · **Plan planned at** 5e9d04a0 (amended twice on 2026-09-30; no in-scope source drift)
**Integrated**: cherry-picked onto `chore/upstream-delta-2026-09-30` as 4cf008fd (feat), 023d2174 (plan amendment), and 4158073b (test), at the operator's request. No PR was opened. The operator decides on the PR.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `propagateAccelerate` has a definition plus 2 call sites | met | `grep -c` returns 3 (`transform.svelte.ts`) |
| transform spec passes, including 10 new cases | met | 40/40 (transform + scroll specs) |
| `pnpm test:only` exits 0 | met | 1039/1039, both in the worktree and on the integrated branch |
| `pnpm check` 0 errors | met | 0 errors, 33 pre-existing warnings |
| `pnpm package` exits 0 | met | publint "All good!" |
| `trunk check` no new issues | met | "No issues" on all changed files |
| e2e spec exists and passes on chromium | met | 4/4 (+ will-change 5/5), with ScrollTimeline present, so nothing skipped |
| `+page.svelte` links the new page | met | `src/routes/+page.svelte` new `<li>` after useWillChange |
| Changes only in scope | met | 7 files, all on the in-scope list |
| README status row updated | met | updated by guard |

Additional guard evidence: with the #3857 padding removed, the amended test 3 fails on the keyframes assertion (offsets 0 and 1 missing). It passes again on the real code.

## Spirit

The goal was for scroll fades built with `useTransform(scrollYProgress, …)` to run as native ScrollTimeline animations, as they do in framer-motion, without shipping the partial-range bug upstream just fixed. That is delivered. The e2e confirms a real `ScrollTimeline` animation on the element with padded keyframes. The page's "Block main thread" button demonstrates the compositor-driven behavior to a human tester. Descending and out-of-range inputs, which would make `element.animate()` throw in upstream, stay safely on the JS path (the no-page-errors test covers this).

## Scope & conduct

- In-scope only: yes.
- STOP conditions respected: yes. The first dispatch correctly stopped on the missing plan file (a harness worktree-base issue).
- Plan amendments: (1) pre-flight: run worktree e2e without `PW_REUSE_SERVER`; (2) after execution: pin `getKeyframes()` because computed opacity can't see missing padding here. Both are plan defects, and neither weakens the plan.

## Residual risk / follow-ups

- **New finding (out of scope, needs its own investigation):** while a value is WAAPI-accelerated, `_MotionContainer` still writes the element's inline `opacity` in JS on every scroll. Probe: inline `"0.2"` became `"1"` at the bottom while the native animation ran. The visual result is correct, and the compositor keeps animating while the main thread is blocked. But the main-thread style work that acceleration should remove still happens. Upstream leaves inline stale, which is why #3857 was visible there. This probably also affects raw `scrollYProgress` bindings (not verified).
- The guided test page (`/tests/use-transform/scroll-accelerate`) has not had a human sign-off yet.
- The docs example page under `docs/src/routes/examples/` was deferred by the plan.
- The descending-range `element.animate()` throw is an upstream bug worth reporting to motiondivision/motion.
