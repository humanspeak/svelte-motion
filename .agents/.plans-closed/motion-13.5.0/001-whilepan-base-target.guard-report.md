# Guard report: 001 whilepan-base-target

**Recommendation: PASS, awaiting operator eye test.** `whilePan` restore now uses `resolveBaseTarget`, which equals `getBaseTarget` on 13.5.0 and survives its removal.
**Reviewed at** 20aee839 · 2026-10-02 03:07 · **Plan planned at** 9eba7a61 · **Integrated** as b1d3c86c on `chore/upstream-delta-13.5.1`. No PR yet.

| Criterion | Result | Evidence |
| --- | --- | --- |
| baseTarget.ts + spec; parity + value blocks pass | met | 12/12 |
| `getBaseTarget(` only in spec | met | grep |
| pan-authored-transforms e2e | met | 4/4 |
| test:only / check / package / trunk | met | 1098; 0 errors; All good; no new issues |

**Spirit:** this removes the guaranteed `TypeError` the next Motion release would cause, without changing restore behavior, which the parity tests prove.
**Residual:** after the 13.5.1 bump, drop the private-field cast. Eye test: `/tests/motion/pan-authored-transforms`.
