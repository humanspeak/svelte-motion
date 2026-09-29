# Plan 006: Upgrade motion and motion-dom to 13.4.5 and verify inherited fixes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.5/README.md`.
>
> Revision 2026-09-29 (operator: 13.4.5 is published — bump now): run this plan BEFORE 007 finishes. Dependencies
> 001–003 and 005 are DONE; 007 is mid-flight and will rebase onto this bump. Step 2 changes: run
> `e2e/layout/layout-group-parity` with `--repeat-each=3`; any `test.fail` case Playwright now reports as
> "expected to fail but passed" must be flipped to `test(` (assertions unchanged) — record the full
> 13.4.5-only matrix in your report. Cases still red stay `test.fail`; 007 owns them. Use a private
> Playwright config/port instead of 4198 for every e2e run, including the full gate.
>
> Revision 2026-09-28: version checks read `node_modules/<pkg>/package.json` via fs — `require('motion-dom/package.json')` throws ERR_PACKAGE_PATH_NOT_EXPORTED (verified in the main checkout).
>
> **Gate (run first)**: `npm view motion version && npm view motion-dom version`
> → both must print `13.4.5` (or later 13.4.x — if later, STOP and ask whether to
> target it). If either still prints `13.4.4`, STOP: this plan is BLOCKED until
> upstream publishes. Do not point dependencies at a local checkout or git ref.
>
> **Drift check**: `git diff --stat 67815169..HEAD -- package.json pnpm-lock.yaml pnpm-workspace.yaml`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED (dependency bump; spring and projection internals change)
- **Depends on**: 001, 002, 003, 005 (DONE). 007 is resequenced after this bump (2026-09-29).
- **Category**: migration
- **Planned at**: commit `67815169`, 2026-09-28
- **Upstream reference**: `~/Github/motion` tag `v13.4.5`; CHANGELOG entries for 13.4.5 and (mis-tagged) 13.4.4

## Why this matters

Motion 13.4.5 ships fixes svelte-motion inherits directly by importing from
`motion` / `motion-dom`, with no port needed:

- **Layout projection** (`motion-dom` `create-projection-node.ts`, #3839):
  relative child no longer jumps when its parent's re-layout interrupts its
  animation. We use `HTMLProjectionNode` via `src/lib/utils/motionDomProjection.ts`.
- **Spring** (`motion-dom` `animation/generators/spring.ts`): NaN guard for
  falsy/undefined `stiffness`/`mass`, simplified option resolution, 5% smaller.
  Used by `useSpring` (`src/lib/utils/spring.svelte.ts`) and all spring transitions.
- **scroll()** (`motion`): progress-only callbacks routed through `scrollInfo`,
  `source` option honored, containers measured once per frame, `OnScroll`
  type narrowed to `(progress, info) => void`. Used by
  `src/lib/utils/scroll.svelte.ts` (`useScroll`), which defines its own local
  `ScrollInfo` types (unaffected by upstream removing `interpolatorOffsets`/`interpolate`).

Note: upstream's `v13.4.4` git tag was cut before the scroll/drag changes
merged even though CHANGELOG lists them under 13.4.4 — they first ship in the
13.4.5 package. The drag/pan/Reorder/snap items are React-side code we port
ourselves (Plans 001–003), not inherited.

## Current state

- `package.json` dependencies: `"motion": "^13.4.4"`, `"motion-dom": "^13.4.4"`.
- `pnpm-workspace.yaml` lines ~14–17 exclude `framer-motion`, `motion`,
  `motion-dom`, `motion-utils` from the 48h `minimumReleaseAge` guard, so a
  same-day release resolves.
- `packageManager: pnpm@11.24.0`. If the global pnpm can't switch to that
  version (`@pnpm/exe` verify error), use `npx -y pnpm@11.24.0 <cmd>`.
- Previous bump exemplar: commit `01193714` "build(deps): upgrade Motion to 13.4.4"
  touched exactly `.changeset/motion-13-4-4.md`, `package.json`, `pnpm-lock.yaml`.
  `.changeset/motion-13-4-4.md` content:
  ```md
  ---
  '@humanspeak/svelte-motion': patch
  ---

  Update the upstream Motion and motion-dom dependencies to 13.4.4.
  ```
- The docs site consumes the **built** library (`dist`): after `pnpm build`,
  clear the docs Vite cache (`rm -rf docs/node_modules/.vite`) before docs checks.

## Commands you will need

| Purpose       | Command | Expected |
| ------------- | ------- | -------- |
| Bump          | `pnpm add motion@^13.4.5 motion-dom@^13.4.5` | exit 0 |
| Verify install| `node -e "console.log(JSON.parse(require('fs').readFileSync('node_modules/motion-dom/package.json','utf8')).version)"` | `13.4.5` |
| Full unit     | `pnpm test` | all pass |
| Typecheck     | `pnpm check` | 0 errors |
| Build+package | `pnpm build` | exit 0 (publint clean) |
| Docs          | `pnpm --dir docs build && pnpm --dir docs check` | exit 0 / 0 errors |
| Full e2e      | `pnpm test:e2e` | all pass except pre-existing skips/fixme |
| Lint/format   | `trunk check` / `trunk fmt` | no new issues |

E2E server: port **4198**. Never kill an existing server there. The full
e2e run must use build+preview (default config); if 4198 is occupied, ask the
maintainer to free it rather than using `PW_REUSE_SERVER=1` for this gate
(several specs are known to fail only against `vite dev`).

## Scope

**In scope**:

- `package.json`, `pnpm-lock.yaml`
- `.changeset/motion-13-4-5.md` (create)
- `e2e/layout/layout-group-parity/*.spec.ts` (only: flip `test.fail` cases annotated "Needs motion-dom 13.4.5 (Plan 006)")
- Test files whose pinned spring numbers legitimately change (see Step 3) — only with evidence

**Out of scope**: library source changes. If the bump breaks something in
`src/lib`, STOP and report — that becomes a new plan.

## Git workflow

- Branch `chore/motion-13.4.5`.
- Commit: `build(deps): upgrade Motion to 13.4.5` (matches `01193714`).
- Do NOT push or open a PR — maintainer signs off after driving the demos.

## Steps

### Step 1: Bump

Run the Gate. Then `pnpm add motion@^13.4.5 motion-dom@^13.4.5`. Confirm
`git diff --stat` shows only `package.json` and `pnpm-lock.yaml`, and the
installed versions are 13.4.5 (also check `node -e "console.log(JSON.parse(require('fs').readFileSync('node_modules/motion/package.json','utf8')).version)"`).
Create `.changeset/motion-13-4-5.md` mirroring the 13.4.4 changeset with
"13.4.5".

**Verify**: `pnpm check` → 0 errors (catches `OnScroll` / projection type changes).

### Step 2: Flip the LayoutGroup parity cases waiting on 13.4.5

In `e2e/layout/layout-group-parity/`, change every `test.fail(` whose comment
says "Needs motion-dom 13.4.5 (Plan 006)" to `test(` and delete that comment.
Update the "LayoutGroup parity matrix" in the batch README.

**Verify**: `pnpm build && pnpm exec playwright test e2e/layout/layout-group-parity --project=chromium` → all pass as normal tests.
If any still fails: STOP and report (the #3839 fix isn't reaching our adapter).

### Step 3: Unit suite

`pnpm test`. For any failure:

- If it's a spring value/duration assertion, compare against upstream: the
  spring change must preserve behavior for valid options (upstream tests in
  `~/Github/motion/packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`).
  Only update the expectation if the test's input is an invalid/degenerate
  spring (falsy `stiffness`/`mass`, `visualDuration: 0`, numeric strings)
  where upstream deliberately changed output; cite the upstream test in a comment.
- Anything else: STOP and report.

**Verify**: `pnpm test` → all pass.

### Step 4: React reference check for snapToCursor (Plan 002)

Using the React reference fixture snapshotted at
`.agents/.plans/motion-config-transform-page-point/reference-fixture/`
(read its `reference-contract.md` sibling for the run procedure): copy it to
`/tmp/svelte-motion-react-parity-1345`, set `motion`, `framer-motion`,
`motion-dom` to `13.4.5` in its `package.json` (dependencies + overrides),
`npm install`, serve on port 4299, and run
`PARITY_CASES=drag-controls-snap-scrolled REACT_PARITY_OUTPUT=/tmp/svelte-motion-react-parity-1345/out.json node ./run-reference.mjs`.
Compare the `after-snap` bound values and the following move with the
numbers Plan 002 wrote into `e2e/drag/transform-page-point.spec.ts`
(`'matches scrolled controls snap and real layout displacement'`).

**Verify**: values match within 1px. If not, STOP and report both sets.
Do not edit files under `.agents/.plans/motion-config-transform-page-point/`.

### Step 5: Full gate

`trunk fmt`; `trunk check`; `pnpm build`; `rm -rf docs/node_modules/.vite`;
`pnpm --dir docs build && pnpm --dir docs check`; `pnpm test:e2e`.

**Verify**: all pass (pre-existing skips/fixme excepted).

## Test plan

- Red→green anchor: Plan 005's LayoutGroup interrupt/relative-child cases flip green on bump.
- Inherited spring/scroll changes are covered by the existing unit + e2e
  suites (`useSpring`, `useScroll`, scroll e2e).
- React reference check closes Plan 002's parity loop.

## Done criteria

- [ ] `node -e "console.log(JSON.parse(require('fs').readFileSync('node_modules/motion-dom/package.json','utf8')).version)"` → `13.4.5`
- [ ] `grep -rn "Needs motion-dom 13.4.5" e2e/layout/layout-group-parity` → no match
- [ ] `pnpm test`, `pnpm check`, `pnpm build`, docs build/check, `pnpm test:e2e` pass
- [ ] Reference fixture snap values match Plan 002's numbers (±1px)
- [ ] README row updated

## STOP conditions

- Gate fails (not on npm yet) → mark BLOCKED "awaiting npm publish".
- npm has a version newer than 13.4.5 → ask before targeting it.
- Any `src/lib` change seems required.
- A LayoutGroup parity case still fails after the bump.

## Maintenance notes

- Next bump: re-run `git -C ~/Github/motion diff v13.4.5 <new-tag> --stat -- packages`
  and check for tags cut before CHANGELOG'd merges (happened with v13.4.4).
