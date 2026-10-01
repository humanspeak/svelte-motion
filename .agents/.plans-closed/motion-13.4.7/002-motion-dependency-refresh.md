# Plan 002: Align with Motion 13.4.7 and prove target offsets attach to a native ViewTimeline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.7/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Gate (run first)**: `npm view motion@13.4.7 version` must print `13.4.7`.
> If it errors or prints nothing, Motion 13.4.7 is not on npm yet: STOP.
> This plan is BLOCKED until it is.
>
> **Drift check**: `git diff --stat ae938824..HEAD -- package.json pnpm-lock.yaml src/lib/utils/scroll.svelte.ts src/routes/+page.svelte docs/src/routes/docs/use-scroll/+page.svx .changeset e2e/utilities`
> Plan 001 is expected to have changed `scroll.svelte.ts` and `.changeset/`.
> Anything else is a STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED (dependency bump; upstream reworked scroll tracking internals in #3858)
- **Depends on**: 001-view-timeline-offset-rule.md (DONE), plus Motion 13.4.7 published on npm
- **Category**: migration
- **Planned at**: commit `ae938824`, 2026-09-30

## Why this matters

Motion 13.4.7 (tag `v13.4.7`, 2026-09-30) is what this branch
(`chore/upstream-delta-2026-09-30`) exists to align with. Its changelog:

```md
## [13.4.7] 2026-09-30
### Changed
-   `scroll`/`useScroll`: More `offset`s are now hardware accelerated via `ViewTimeline`.
### Fixed
-   `animate`: Reduced size of Motion Studio introspection call.
-   `useTransform`: Accelerated values now correctly clamp.
-   `scroll`/`useScroll`: Ensure offsets work the same across the JS main thread and `ViewTimeline`.
-   `scroll`/`useScroll`: Remove `ScrollTimeline`/`ViewTimeline` observer in favour of main-thread scroll tracking.
```

- The `useTransform` clamp fix is already implemented on this branch
  (`src/lib/utils/transform.svelte.ts`, `propagateAccelerate`).
- Plan 001 ported the new offset rule, so `useScroll` now *requests* acceleration
  for offsets like `["start end", "end start"]`.
- But the native range mapping itself (`rangeStart`/`rangeEnd`, reversed
  direction) happens inside motion's `scroll()`. We call that from
  `makeAccelerateConfig` in `src/lib/utils/scroll.svelte.ts`. Only Motion 13.4.7's
  `scroll()` maps these offsets. This plan installs it and proves the element
  really gets a native ViewTimeline animation, red first.

## Current state

- `package.json` dependencies (line ~146):
  ```json
  "motion": "^13.4.6",
  "motion-dom": "^13.4.5"
  ```
  At `v13.4.7`, upstream publishes `motion`, `framer-motion`, and `motion-dom` as
  13.4.7. `motion-utils` stays 13.3.0.
- `pnpm-workspace.yaml` exempts `motion`, `motion-dom`, `motion-utils`, and
  `framer-motion` from the 48h `minimumReleaseAge`, so they resolve the same day.
- APIs removed upstream that we must NOT be using: `observeTimeline` (the motion-dom
  export was removed) and `TimelineWithFallback.rangeStart/rangeEnd` (replaced
  by `onAttach`). Plan-time check: `grep -rn "observeTimeline\|rangeStart\|rangeEnd" src/lib`
  shows only local strings in `scroll.svelte.ts` from before plan 001.
- Existing scroll e2e/test page to keep green: `/tests/use-transform/scroll-accelerate`
  (`e2e/utilities/use-transform-scroll-accelerate.spec.ts`). The page's 13.4.6-era
  behaviour is signed off by the maintainer.
- Test/demo page conventions: human-reviewed pages use `TesterPanel`
  (`src/routes/tests/layout/_parity/TesterPanel.svelte`; see its use in
  `src/routes/tests/use-transform/scroll-accelerate/+page.svelte`). The panel is
  hidden under `?@isPlaywright=true`. Pages are linked from `src/routes/+page.svelte`
  as `<li><a class="text-blue-300 hover:underline" href={resolve('/tests/…') + searchParams}>…</a></li>`.
- Previous bump exemplar: `.agents/.plans-closed/motion-13.4.6/002-motion-dependency-refresh.md`
  (command table, lockfile-hunk inspection). Note that its pnpm-11 pin is obsolete.
  The repo now uses pnpm 12.6.0 (`packageManager` in `package.json`), and global
  `pnpm` works.

## Commands you will need

| Purpose           | Command                                                                                          | Expected                                   |
| ----------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Bump              | `pnpm --filter @humanspeak/svelte-motion update motion@13.4.7 motion-dom@13.4.7 --save-prefix='^'` | manifest `^13.4.7` for both                |
| Frozen install    | `pnpm install --frozen-lockfile`                                                                 | exit 0, no tracked changes                 |
| Tree              | `pnpm list motion motion-dom framer-motion motion-utils --depth 3`                               | motion/framer/dom 13.4.7, utils 13.3.0     |
| Build/package     | `pnpm build`                                                                                     | exit 0 (includes publint)                  |
| Types             | `pnpm check`                                                                                     | 0 errors                                   |
| Units             | `pnpm test:only`                                                                                 | all pass                                   |
| Consumer          | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`                                     | 3 "…passed." lines                         |
| Docs              | `pnpm --dir docs build` then `pnpm --dir docs check`                                             | exit 0 / 0 errors                          |
| e2e (focused)     | `pnpm exec playwright test e2e/utilities/use-scroll-view-timeline-offsets.spec.ts e2e/utilities/use-transform-scroll-accelerate.spec.ts e2e/utilities/will-change.spec.ts --reporter=list` | all pass (chromium) |
| Lint              | `trunk fmt <files>` then `trunk check --no-fix <files>`                                          | no issues                                  |

e2e port: Playwright builds and previews on **4198**. It is the maintainer's
sign-off port. **Never kill** a process on 4198. If 4198 is in use and you're in
the main checkout, run with `PW_REUSE_SERVER=1` only if that server is serving
THIS checkout's current code. Otherwise report e2e as verification-blocked.

## Scope

**In scope:**

- `package.json` (`motion`, `motion-dom` requirement lines only), `pnpm-lock.yaml`
- `src/routes/tests/use-scroll/view-timeline-offsets/+page.svelte` (create)
- `src/routes/+page.svelte` (one link)
- `e2e/utilities/use-scroll-view-timeline-offsets.spec.ts` (create)
- `docs/src/routes/docs/use-scroll/+page.svx` (`## Performance` section)
- `.changeset/motion-13-4-7.md` (create)
- `.agents/.plans/motion-13.4.7/README.md`: status row only

**Out of scope:** any library source under `src/lib/` (if the bump needs a source
change, that's a STOP); other dependencies; `packageManager`/toolchain; the root
`version` field (never bump it; versions mirror upstream); CI.

## Steps

### Step 1: Test page + e2e, red against Motion 13.4.6

Create `src/routes/tests/use-scroll/view-timeline-offsets/+page.svelte`: a tall
page with a target element in the middle (e.g. three `100vh` spacers around a
`12rem` box). Use Svelte `bind:this` and pass it as a getter:
`useScroll({ target: () => targetEl, offset: ['start end', 'end start'] })`.
Map it with `useTransform(scrollYProgress, [0, 1], [0.2, 1])` onto a
`motion.div`'s `style.opacity`, with `data-testid="cover-box"`. Add a second box
driven by `offset: ['start end', 'end end']` (Enter, which accelerated before) as
`data-testid="enter-box"`. Show `String(!!scrollYProgress.accelerate)` readouts
(`cover-accelerated`, `enter-accelerated`). Add a `TesterPanel` with steps:
"scroll past the box; its opacity follows the scroll while the box is in view"
and "Chrome DevTools > Animations shows a ViewTimeline animation for it". Link
the page from `src/routes/+page.svelte` next to the scroll-accelerate entry.

Create `e2e/utilities/use-scroll-view-timeline-offsets.spec.ts`
(URL `…?@isPlaywright=true`). Skip when
`!('ViewTimeline' in window)`. For each box, poll that
`el.getAnimations().some(a => a.timeline?.constructor?.name === 'ViewTimeline')` is
`true`, and that `cover-accelerated` reads `true`. Model on
`e2e/utilities/use-transform-scroll-accelerate.spec.ts`.

**Verify**: run the new spec while still on Motion 13.4.6. `enter-box` should pass
(Enter mapped natively before). `cover-box`'s ViewTimeline assertion should FAIL:
13.4.6's `scroll()` can't map the cover offset, so it falls back to JS
observation. Report the verbatim failure. If `cover-box` already passes, STOP
and report. The premise that 13.4.6 can't attach it natively would be wrong.

### Step 2: Bump Motion

Run the Bump command. Inspect every `pnpm-lock.yaml` hunk: only motion,
framer-motion, and motion-dom resolutions/snapshots may change. Run the frozen install
and the Tree command.

**Verify**: manifest shows `"motion": "^13.4.7"` and `"motion-dom": "^13.4.7"`; the
tree matches the expected versions; frozen install leaves `git status` clean
apart from the two files.

### Step 3: Green

**Verify**: the Step 1 spec now passes, including `cover-box` on a ViewTimeline.
The scroll-accelerate and will-change specs still pass.

### Step 4: Docs + changeset

- In `docs/src/routes/docs/use-scroll/+page.svx` `## Performance`, add one
  sentence: with a `target`, `useScroll` progress values run on a native
  ViewTimeline when the offset's two points sit on the container's `start`/`end`
  edges with proportional (not px/vw/vh) target positions. Examples:
  `["start end", "end start"]`, `["center end", "center start"]`.
  Otherwise they fall back to JavaScript.
- Create `.changeset/motion-13-4-7.md` (patch): "Update Motion and motion-dom to
  13.4.7. `useScroll` with a `target` now runs more offsets (for example
  `["start end", "end start"]`) on a native ViewTimeline, matching Motion."

**Verify**: `trunk check --no-fix` on the two files → no issues.

### Step 5: Full gate

Run every row of the command table, serialising builds (root build, docs build,
and the Playwright webServer build all write outputs).

**Verify**: every row meets its expectation; `git status --porcelain` shows only
in-scope files.

## Test plan

- **Red first**: Step 1's `cover-box` ViewTimeline assertion fails on 13.4.6 and
  passes on 13.4.7. That proves the bump plus plan 001 deliver native attachment
  for the new offsets. `enter-box` is the control, native on both versions.
- Regression: full units (including plan 001's ported upstream cases), the consumer
  suite (tree-shaking stays green), the signed-off scroll-accelerate e2e, and the
  will-change e2e.

## Done criteria

- [ ] `npm view motion@13.4.7 version` → `13.4.7` (gate)
- [ ] Manifest `^13.4.7` for motion and motion-dom; the lock tree matches; frozen install is clean
- [ ] New page + link + e2e exist; `cover-box` failed on 13.4.6 (reported) and passes on 13.4.7
- [ ] `pnpm build`, `pnpm check`, `pnpm test:only`, consumer, docs build/check all pass
- [ ] Focused e2e command passes
- [ ] Docs sentence + `.changeset/motion-13-4-7.md` added; root `version` unchanged
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- The gate fails (13.4.7 not on npm).
- Plan 001 is not DONE.
- The lockfile changes anything beyond motion/framer-motion/motion-dom, or the
  tree differs from expectations.
- `cover-box` attaches natively already on 13.4.6 (Step 1), or still doesn't on 13.4.7 (Step 3).
- Any library source change seems necessary after the bump.
- Verification fails twice after reasonable correction. Never weaken a test to pass.

## Maintenance notes

- Upstream moved JS-driven scroll values to `scrollInfo` (#3858). If any
  scroll-linked e2e changes timing after the bump, it comes from there, not from
  our code.
- The tester page is the place to sign off ViewTimeline behavior by hand. The
  maintainer's sign-off rule applies before any PR.
