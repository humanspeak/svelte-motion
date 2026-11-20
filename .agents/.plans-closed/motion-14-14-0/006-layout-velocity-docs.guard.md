# Guard log: plan 006 (layout velocity docs and example)

**Verdict: PASS** (2026-11-14). Executor: opus, lane `lane/14140-docs` (`c6d696f5`, `fcce5472`), merged into `feat/motion-14.14.0` without squash, after the wave-2 full-suite run.

## Reproduced by the guard
- Diff: six docs files, all in scope; no `$lib` imports in the new demos or route.
- `mass: "auto"` wording checked against upstream `resolveAutoMass` (`layout-velocity.ts:24-34`) and its call (`create-projection-node.ts:2081-2087` @ v14.14.0): mass = clamp(0.25, 2, √(w·h) / 300), damping × √mass. The docs are accurate.
- `pnpm --dir docs check`: 0 errors (13 pre-existing warnings). `pnpm --dir docs test`: 11/11.

## Taken from the executor, not reproduced
- Docs build, geo-SEO 3/3, docs Playwright 12/12; the dev-server demo measurements (spring puck carries on 24.5–26.8 px; tween puck one frame of travel, plan 005's case; auto-mass large tile finishes ~250 ms after small).

## Accepted deviations
- Index entry after `layout-root` (alphabetical; still after `layout-scroll`). No docs e2e spec (no per-example pattern exists). "mass: 1" mode omits the key.

## Follow-up (not a defect of this plan)
- The "Layout transition" table could state the default (0.45 s, `[0.4, 0, 0.1, 1]`) that plan 007 adopted.
