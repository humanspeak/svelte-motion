# Plan 012 (SPIKE): Make an exiting `AnimatePresence` child with a `layoutId` take part in shared layout: write the red tests, prototype both exit paths, report

> **This is a spike.** The deliverables are (1) committed red tests and (2) a written report with a
> recommendation, backed by two throwaway prototypes. You do **not** ship a fix. The build plan is written from
> your report. Reason: svelte-motion has two exit paths. One (the clone path) structurally cannot keep a
> projection node alive, and a prior spike already refuted the obvious way around that (Svelte `out:`
> transitions, see Current state). Whether a stand-in projection node on the clone can work, and how the owned
> path should defer removal, can only be answered by experiment.
>
> **Executor instructions**: Follow the steps in order and run every verification. If anything in "STOP
> conditions" occurs, stop and report. Report back to the dispatcher; do not edit the batch README.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4216** (`PW_PORT=4216`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Requires plans 006, 007 (this lane) and 008 (presence lane).** Before starting:
> `git merge --no-ff feat/motion-14.7.1` into this lane (it must contain 001 and 008), then
> `pnpm install --frozen-lockfile`. Confirm each prints a line, otherwise STOP:
> `grep -n 'switchLayoutId' src/lib/utils/motionDomProjection.ts` (006),
> `grep -n 'layoutRoot?: boolean' src/lib/types.ts` (007),
> `grep -n 'test.fixme' e2e/layout/layout-root.spec.ts` (007's six crossfade cases),
> and plan 008's changes are in `src/lib/utils/presence.ts` (`git log --oneline -- src/lib/utils/presence.ts`
> shows a 008 commit).
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/utils/presence.ts src/lib/components/PresenceChild.svelte src/lib/components/AnimatePresence.svelte src/lib/utils/presenceExitRegistry.ts src/lib/html/_MotionContainer.svelte src/lib/utils/motionDomProjection.ts`
> Expected: plans 006, 007 and 008's commits only. Line numbers below are at `f8ac71aa`. 006, 007 and 008 shift
> them, so find the excerpts by content. If an excerpt is gone, STOP.

## Status

- **Priority**: P1 (blocks parity for every `layoutId` + `AnimatePresence` crossfade)
- **Effort**: M (spike: red tests, plus two prototypes with a time box of about one working session each, plus
  the report)
- **Risk**: LOW for the branch (prototypes are throwaway, only tests are committed). HIGH for the eventual build
  plan.
- **Depends on**: 007 (same lane: un-`fixme`s its six crossfade cases, uses its `layout-root` page), 006 (same
  lane: open-change closing case, `switchLayoutId`'s `isPresent !== false` takeover rule), 008 (it edits
  `presence.ts` in regions 361-489, 578-716 and 1463-1494, `PresenceChild.svelte`, and
  `_MotionContainer.svelte:696, 718-723`. Prototype B edits `presence.ts` 583-716 (context type and factory) and
  1288-1660 (`unregisterChild`, which contains 1463-1494), and prototype A edits `PresenceChild.svelte` and the
  presence-context region of `_MotionContainer.svelte`. These overlap, so prototype on top of 008.)
- **Wave**: 3 (lane `layoutid`, after 007, and after 008 has merged into `feat/motion-14.7.1`)
- **Category**: direction (upstream parity, spike)
- **Planned at**: commit `f8ac71aa` (main after the 14.6.0 release, svelte-motion 2.5.0), 2026-10-27

## Why this matters

Upstream, an `AnimatePresence` child with a `layoutId` keeps its real element and projection node while it
exits. Its `MeasureLayout` sees `isPresent` flip to `false`, **relegates** it in its shared-layout stack, and
holds removal (`safeToRemove`) until the new lead's layout animation completes. That makes the classic crossfade
work: the old element follows the new one and fades out as the new one fades in. It also makes "close the modal,
the thumbnail grows back" work, and keeps an element with no `exit` mounted until the shared animation ends.
svelte-motion does none of this. Direct `AnimatePresence` children exit as a detached DOM clone with no
VisualElement or projection node. Children on the owned path (`<AnimatePresence present={…}>{#snippet child()}`)
keep their real node, but nothing tells their projection node they are exiting. As a result, 007's six #1935
crossfade cases are `test.fixme`, 006's open-change "closing shrinks the card" case can't pass, and upstream's
shared-layout + `AnimatePresence` cypress suites have no Svelte equivalent. The maintainer's rule is to adopt
upstream. This spike finds the mechanism that can get there and specifies the build.

## Current state

### Upstream (verified at `~/Github/motion`, tag `v14.7.1`)

- `packages/framer-motion/src/components/AnimatePresence/index.tsx` keeps rendering exiting children until they
  report completion (`renderedChildren` lags `presentChildren`), so the exiting element's component, its
  VisualElement and its projection node stay mounted for the whole exit.
- `packages/framer-motion/src/components/AnimatePresence/use-presence.ts:40-65`: every component that calls
  `usePresence()` registers (`register(id)`) and must call `safeToRemove` before the child is removed.
  `MeasureLayout` is one of them (`MeasureLayout.tsx:246-260`), independent of any `exit` animation. That is why
  an exiting `layoutId` element with **no `exit` prop** stays mounted until the crossfade ends
  (`dev/react/src/tests/layout-shared-animate-presence.tsx` +
  `packages/framer-motion/cypress/integration/layout-shared.ts:65-86`: "removed element isn't removed until
  animation is complete").
- `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx@v14.7.1`:
  - `getSnapshotBeforeUpdate` 163: `projection.isPresent = isPresent`. Lines 177-186: `willUpdate()` when
    `prevProps.isPresent !== isPresent`. Lines 188-201: on the flip, `isPresent ? projection.promote() :
    !projection.relegate() && frame.postRender(() => projection.getStack()?.members.length || this.safeToRemove())`.
    If another member takes over, that member is "in charge of the exit animation and therefore of the safe to
    remove".
  - `componentDidMount` 136-143: `projection.addEventListener('animationComplete', () => this.safeToRemove())`
    and `setOptions({ onExitComplete: () => this.safeToRemove() })`.
  - `componentDidUpdate` 212-216:
    `microtask.postRender(() => { if (!projection.currentAnimation && projection.isLead()) this.safeToRemove() })`.
  - `switchLayoutId`'s takeover (98, commit `fd97ac411` "Animate from an exiting lead"): a lead with
    `isPresent === false` is animated from, never taken over instantly, "or its exit never completes".
- motion-dom `projection/shared/stack.ts@v14.7.1`: `relegate` (34-43) promotes the nearest earlier member that is
  present and connected. `promote` (45-74) sets `resumeFrom` and copies the snapshot. `exitAnimationComplete`
  (76-81) calls every member's `options.onExitComplete` and its `resumingFrom`'s.
- motion-dom `projection/node/create-projection-node.ts@v14.7.1`: `relegate()` 1993-1995; `completeAnimation()`
  1855-1868 calls `stack.exitAnimationComplete()`. `notifyLayoutUpdate`'s non-lead branch (2373-2375) calls
  `onExitComplete`. Crossfade opacity for followers is in `applyProjectionStyles` (~2120-2140,
  `opacityExit` / `preserveOpacity`).
- Specs that exercise this (fixture `dev/react/src/tests/<name>.tsx`, spec path):
  - `issue-1935`, `tests/react/issue-1935.spec.ts`: the six "Crossfading…" cases.
  - `issue-1411-open-change`, `tests/react/issue-1411-open-change.spec.ts`: closing shrinks the card into
    thumbnail two.
  - `layout-shared-animate-presence`, `cypress/integration/layout-shared.ts:65-86`.
  - `layout-shared-lightbox-crossfade`, `cypress/integration/layout-shared-lightbox-crossfade.ts`.
  - `animate-presence-exit-complete-multiple`, `cypress/integration/animate-presence-exit-complete-multiple.ts`
    (#3233, `onExitComplete` fires exactly once). Its fixture counts completions with the
    **`onLayoutAnimationComplete`** prop (`dev/react/src/tests/animate-presence-exit-complete-multiple.tsx:66`).
    svelte-motion has no such prop (`grep -rn "onLayoutAnimation" src/lib` prints nothing), nor
    `onLayoutAnimationStart`. Upstream they are plain VisualElement props: motion-dom reads them from
    `visualElement.getProps()` (`create-projection-node.ts:586-589 @ v14.7.1`) and passes them as the layout
    animation's `onPlay` / `onComplete` (627-628). They are typed in `motion-dom/src/node/types.ts:318, 943`. So
    adding them is small: declare them in `types.ts`, destructure them in `_MotionContainer.svelte`, and forward
    them in the VisualElement props (`buildMotionNodeProps`, 527-630). See Step 2a.
  - `layout-crossfade`, `cypress/integration/layout.ts` (find the case with `grep -n layout-crossfade`).

  Find others with: for each `dev/react/src/tests/*.tsx` that uses both `layoutId` and `AnimatePresence`,
  `git -C ~/Github/motion grep -l "test=<name>" v14.7.1 -- tests packages/framer-motion/cypress`.

### svelte-motion

- **Clone path** (`src/lib/utils/presence.ts`). It is used when a `motion.*` element is a direct child of
  `<AnimatePresence>{children}</AnimatePresence>` (`_MotionContainer.svelte:696`:
  `shouldRegisterPresenceExit = !!context && presenceDepth === 0 && !inPresenceChild`).
  `unregisterChild` (1288-1660) runs after Svelte has already detached the element. With no `exit` /
  `resolveExit` it removes the child immediately (1314-1321). So a `layoutId` child without `exit` is never held,
  unlike upstream. Otherwise it builds `child.element.cloneNode(true)` (1416), freezes styles, absolutely
  positions it in the element's slot (1481-1503), and animates it with `animate(clone, exitKeyframes, …)`
  (~1606). The clone has no VisualElement and no projection node (`_MotionContainer.svelte:337-341`: "a
  deliberate architectural deviation … the clone is detached and has no VisualElement"). Exits take a
  `holdLayoutIdHandoffs()` hold (`presence.ts:983-1110`), so the departing rect stays in the `layoutId` registry
  for the arriving element. The arriving element animates from that rect alone; the clone just fades in place.
- **Owned path** (documented at `src/lib/components/AnimatePresence.svelte:21-27`, rendered at 34-37):
  `<AnimatePresence present={…}>{#snippet child()}…{/snippet}</AnimatePresence>` renders
  `<PresenceChild present>`. `PresenceChild.svelte` holds its children rendered with `isPresent = false` until
  every registered exit calls back (`setPresenceChildContext` at 188-200: `isPresent`, `safeToRemove`, `register`,
  `onExitComplete`). `_MotionContainer.svelte:345-360` (`buildPresenceContext`) adapts that into motion-dom's
  `PresenceContextProps`, and `ExitAnimationFeature` (`src/lib/utils/visualElementCore.ts:180`) runs the exit on
  the real VisualElement. The real element and its `MotionDomProjectionAdapter` stay mounted for the whole exit.
  But `grep -rn "relegate\|\.promote(\|projection.isPresent" src/lib` (excluding specs) prints nothing. The
  projection never learns the node is exiting, nothing relegates it, and nothing holds removal for a layout
  animation. It is a single-child API (no lists).
- **Prior spike** `.agents/.plans/clone-exit-migration/spike-report.md` (2026-07-26). Read §2-§4 before starting:
  - Svelte `out:` transitions on the motion element were **refuted** as an exit mechanism: they miss nested
    `{#if}` (local) or delay unrelated teardowns (`|global`), freeze `$effect`s during the exit, and can't reverse.
    Don't re-prototype them.
  - Data-driven real-node children (the owned path's model) **work** and coexist with the clone path.
  - Its prototypes live in `src/routes/tests/_spike-clone-exit/`.
- Projection adapter: `src/lib/utils/motionDomProjection.ts`. `unmount()` (~482-520) runs `scheduleCheckAfterUnmount`,
  leaves the node group, and unmounts the VisualElement, whose projection `unmount()` removes the node from its
  stack. `currentVisualPageRect()` (~817-830) gives the on-screen rect with no DOM read.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| E2E | `PW_PORT=4216 pnpm exec playwright test <paths>` | as each step says |
| Unit | `pnpm exec vitest run <paths>` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Format/lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**Committed (on the lane branch)**:

- `e2e/layout/layout-root.spec.ts`: remove `test.fixme` from the six crossfade cases and add `owned` variants.
- `src/routes/tests/layout-root/+page.svelte`: an `?owned=true` query param that renders each underline through
  the owned path.
- `e2e/layout-id/open-change.spec.ts` and `src/routes/tests/layout-id/open-change/+page.svelte`: the closing case
  active (un-`fixme` it if 006 marked it), plus an `?owned=true` variant.
- New ported pages and specs: `src/routes/tests/layout-id/presence-crossfade/+page.svelte` (←
  `layout-shared-animate-presence`), `src/routes/tests/layout-id/lightbox-crossfade/+page.svelte` (←
  `layout-shared-lightbox-crossfade`), `src/routes/tests/layout-id/exit-complete-once/+page.svelte` (←
  `animate-presence-exit-complete-multiple`), plus any found by the search above, each with a spec in
  `e2e/layout-id/` and a `?owned=true` variant. Add links in `src/routes/+page.svelte`.
- `.agents/.plans/motion-14-7-1/012-spike-report.md` (create; the report).

Red tests stay red on the lane branch. Mark each one `test.fail()` with a one-line comment pointing at this
spike's report, so the lane's suite passes and the cases flip to an "unexpected pass" alarm as soon as a fix
lands. Not `fixme`.

**Throwaway (branch `spike/1471-presence-relegate`, never merged)**: anything under `src/lib/` needed for the
prototypes.

**Out of scope**: shipping any `src/lib/` change, changing the public `AnimatePresence` API, re-prototyping
Svelte `out:` transitions, `layoutCrossfade`, `package.json`.

## Git workflow

- Lane branch `lane/1471-layoutid` (after 007). Before creating the spike branch, record the lane tip SHA after
  the red-test commit (`git rev-parse HEAD`, call it `LANE_SHA`) and write it in the report. Commit the red tests (`test(presence): shared layout crossfades with exiting elements (spike 012)`)
  and the report (`docs(plans): spike 012 report`).
- Create `spike/1471-presence-relegate` from that commit for the prototypes. Commit them there. Don't merge it;
  the report links its commits.
- End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do NOT push or open a PR.

## Steps

### Step 1: Red tests, both syntaxes

1. In `src/routes/tests/layout-root/+page.svelte` add `?owned=true`. With it, each tab's underline renders through
   `<AnimatePresence present={item === selected}>{#snippet child()}<motion.div class="underline" layoutId="underline" …/>{/snippet}</AnimatePresence>`
   instead of `{#if}`, for the tabs and for the `outside` box. Default stays the clone syntax.
2. In `e2e/layout/layout-root.spec.ts` remove `test.fixme` from the six crossfade cases. For each, add an `owned`
   twin (same body, query plus `&owned=true`, name suffixed `(owned)`). Also add owned twins of the seven
   non-crossfade cases. Classify these as **record** (spike findings), not must-pass guards: the owned path has
   never been measured against #1935, so whether they pass is itself a finding. Mark any that fail `test.fail()`
   like the red cases, and report them.
3. Open-change: make the closing case active. Add `?owned=true` to the page (the card rendered through the owned
   path) and an owned twin of every open-change test.
4. Port `layout-shared-animate-presence`, `layout-shared-lightbox-crossfade` and
   `animate-presence-exit-complete-multiple`, plus any other fixture the Current-state search finds that isn't
   already ported. Keep upstream's ids, styles, timings and assertions, each with an owned twin. Where upstream
   swaps keyed children of one `AnimatePresence` (`key={shape-${count}}`), the clone syntax is
   `{#key count}<motion.div key="shape-{count}" …/>{/key}`. The owned syntax needs two alternating owned
   `AnimatePresence`s (A present when even, B when odd). Note the deviation in the page header.
   `animate-presence-exit-complete-multiple` is **blocked** on the lane branch: it needs `onLayoutAnimationComplete`
   (Current state). Write its page and spec verbatim with the prop, and mark the spec `test.fixme` with the comment
   "blocked: needs `onLayoutAnimationComplete` (spike 012, Step 2a)". Do **not** substitute another signal (an
   `onExitComplete` count, a rAF poll) to make it runnable. Add the prop on the lane branch only if the dispatcher
   says so; otherwise it is a build-plan item.
5. Link every new page from `src/routes/+page.svelte`, next to the `layout-id` links.

**Verify**: `PW_PORT=4216 pnpm exec playwright test e2e/layout/layout-root.spec.ts e2e/layout-id`. Record a table of
every case: name, syntax, pass/fail, and the failing assertion. Expected: every crossfade, closing and
closing case fails in both syntaxes, and every existing guard passes (the owned twins of the non-crossfade cases
are "record"). If an existing guard fails, or any crossfade case passes, STOP. Then mark the failing ones `test.fail()` (Scope) and commit on the lane branch.

### Step 2a: Prototype prerequisite, `onLayoutAnimationStart` / `onLayoutAnimationComplete`

First commit on `spike/1471-presence-relegate`: add both props as Current state describes. Declare them in
`types.ts` with upstream's semantics: fired when the element's layout animation starts or completes. Forward them
in the VisualElement props. Un-`fixme` the exit-complete spec on the spike branch only, so the prototypes can be
measured against it. Record in the report whether the props alone work in both syntaxes for an ordinary (non-exit)
layout animation. The build plan will own shipping them, with JSDoc, docs and tests. List
"add `onLayoutAnimationStart` / `onLayoutAnimationComplete`" in the report's build items even if a prototype
fails.

### Step 2: Prototype A — owned path, upstream `MeasureLayout` presence logic

On `spike/1471-presence-relegate`, port upstream's presence handling for a node whose element stays mounted (the
owned path):

- When `presenceChildContext.isPresent` flips: `projection.isPresent = isPresent`, `adapter.willUpdate()`, then
  `promote()` or `relegate()` exactly as `MeasureLayout.tsx:188-201`, then the root `didUpdate`. Use the existing
  pre/post effect pattern from 006's switch pair.
- Removal hold: register with `PresenceChild` (`presenceChildContext.register`, as `usePresence` does). Release
  on upstream's three signals: `animationComplete`, `onExitComplete` (`setOptions`), and the
  `componentDidUpdate` microtask check (not animating and lead). Also release when `relegate()` found nobody and
  the stack is empty one frame later.
- Hold an owned child that has a `layoutId` but no `exit`.

Run the Step 1 owned twins and record pass/fail per case, plus any regressions in
`PW_PORT=4216 pnpm exec playwright test e2e/animate-presence e2e/use-presence e2e/layout-id e2e/layout`. Stop
prototyping when the time box ends, even if cases still fail. The question is "does this mechanism get there, and
what is missing", not "make it all green".

### Step 3: Prototype B — clone path

Pick **one** of these two (state which in the report), prototype it, and measure it on the clone-syntax cases:

- **B1, stand-in projection node on the clone.** In `unregisterChild`, for a child with a `layoutId`, take over
  the departing adapter's projection state before it unmounts. `_MotionContainer.svelte` hands `presence.ts` a
  hook at registration. Mount a fresh `HTMLProjectionNode` on the clone with the departing node's
  `latestValues`, last layout and projection parent, and register it in the same scoped `layoutId` stack with
  `isPresent = false`. Then relegate it so the arriving lead resumes from it, and remove the clone on the
  stack's `exitAnimationComplete` instead of only on its own exit animation. Also hold clones for `layoutId`
  children with no `exit`. Key questions: can the stand-in be inserted before the arriving element's update pass
  (ordering against Svelte's teardown), and does the clone then follow the lead (crossfade frames line up,
  `expectCrossfade`)?
- **B2, route `layoutId` children to a real-node path.** Is there any way for a direct `{#if}` child to keep its
  real node? The prior spike says no for `out:`. Only choose B2 if you find a mechanism the prior spike didn't
  test, and name it.

Same verification and time box as Step 2.

### Step 4: Report

Write `.agents/.plans/motion-14-7-1/012-spike-report.md`:

1. The Step 1 table, then the same table after prototype A and after prototype B. Cite commits on the spike
   branch.
2. A recommendation, one of:
   - (a) build A, and make B1 the clone path's behaviour;
   - (b) build A, and make `layoutId` children of `AnimatePresence` require the owned syntax (a dev warning
     on the clone path, docs);
   - (c) build A only, with the clone path left as a documented deviation;
   - (d) something else, argued.

   For each, say which red cases it turns green and which upstream behaviours stay out of reach. The maintainer's
   rule is to adopt upstream. If (b) or (c) is recommended, say exactly why B can't reach upstream behaviour, with
   measurements.
3. For the recommended build: the exact files and regions it touches (`presence.ts` line ranges after 008,
   `PresenceChild.svelte`, `_MotionContainer.svelte`, `motionDomProjection.ts`); its interaction with the
   `layoutId` registry and `holdLayoutIdHandoffs`; effort, risk and STOP risks. That is enough for a build plan
   to be written directly from it.
4. The regressions each prototype caused, and the guard suites a build must run.

**Verify**: the report exists, has every section, and every claim has a measurement or a `file:line`.
`git diff --stat <LANE_SHA>..lane/1471-layoutid -- src/lib` is empty: no prototype code reached the lane after
the spike branch was cut. Run it after the report commit. Diffing the lane against itself would be vacuous.
`PW_PORT=4216 pnpm exec playwright test e2e/layout e2e/layout-id` on the lane branch passes (red cases are
`test.fail`). `pnpm check` gives 0 errors. `trunk check` passes on the committed files.

## Test plan

- Red tests (the deliverable): the six #1935 crossfade cases, 006's open-change closing case, and the ported
  `layout-shared-animate-presence` and `layout-shared-lightbox-crossfade` cases, in both clone and owned syntax.
  They are committed as `test.fail()`.
- Record (findings, not must-pass): the owned twins of 007's seven non-crossfade cases.
- Blocked: the `animate-presence-exit-complete-multiple` port (`test.fixme` on the lane until
  `onLayoutAnimationComplete` exists; measured on the spike branch via Step 2a).
- Guards: all existing `e2e/layout`, `e2e/layout-id`,
  `e2e/animate-presence` and `e2e/use-presence` specs.
- No unit tests are committed in a spike. Prototypes may add throwaway ones on the spike branch.

## Done criteria

- [ ] Red tests and owned twins committed on `lane/1471-layoutid`: failing ones marked `test.fail()` with a pointer
      to the report, and the exit-complete port marked `test.fixme` as blocked on `onLayoutAnimationComplete`
- [ ] The report lists "add `onLayoutAnimationStart` / `onLayoutAnimationComplete`" as a build item
- [ ] `git diff --stat <LANE_SHA>..lane/1471-layoutid -- src/lib` is empty (`LANE_SHA` recorded in the report)
- [ ] Prototypes A and B committed on `spike/1471-presence-relegate`, with results tables in the report
- [ ] `012-spike-report.md` gives a recommendation, the build's touch list (with `presence.ts` regions after
      008), and its guard suites
- [ ] Lane-branch `e2e/layout` and `e2e/layout-id` pass; `pnpm check` 0 errors

## STOP conditions

- Plans 006, 007 or 008 aren't in the lane after the merge (see the header checks).
- In Step 1 a crossfade or closing case passes before any prototype, or an existing guard fails.
- A prototype needs changes to motion-dom itself (patching `node_modules`). Record it in the report as a finding
  and stop that prototype; don't patch.
- A prototype breaks more than three existing `e2e/animate-presence` specs in ways that aren't obviously its own
  bug. Record it and stop that prototype.
- You find yourself re-prototyping Svelte `out:` transitions. The prior spike refuted them; stop and cite it.

## Maintenance notes

- The build plan replaces this spike's `test.fail()` markers with plain tests. Until then they guard against
  accidental partial fixes (Playwright reports an unexpected pass).
- 006's `switchLayoutId` already follows upstream's `isPresent !== false` rule. Prototype A is the first code that
  sets `projection.isPresent`, so it is what makes that rule reachable.
- Whatever the build does to `presence.ts` must be sequenced after 008's popLayout regions. Restate the regions
  in the build plan from the post-008 file.
