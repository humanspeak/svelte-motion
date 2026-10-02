# Guard log: 001 motion-dependency-refresh

## Checkpoint 1 (2026-10-02 11:49): PLAN AMENDED ×2, DRIFTING → fixed, ON TRACK

6cc66928 (worktree snapshot) → 25379974 (integrated on `chore/motion-13.5.1`) · final

- Pre-flight amendment: 13.5.1 was published on 2026-10-02 (14.0.0 too; out of scope under `^13.5.1`). motion-utils stays 13.5.0 under upstream's new exact pins. The v13.5.1 extras (observeTimeline restored, rangeStart/rangeEnd honoured, sortNodePosition fix) arrive with the bump.
- Amendment #2 (plan defect): the executor STOPped correctly. 13.5.1's types drop `getBaseTarget`, so the 13.5.0/001 parity tests failed `pnpm check` (2 errors). Scope was widened to retire the parity block. `baseTarget`/`initialValues` are also absent from 13.5.1's public `.d.ts`, so the cast stays (13.5.0/001's maintenance note was wrong).
- Drift (non-discriminating test): the guard copied the new routing spec into a 13.5.0 checkout and it PASSED 4/4, because `x` was already style-routed. A per-key probe showed only non-CSS keys changed (`scaleX`, `originX`: attribute → CSS). Fix round: tests switched to `scaleX`/`originX`, with `x`/`attrX` as controls, and the changeset was corrected. The guard re-verified: on 13.5.0, 2 failed and 4 passed; on 13.5.1, 6 passed.
- Guard reproduced on the integrated branch: frozen install gives motion-dom 13.5.1; units 1104/1104; `pnpm check` 0 errors. Executor full e2e on 13.5.1: 572 passed, 2 skipped, 0 failed (`/tmp/e2e-1351-001.log`). The fix round was unit-only.
- Verdict: PASS. Awaiting operator eye test; not DONE.
