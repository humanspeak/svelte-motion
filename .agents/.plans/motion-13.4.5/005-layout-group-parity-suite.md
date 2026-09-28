# Plan 005: Port upstream's LayoutGroup parity suite (red tests for node-group parity)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.5/README.md`, **including the red/green
> matrix from Step 6** — Plan 007 depends on it.
>
> **Drift check (run first)**: `git diff --stat 67815169..HEAD -- src/lib/components/LayoutGroup.svelte src/lib/components/layoutGroup.context.ts src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte src/routes/tests/layout e2e/layout`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (tests and test pages only)
- **Depends on**: none
- **Category**: tests (upstream parity; red tests for Plan 007)
- **Planned at**: commit `67815169`, 2026-09-28 (revised same day: scope widened from the single interrupt page to the full LayoutGroup suite, per maintainer)
- **Upstream reference** (`~/Github/motion`, tag `v13.4.5`):
  - pages: `dev/react/src/tests/layout-group.tsx`, `layout-group-interrupt.tsx`, `layout-group-unmount.tsx`, `layout-group-unmount-list.tsx`
  - Cypress: `packages/framer-motion/cypress/integration/layout-group.ts`, `layout-group-interrupt.ts`, `layout-group-interrupt-measurements.ts`, `layout-shared.ts` (describe "Shared layout: component unmounts in a LayoutGroup", ~line 1004)
  - Jest: `packages/framer-motion/src/components/LayoutGroup/__tests__/LayoutGroup.test.tsx`, `relative-child-measurements.test.tsx`
  - Source: `packages/framer-motion/src/components/LayoutGroup/index.tsx`, `packages/motion-dom/src/projection/node/group.ts`, `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`

## Why this matters

svelte-motion's `LayoutGroup` only scopes `layoutId`. Upstream's also owns a
**projection node group** (`nodeGroup()` from motion-dom): every `layout`
node in the group is snapshotted whenever any member updates or unmounts,
and `inherit="id"` / `inherit={false}` start a *separate* group. Our
component documents the gap (`src/lib/components/LayoutGroup.svelte:26-33`:
"`'id'` — same as `true` in this implementation"). Motion 13.4.5's
relative-child fix (#3839) is specifically about nodes in a separate group
following a re-laying-out parent, so parity requires both the node group
(Plan 007) and the motion-dom bump (Plan 006).

This plan ports upstream's LayoutGroup tests **before** any implementation so
Plan 007 has red tests to turn green, and records exactly which cases fail on
the current code.

## Current state

- `src/lib/components/LayoutGroup.svelte` — publishes a string id via
  `setLayoutGroupContext(effectiveId)`; `inherit === true || inherit === 'id'`
  chains the id.
- `src/lib/components/layoutGroup.context.ts` — `LayoutGroupContext = string | undefined`;
  `chainLayoutGroupId(parent, own)` → `` `${parent}-${own}` ``;
  `scopeLayoutId(groupId, layoutId)` → `` `${groupId}::${layoutId}` `` (upstream uses `-`, see Plan 007).
- `src/lib/components/__tests__/LayoutGroupProbe.svelte` + `layoutGroup.context.spec.ts` — existing unit pattern for reading the context.
- `e2e/layout/group.spec.ts` + `src/routes/tests/layout/group/+page.svelte` — only existing LayoutGroup e2e (tab-strip scoping, #311).
- Layout pages index: `src/routes/+page.svelte` ~line 710 (`/tests/layout/scroll`).
- Components: `motion.div` / `MotionDiv` with `layout`, `layout="position"`,
  `layoutId`; `MotionConfig transition={...}`; `LayoutGroup id inherit`.
  React `useId()` → Svelte `$props.id()` (or fixed unique strings).

## Commands you will need

| Purpose     | Command | Expected |
| ----------- | ------- | -------- |
| Unit        | `pnpm exec vitest run src/lib/components` | see steps |
| Build       | `pnpm build` | exit 0 |
| E2E         | `pnpm exec playwright test e2e/layout/layout-group-parity --project=chromium` | see Step 6 |
| Typecheck   | `pnpm check` | 0 errors |
| Lint/format | `trunk check` / `trunk fmt` | no new issues |

E2E server: port **4198**; never kill an existing server there — prefix
`PW_REUSE_SERVER=1`. Use build+preview (default) for the Step 6 matrix; a few
specs are known to differ under `vite dev`.

## Scope

**In scope** (create unless noted):

- `src/routes/tests/layout/layout-group/+page.svelte` (+ child components in the same folder)
- `src/routes/tests/layout/layout-group-interrupt/+page.svelte`
- `src/routes/tests/layout/layout-group-unmount/+page.svelte`
- `src/routes/tests/layout/layout-group-unmount-list/+page.svelte`
- `src/routes/tests/layout/relative-children/+page.svelte` (port of the Jest fixture, driven by buttons and query params)
- `e2e/layout/layout-group-parity/*.spec.ts` (one spec file per upstream source file)
- `src/lib/components/layoutGroup.context.spec.ts` (modify: add the upstream id cases if missing)
- `src/routes/+page.svelte` (links)

**Out of scope**: all library source (`src/lib/**` except the one spec file).
Do not fix anything here; failing cases are the deliverable.

## Git workflow

- Branch `chore/motion-13.4.5`. Commit: `test(layout): port upstream LayoutGroup parity suite (Motion 13.4.5)`.
- Do NOT push or open a PR.

## Steps

### Step 1: Id-chaining unit parity

Compare `layoutGroup.context.spec.ts` against upstream `LayoutGroup.test.tsx`'s
four cases: `a` → `a`; nested `a`/`b` → `a-b`; `a` + `id={undefined}` → `a`;
`a` / `undefined` / `b` → `a-b`. Add any missing case using `LayoutGroupProbe`.

**Verify**: `pnpm exec vitest run src/lib/components/layoutGroup.context.spec.ts` → all pass (these are expected green today).

### Step 2: Port `layout-group` (+ spec with 3 cases)

Page: port `dev/react/src/tests/layout-group.tsx` exactly (500px column,
`MotionConfig transition={{ layout: { type: 'tween', duration: 1 } }}`,
`#expander-wrapper` `layout="position"`, `#expander` `layoutId` toggling height
25↔100 with its own `transition={{ type: 'tween' }}`, `#text-wrapper`
`layout="position"` containing text and `<LayoutGroup inherit="id">` around
`#button` (`layoutId`, toggles a 100×100 green box at the top of the column)).
Upstream wraps Expander in `motion.create(Fragment)` for variants; a plain
wrapper is fine — note it in a comment.

Spec `e2e/layout/layout-group-parity/layout-group.spec.ts`, viewport 500×500,
porting all three cases from upstream `layout-group.ts`: record `#button`
rounded top every rAF; assert settle tops (`104`, `129` → `204`, back to
initial) and that intermediate frames exist (no instant jump). Keep upstream's
numbers; if our page's static layout differs (e.g. font metrics), derive the
settle targets from measured static layouts in the test and assert
"intermediate frames exist" exactly as upstream does.

### Step 3: Port `layout-group-interrupt` (+ 2 specs)

Page: port `dev/react/src/tests/layout-group-interrupt.tsx` (10s linear tween
layout transition via `MotionConfig`, `#expander` `layoutId` toggling 25↔100,
`#text-wrapper` `layout="position"` with text that changes to "some longer
text" when visible, `<LayoutGroup inherit="id">` around `#button` which
toggles the green box).

Specs:
- `layout-group-interrupt.spec.ts`: port `layout-group-interrupt.ts`
  (mid-animation 20–90px wait via `expect.poll`; twice toggle `#expander` and
  assert `|Δtop| < 20`, `|Δleft| < 10`, `offsetTop ≈ initial ±1`; final `offsetTop ≈ initial ±1`).
- `layout-group-interrupt-measurements.spec.ts`: port
  `layout-group-interrupt-measurements.ts` using `page.addInitScript` to wrap
  `Element.prototype.getBoundingClientRect` and count reads per element `id`
  into `window.reads`; cases "doesn't re-measure a relative child that isn't
  animating" (`#button` reads 0 after each expander toggle) and "re-measures a
  layout-animating relative child once per parent re-layout" (click `#button`
  first; then `#button` reads exactly 1 per expander toggle). Dispatch clicks
  natively (`el.click()` in `page.evaluate`) so Playwright's actionability
  checks don't add reads. Our observers may read rects via other APIs; count
  only `getBoundingClientRect`, like upstream.

### Step 4: Port the unmount pair (from `layout-shared.ts`)

Pages: port `layout-group-unmount.tsx` and `layout-group-unmount-list.tsx`
exactly (nested `LayoutGroup id="group-1"` / `"group-2"`, `display: contents`
motion wrappers, `layoutId` boxes, `transition={{ duration: 0.2, ease: () => 0.5 }}` —
`ease: () => 0.5` freezes the animation at its midpoint, which is what the
bbox assertions rely on).

Spec `layout-group-unmount.spec.ts`:
- "Should trigger sibling animation when unmount": click `#a`, wait 50ms, `#b`
  bbox ≈ `{ top: 90, left: 20, width: 100, height: 100 }` (port upstream's
  `expectBbox` tolerance — read it at the top of `layout-shared.ts`).
- "If a sibling's position relative to the parent has changed, it should
  remain at its position": record `#b` bbox, click `#a`, wait 50ms, `#b` bbox unchanged.

### Step 5: Port `relative-child-measurements` as an e2e page

Page `src/routes/tests/layout/relative-children/+page.svelte` reproducing the
Jest `App`: `<LayoutGroup>` → `#expander` (`layout`, 10s linear tween, toggles
height 25↔100) and `#parent` (`layout`, 10s) containing N children each in
`<LayoutGroup inherit="id">` → `#child{i}` (`layout`, `data-shift` toggles
`margin-left` +100px). Query params: `children=N` (default 1),
`childTransition=long|short` (`short` = 0.05s). Buttons: `#toggle-expander`,
`#toggle-child{i}`. Use real layout (no mocks) with sizes matching the Jest
boxes (expander 100×25/100; parent 400×40; children 50×30 at left 50+20i).

Spec `relative-child-measurements.spec.ts`: port each Jest `test(...)` in
`relative-child-measurements.test.tsx` (read the file from line 146 to the
end for the exact sequence and assertions): count `getBoundingClientRect`
reads per id (init script as in Step 3) and assert the per-case counts, plus
the "doesn't jump" offset checks (child offset from `#parent` ≈ unchanged
across the expander toggle).

### Step 6: Record the red/green matrix and mark reds

Run `pnpm build && pnpm exec playwright test e2e/layout/layout-group-parity --project=chromium`.
For every failing test, change `test(` to `test.fail(` with the comment
`// Red on <date>: <one-line failure>. Plan 007 (LayoutGroup node groups) + Plan 006 (motion-dom 13.4.5) must turn this green.`
Do NOT loosen assertions to make anything pass.

Write the matrix into the README row for this plan and into a new section
"## LayoutGroup parity matrix" at the bottom of
`.agents/.plans/motion-13.4.5/README.md`: one line per test — `green` /
`red: <failure>`.

**Verify**: the same command → exit 0 (all tests either pass or are
expected failures). `pnpm check` → 0 errors.

### Step 7: Links + gate

Link all five pages from `src/routes/+page.svelte` next to `/tests/layout/scroll`.
`trunk fmt`; `trunk check`; `pnpm exec playwright test e2e/layout --project=chromium` → exit 0.

## Test plan

- This plan IS the red-first step for Plan 007. Expected reds on current code
  (hypotheses, to be confirmed by Step 6): interrupt jump/offset, both
  measurement-count specs, relative-children counts, possibly the unmount
  sibling case. Expected greens: id chaining, possibly `layout-group.ts`
  (our observers may already animate `#button`).
- Structural patterns: `e2e/layout/group.spec.ts`, `e2e/drag/transform-page-point.spec.ts` (frame sampling helpers).

## Done criteria

- [ ] 5 pages + 6 spec files exist; links added
- [ ] Parity run exits 0 with reds marked `test.fail` + comment
- [ ] README contains the LayoutGroup parity matrix
- [ ] No `src/lib` source file modified (`git diff --name-only -- src/lib | grep -v spec` → empty)

## STOP conditions

- A page can't be expressed with our public API (e.g. `layout="position"` on a
  wrapper that also needs `layoutId`) — report which prop combination.
- A test is flaky (passes/fails across 3 runs) — report rather than marking it
  `test.fail` (Playwright fails an expected-failure that passes).
- Measured static layout differs from upstream numbers by more than a few px
  for reasons other than fonts — report both sets.

## Maintenance notes

- Keep these specs one-to-one with upstream files so future bumps can diff
  `cypress/integration/layout-group*.ts` and port changes mechanically.
