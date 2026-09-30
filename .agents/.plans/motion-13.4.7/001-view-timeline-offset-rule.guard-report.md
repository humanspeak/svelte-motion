# Guard report: 001 view-timeline-offset-rule

**Recommendation: PASS.** `useScroll` now uses Motion 13.4.7's offset rule. The red run was reproduced on the old code, and every gate is green on the integrated branch.
**Reviewed at** 95d95c04 · 2026-09-30 09:32 · **Plan planned at** ae938824 (no drift)
**Integrated**: cherry-picked onto `chore/upstream-delta-2026-09-30` as e93fcf03. No PR is opened mid-batch; plan 002 is still BLOCKED waiting for the npm publish.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `viewTimelineRange.ts` + spec exist; all upstream cases ported and passing | met | 22/22, matching upstream's 7 + 5 + 10 |
| Step 1 cases exist; `['start end','end start']` red before, green after | met | guard ran against 1fa52642's `scroll.svelte.ts`: 5 failed, including cover strings; with the change applied, 25/25 |
| No `VIEW_TIMELINE_PRESETS` / `matchesPreset` in `scroll.svelte.ts` | met | grep finds nothing |
| Not exported from `index.ts` | met | `grep -c viewTimelineRange src/lib/index.ts` returns 0 |
| `.changeset/use-transform-scroll-acceleration.md` (patch) | met | patch frontmatter present |
| `test:only`, `check`, `package`, consumer | met | 1072/1072; 0 errors; publint all good; 3/3 passed, both in the worktree and on the integrated branch |
| trunk no issues; only in-scope files | met | "No issues"; diffstat shows exactly the 5 files |
| README status row | met | updated by guard |

## Spirit

The goal was to stop our copied preset table from under-accelerating relative to Motion 13.4.7, and specifically to cover the common "while in view" offset `["start end", "end start"]`. It is now covered. The port is faithful down to upstream's quirks, and the upstream test suite is mirrored case for case. A future upstream change therefore shows up as a failing mirrored test. Every offset that accelerated before still does: the old presets are covered by the ported upstream "Enter/Exit/Any/All" cases.

## Scope & conduct

- In-scope only: yes.
- STOP conditions respected: none fired.
- Plan amendments: none.

## Residual risk / follow-ups

- Until plan 002 installs Motion 13.4.7, the newly accepted offsets get an `accelerate` config but run through 13.4.6's JS observation fallback. The result is visually correct, just not compositor-driven. Ship 001 and 002 together.
- `useScroll` behavior tests use `as unknown as` casts for offsets outside our narrow public `ScrollOffset` type. Widening that type is a separate, out-of-scope decision.
