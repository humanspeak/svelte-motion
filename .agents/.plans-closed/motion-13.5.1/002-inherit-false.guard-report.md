# Guard report: 002 inherit-false

**Recommendation: PASS, awaiting operator eye test.** `inherit={false}` now stops an element and its descendants from following parent variants (labels and gestures), matching Motion 13.5.1.
**Reviewed at** 46dea41b · 2026-10-02 12:28 · **Integrated** as 11ba3cfc. No PR yet.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Page, spec, link; 4 ported scenarios + control; red recorded | met | 5/5; red 4 failed (0.2 vs 0.5) |
| `inherit?: boolean` typed; docs; changeset | met | types.ts JSDoc; variants docs subsection; variants-inherit-false changeset |
| e2e variants + presence; units; check; package | met | 146 (worktree); full 577/2/0 integrated; 1104; 0 errors; All good |

**Plan amendment (defect):** `inherit` had to be forwarded to the VisualElement. Mutation probes prove both the forwarding and the store changes are required.
**Eye test:** `/tests/variants/inherit-false`.
