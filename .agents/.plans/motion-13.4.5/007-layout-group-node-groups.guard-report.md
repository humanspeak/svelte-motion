# Guard report — 007-layout-group-node-groups

**Recommendation: PASS** — LayoutGroup owns a Motion-style node group; 14/17 parity cases green 3/3 on 13.4.5, remaining 3 are Plan 008 read counts (2) and a spec-port click issue (1); full e2e green
**Reviewed at** 4a69292c · 2026-09-29 04:23 · **Plan planned at** 67815169 (re-baselined 5f9abf50; amended 2026-09-29)
**Integrated** — committed on chore/motion-13.4.5; no PR mid-batch

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| "same as `true` in this implementation" gone | met | grep → none |
| no `::` in layoutGroup.context.ts | met | grep → none |
| parity green except annotated | met | 3 test.fail left: 2 → Plan 008, 1 → spec click semantics (documented) |
| unit / check / build / docs / full e2e | met | 986/986; 0 errors; executor build+docs ok; full e2e 495/0 failed |
| changeset; README + matrix | met | .changeset/layout-group-node-groups.md; README updated by guard |

## Spirit

Delivers upstream LayoutGroup semantics: shared node groups, separate groups for inherit="id"/false, unmount and exit fan-out, layoutId-only triggers. The button-snap the maintainer saw is gone (layout-group cases green). Ungrouped pages behave as before (full e2e green).

## Scope & conduct

- In scope, plus a new fixture page and a new subtree spec required by Steps 4b(d)/5 (disclosed). STOPs respected; mandatory checkpoint honored.

## Residual risk / follow-ups

- Plan 008 (release blocker): per-frame layoutId capture reads.
- Interrupt spec click semantics (follow-up dispatch).
- Presence placeholder mid-exit sibling jump (pre-existing; not upstream-faithful) — candidate follow-up.
- Subtree MutationObserver only on grouped elements; ungrouped layout parents with grouped descendants snapshot them only on reactive changes.
- New layout-group-presence page not linked from the index.
- Maintainer visual sign-off pending.
