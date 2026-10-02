# Guard report: 004 ssr-initial-only

**Recommendation: PASS, awaiting operator eye test.** Server-rendered elements now start from `initial` (or from `animate` only when blocked), matching upstream `makeLatestValues`, so elements without `initial` animate on first load.
**Reviewed at** e9590804 · 2026-10-02 05:52 · **Plan planned at** 3d84ecd5 · **Integrated** as f2d3df7a on `chore/upstream-delta-13.5.1`. No PR yet.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Red recorded, then green | met | 4 unit and 2 e2e reds pass after the fix; SSR spec 10/10 |
| Server seeds via makeLatestValues | met | `_MotionContainer.svelte` server branch |
| unresolved-origin e2e (strict) | met | server HTML and mid-animation assertions pass |
| test:only / check / package | met | 1107; 0 errors; All good |
| Full e2e | met | 572 passed, 2 skipped, 0 failed (integrated branch) |
| Changeset | met | `.changeset/ssr-initial-only.md` |

**Plan amendment (defect):** the client first-paint fallback was in scope after all. **Fix round:** removed dead baseline state that the executor's lint claim had missed.
**Residual:** `mergeInlineStyles`' `animateFallback` parameter is now unused by the container (follow-up). **Eye test:** `/tests/svg/unresolved-origin`, where `--x` climbs from 50 to 100.
