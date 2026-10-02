# Guard report: 003 negative-bounce-docs

**Recommendation: PASS, awaiting operator eye test.** Negative bounce is documented and pinned through our public `spring` export.
**Reviewed at** 2039119d · 2026-10-02 03:07 · **Plan planned at** 9eba7a61 · **Integrated** as a10e21e6. No PR yet.

| Criterion | Result | Evidence |
| --- | --- | --- |
| spec block passes | met | 16/16 (3 new) |
| docs mention negative bounce + example | met | use-spring table + `duration: 600, bounce: -0.4` example |
| docs check 0 errors; trunk clean | met | integrated branch |

**Plan amendment (defect):** "slower at 200ms" was false at a fixed duration. The assertion and wording were corrected (see log).
**Residual:** the line 152 example uses `duration: 0.5`, which is 0.5ms, effectively instant. Fixing it is the operator's call. **Eye test:** docs `/docs/use-spring`.
