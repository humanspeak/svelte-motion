# Plan 005: Retire the legacy layout FLIP fallback

> **Executor instructions**: Follow this plan step by step, verify each
> step, honor STOP conditions, update the README status row when done.
> Required prior reading: plan 001 (DONE); the archived visual-element-core
> 005's layout notes.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/utils/layout.ts`
> Expect empty — `layout.ts` has survived every batch untouched.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED — layout/layout-id/projection suites are the bar
- **Depends on**: 001-axis-writer-through-ve.md (DONE); best after 002
  (mirror gone) but not required
- **Category**: tech-debt (re-scope of visual-element-core 005 Step 5; #449 follow-up)
- **Planned at**: commit `bb99032`, 2026-07-25

## Why this matters

`layout.ts` is a home-grown FLIP writer (direct `el.style.transform`/
`width`/`height` writes + `animate(el, …)`) kept as a fallback beside the
motion-dom projection system. Post-#449 every motion component owns a
VisualElement and (when layout props are set) a projection node, so the
fallback's reachable surface should be zero or near-zero — but it still
writes styles outside the VE when reached, and it is the last file-sized
chunk of pre-migration writer code.

## Current state

- `src/lib/utils/layout.ts` (692 lines at `7eba0bd`, untouched since):
  `runFlipAnimation` (`:424-472` — writes `transformOrigin`/`transform`,
  then `animate(el, keyframes, transition)`), `runBoxSizeAnimation`
  (`:169-330` — width/height + per-frame `writeBox`),
  `finishFlipAnimations` (`:143-155`), `setCompositorHints` (`:474-478`),
  `measureRect` write/restore (`:335-370`).
- Container decision points (line numbers have MOVED since `7eba0bd` —
  locate by grep): `commitObservedLayout` chooses
  `commitDraggedLayoutChange` / `commitObservedLayoutChange` / the legacy
  `runFlipAnimation` fallback; the layoutId FLIP effect is "bypassed when
  `motionDomProjection && layoutProp`" — the reachable-fallback question
  from the original plan is whether `layoutId` WITHOUT `layout` still
  routes through the legacy path.
- The projection adapter (`motionDomProjection.ts`) is the sanctioned
  replacement; it shares the component's VE since #449 plan 001.

## Commands you will need

| Purpose     | Command                                                                                  | Expected      |
| ----------- | ---------------------------------------------------------------------------------------- | ------------- |
| Typecheck   | `pnpm check`                                                                             | 0 errors      |
| Unit        | `pnpm test:only`                                                                         | all pass      |
| Gate        | `pnpm test:e2e e2e/layout e2e/layout-id e2e/projection e2e/reorder e2e/animate-presence` | all pass      |
| Format/lint | `trunk fmt` / `trunk check`                                                              | no new issues |

## Scope

**In scope**: `src/lib/html/_MotionContainer.svelte` (fallback branch),
`src/lib/utils/layout.ts` (deletions where provably unreachable),
`src/lib/utils/layout.spec.ts`, batch README.

**Out of scope**: `motionDomProjection.ts` behavior, `presence.ts`
(pop-layout interplay is exercised, not modified), drag files.

## Steps

### Step 1: Reachability audit (the whole plan hinges here)

Instrument (temporary pwLog) every `layout.ts` entry point; run the full
gate suites + drive the layout/layout-id test routes manually. Produce the
reachability list: which paths fire, from which container branch, under
which props (`layout`, `layoutId`-without-`layout`, presence release).

**Verify**: the list, with evidence, in your notes. If NOTHING fires, skip
to Step 3.

### Step 2: Route the reachable cases through projection

For each reachable case (expected: `layoutId` without `layout`), route it
through the projection adapter (the original plan's direction: set the
projection up for that case rather than FLIPping manually). One case per
commit, gate after each.

**Verify**: gate suites green after each case.

### Step 3: Delete

Remove the unreachable/re-routed `layout.ts` writers and the container's
fallback branch; `grep -rn "runFlipAnimation\|runBoxSizeAnimation" src/`
→ no matches. Keep pure helpers with live callers (enumerate in NOTES).
Full gate + `trunk` + unit.

**Verify**: all green; greps clean.

## Test plan

- No red-first test: deletion of (provably) unreachable code, pinned by
  the five-suite gate; Step 1's audit is the evidence standard — no
  deletion without a reachability verdict.

## Done criteria

- [ ] Gate + unit + typecheck green
- [ ] `grep -rn "runFlipAnimation\|runBoxSizeAnimation" src/` → no matches
- [ ] Step 1 reachability list in the report; every deletion tied to it
- [ ] README status row updated

## STOP conditions

- Drift in `layout.ts`; a reachable case that cannot route through
  projection without touching `AnimatePresence`/`LayoutGroup` semantics
  (the original plan's STOP — still binding); any gate regression after
  two attempts.

## Maintenance notes

- After this plan the writers outside the VE should be ZERO (presence
  clones excepted, pending the clone-exit-migration batch). Reviewer:
  pop-layout and presence-release interplay are the scrutiny points.
