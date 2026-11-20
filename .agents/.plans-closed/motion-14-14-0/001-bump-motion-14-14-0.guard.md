# Guard log: plan 001 (pin Motion 14.14.0)

**Verdict: PASS** (2026-11-14). Executor: opus, lane `lane/14140-bump` (`c4ec2d67`, `69277dd2`, `4760c147`), merged into `feat/motion-14.14.0` without squash.

## Reproduced by the guard
- `git diff --name-only 6c34537b..lane/14140-bump`: exactly the seven in-scope files. No existing test edited. Lockfile diff touches only `motion`, `motion-dom` and `framer-motion` entries.
- Version `2.13.0`; installed `motion` and `motion-dom` `14.14.0`; `grep -c '"14.14.0"' package.json` → 2; `getSpringOptions` allowlisted in group [c], absent from `src/lib/index.ts`.
- `pnpm check`: 0 errors (36 pre-existing warnings).
- `pnpm test:only`: 123 files, 1715/1715 passed.
- `pnpm build`: exit 0.
- `PW_PORT=4271 … e2e/pinch/vanilla.spec.ts`: 12/12 passed, including #4076.

## Taken from the executor, not reproduced
- Red-on-14.12.0 results (spring warn called once; #4076 box width 161.91 vs 150).
- Full chromium e2e: 958 passed, 2 skipped, 0 failed (31.7 min). The guard re-runs the full suite after wave 2.

## Notes
- The LazyMotion guard got its own `test(lazy-motion)` commit; the plan only gave example commits. Acceptable.
- README status row updated by the dispatcher.
