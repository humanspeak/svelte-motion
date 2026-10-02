# Guard report: 001 motion-dependency-refresh

**Recommendation: PASS, awaiting operator eye test.** Motion and motion-dom are at 13.5.1 with no regressions, and svgEffect's routing change is pinned by tests that discriminate between 13.5.0 and 13.5.1.
**Reviewed at** 6cc66928 · 2026-10-02 11:49 · **Integrated** as 25379974 on `chore/motion-13.5.1` (stacked on PR #493). No PR yet.

| Criterion | Result | Evidence |
| --- | --- | --- |
| Gate; ^13.5.1; tree; frozen install | met | 13.5.1 on npm; motion/framer/dom 13.5.1, utils 13.5.0 |
| `getBaseTarget(` only in tests | met (stronger) | the parity block is retired; only a JSDoc mention remains |
| svgEffect routing tests | met | discriminating: 13.5.0 fails 2, 13.5.1 passes 6 |
| build, check, test:only, consumer, docs, full e2e | met | All good; 0 errors; 1104; 3/3; docs 0 errors; e2e 572/2/0 |
| Changeset; version untouched | met | `.changeset/motion-13-5-1.md`; package.json version unchanged |

**Residual:** 14.0.0 is out and needs its own audit. Eye test: a spot check of SVG and motion pages, since the svgEffect change affects direct `svgEffect` users.
