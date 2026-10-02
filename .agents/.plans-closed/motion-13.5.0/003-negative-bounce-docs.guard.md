# Guard log: 003 negative-bounce-docs

## Checkpoint 1 (2026-10-02 03:07): PLAN AMENDED (defect) + ON TRACK

2039119d (worktree snapshot) → a10e21e6 (integrated) · final

- Plan defect: Step 1 assertion 2 claimed `bounce: -0.5` is below `bounce: 0` at 200ms. At a fixed duration, an overdamped spring is AHEAD early (81.2 vs 67.1), and both settle at 800ms. The executor inverted the assertion and documented why, and softened the docs wording from "slower" to "eases in softly". The guard accepts this: the plan's premise was wrong, not the work.
- Guard verified units empirically on the spring generator: `duration` is in **ms** (600 settles at 600ms), and `visualDuration` is in **seconds** (0.5 settles at 800ms). The executor's example `duration: 600` is correct.
- Pre-existing docs bug found, out of scope and not fixed: `use-spring/+page.svx:152` `useSpring(0, { duration: 0.5, bounce: 0.25 })` settles in 10ms. Reported to the operator.
- Guard reproduced: spring spec 16/16; trunk clean; docs check 0 errors on the integrated branch. The worktree's 71 docs errors came from never-run docs generators, an environment issue.
- Verdict: PASS. Awaiting operator eye test; not DONE.
