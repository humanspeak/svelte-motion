# Guard log: 001 view-timeline-offset-rule

## Checkpoint 1 (2026-09-30 09:32): ON TRACK

95d95c04 (snapshot on feat/view-timeline-offset-rule) · final close-out

- Pre-flight: the plan's baseline `ae938824` was HEAD, so no amendment was needed. I committed the plans (1fa52642) and created the worktree `../svelte-motion-offset-rule` manually, as the dispatch-worktree memory says.
- Diff: exactly the 5 in-scope files. `viewTimelineRange.ts` is a 1:1 port of upstream `edge.ts`, `offset.ts`, the `All` preset, and `offset-to-range.ts` at v13.4.7, including the vw/vh branch and `toIntersection`'s `/v/u` rejection. `scroll.svelte.ts` drops the old table and imports the port. `canAccelerateScroll` and `ScrollOffset` are unchanged, and `index.ts` does not export the module.
- Red reproduced by the guard: the new spec run against `scroll.svelte.ts` from 1fa52642 failed 5 cases (cover strings, cover numeric, partial center edges, partial numeric, reversed All). `['start start','end end']` already passed, as the plan predicted.
- Green: scroll + viewTimelineRange specs 47/47. Ported upstream cases total 22, matching upstream's count (edge 7 + offset 5 + offset-to-range 10).
- Gates, in the worktree and again on `chore/upstream-delta-2026-09-30` after the cherry-pick (e93fcf03): `pnpm test:only` 1072/1072; `pnpm check` 0 errors (33 pre-existing warnings); `pnpm package` publint "All good!"; build plus consumer suite 3/3 passed (the tree-shaking guard stays green); trunk reports no issues.
- Executor note, verified: `pnpm check` shows consumer-fixture errors only when `dist/` is absent. This is pre-existing and ordering-dependent, not caused by this change.
- Action: PASS; integrated.
