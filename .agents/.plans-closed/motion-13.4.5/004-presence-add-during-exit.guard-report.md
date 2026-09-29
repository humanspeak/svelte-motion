# Guard report — 004-presence-add-during-exit

**Recommendation: PASS** — characterization: 6/6 cases green (executor ×3 repeats, guard rerun), no src/lib change
**Reviewed at** 4c221667 · 2026-09-28 16:25 · **Plan planned at** 67815169
**Integrated** — committed on chore/motion-13.4.5; no PR mid-batch (batch convention: one branch → one PR after maintainer sign-off)

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| page + spec exist; 6/6 chromium | met | guard rerun 6 passed |
| e2e/animate-presence all pass | met | executor 79/79; guard ran focused spec only |
| only in-scope files | met | git show --stat 4c221667 |

## Spirit

Proves the #3856 React bug class doesn't apply to our clone-exit model across sync/popLayout and three add timings.

## Scope & conduct

- In-scope only: yes
- STOP conditions respected: yes (none fired)
- Plan amendments: none

## Residual risk / follow-ups

- Guard did not re-run the whole animate-presence directory; executor reported 79/79.
- Maintainer visual sign-off still required before PR.
