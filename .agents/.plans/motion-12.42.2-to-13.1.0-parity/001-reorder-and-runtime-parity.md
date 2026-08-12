# Plan 001: Restore parity from Motion 12.42.2 through 13.1.0

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If a
> STOP condition occurs, stop and report rather than improvising. When complete,
> update this plan's row in the sibling `README.md`, unless a reviewer says they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 96b166c..HEAD -- package.json pnpm-lock.yaml src/lib/components/Reorder src/routes/+page.svelte src/routes/tests/reorder e2e/reorder docs/src/routes/docs/reorder docs/src/routes/examples/reorder docs/src/lib/examples/reorder README.md`
> If an in-scope file changed, compare it with the Current state section before
> proceeding. A semantic mismatch is a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none
- **Category**: migration
- **Planned at**: commit `96b166c`, 2026-08-12

## Why this matters

This project describes itself as a Framer Motion-compatible animation library.
Its checked-in dependency baseline was Motion 12.42.2, while the package-update
branch is moving `motion` to 13.1.0 and `motion-dom` to 13.0.0. Most of the
12.43/13.0 runtime improvements are inherited through `motion-dom`, but Motion
13.1 changes the public `Reorder` contract and algorithm: automatic axis
detection, wrapped two-dimensional layouts, and RTL-aware insertion. Svelte
Motion owns a local Reorder port, so the dependency update alone does not provide
those features.

After this plan, Svelte Motion will expose and document the Motion 13.1 Reorder
behavior, retain its Svelte-specific unmount and auto-scroll behavior, and have
focused regression gates for the Motion DOM changes inherited by the major bump.

## Upstream delta being tracked

Reference source: the local Motion repository at `/Users/jasonkummerl/Github/motion`
and tags `v12.42.2`, `v12.43.0`, `v13.0.0`, and `v13.1.0`. If that checkout is
unavailable, use the same tags in `motiondivision/motion` on GitHub. Do not copy
React lifecycle mechanics literally; port observable behavior into existing
Svelte conventions.

| Release | Upstream change                                                                            | Required Svelte Motion treatment                                                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 12.43.0 | WAAPI acceleration for `backgroundColor`/`color`                                           | Inherited from `motion-dom`; run existing color/will-change tests and add a focused regression only if coverage cannot observe the new path.                                   |
| 12.43.0 | WAAPI acceleration for SVG                                                                 | Inherited through `SVGVisualElement`; run focused SVG tests/e2e.                                                                                                               |
| 12.43.0 | AnimatePresence child ordering fix                                                         | React reconciliation-specific; verify existing Svelte mode tests, but do not port React internals.                                                                             |
| 12.43.0 | Actionable invalid custom-ref error                                                        | React custom-component-ref-specific; not applicable to Svelte's generated motion elements.                                                                                     |
| 13.0.0  | Remove automatic `@emotion/is-prop-valid` loading; add explicit `MotionConfig.isValidProp` | React DOM prop filtering-specific; not applicable. Do not add `isValidProp` to Svelte `MotionConfig`.                                                                          |
| 13.0.0  | Correct final SVG styles after accelerated animation                                       | Inherited from `motion-dom`; add/adjust a focused SVG final-style regression if current coverage does not assert completion state.                                             |
| 13.0.0  | Complete propagated exits with no motion children                                          | The Svelte presence implementation is independent; run existing propagation/exit coverage and add a regression only if the equivalent public behavior exists and is uncovered. |
| 13.1.0  | Multidimensional Reorder, automatic axis detection, RTL                                    | Port into the local Svelte Reorder implementation, with unit, component, demo, docs, and e2e coverage.                                                                         |

## Current state

- `package.json:139-142` — the pending update declares `motion: ^13.1.0` and
  `motion-dom: ^13.0.0`; before the working-tree package update, commit `96b166c`
  declared Motion 12.42.2.
- `src/lib/components/Reorder/types.ts:12-30` — `axis` accepts only `'x' | 'y'`
  and documents a default of `'y'`.
- `src/lib/components/Reorder/context.ts:14-17` — `ItemData.layout` stores only
  one `Axis`; Motion 13.1 stores the complete `Box`.
- `src/lib/components/Reorder/context.ts:30-49` — context passes scalar offset
  and velocity; Motion 13.1 passes `{ x, y }` points and supports axis `'xy'`.
- `src/lib/components/Reorder/Group.svelte:24-33` — the group eagerly defaults
  `axis = 'y'`, which prevents automatic detection.
- `src/lib/components/Reorder/Group.svelte:43-75` — a persistent, axis-sorted
  array is updated with one-dimensional layouts and translated back through
  `applyOrderSwap`.
- `src/lib/components/Reorder/Item.svelte:61-67` — drag reporting selects one
  axis before calling the group and auto-scroll helper.
- `src/lib/components/Reorder/checkReorder.ts:40-68` — only adjacent scalar-axis
  swaps are implemented.
- `docs/src/routes/docs/reorder/+page.svx:74-80,150-176` — docs state that
  Reorder is single-axis and explicitly claim wrapped grids are unsupported.

The implementation intentionally differs from React in two places and must keep
doing so:

1. `Reorder.Group` maintains a persistent registry, and `Reorder.Item` explicitly
   unregisters on teardown (`context.ts:23-28`, `Item.svelte:75-77`).
2. Svelte Motion adds edge auto-scroll (`autoScroll.ts`), which upstream React
   Reorder does not own. Preserve single-axis behavior and define a deliberate,
   tested policy for `axis="xy"` rather than deleting it.

Public APIs and exported types require Google-style JSDoc. Unit tests colocate as
`*.spec.ts`; Svelte component harnesses live under `__tests__`; browser fixtures
live under `src/routes/tests/<feature>/`; each fixture has an e2e file under
`e2e/<feature>/`. Documentation examples use reusable components below
`docs/src/lib/examples/<feature>/` and public pages below `docs/src/routes/`.

## Commands you will need

| Purpose                    | Command                                                                                    | Expected on success                        |
| -------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------ |
| Install                    | `pnpm install --frozen-lockfile --config.engine-strict=false`                              | exit 0                                     |
| Focused Reorder unit tests | `pnpm test:only -- src/lib/components/Reorder`                                             | all tests pass                             |
| Typecheck                  | `pnpm check`                                                                               | exit 0, no errors                          |
| Package validation         | `pnpm package`                                                                             | exit 0 and publint passes                  |
| Focused Reorder e2e        | `pnpm exec playwright test e2e/reorder`                                                    | all tests pass                             |
| Motion DOM regression e2e  | `pnpm exec playwright test e2e/svg e2e/animate-presence e2e/utilities/will-change.spec.ts` | all selected tests pass                    |
| Unit suite                 | `pnpm test`                                                                                | exit 0                                     |
| Full e2e suite             | `pnpm test:e2e`                                                                            | exit 0                                     |
| Lint                       | `trunk check`                                                                              | exit 0                                     |
| Format verification/fix    | `trunk fmt`                                                                                | formatter completes; review resulting diff |
| Docs build                 | `pnpm --dir docs run build`                                                                | exit 0                                     |

If the locally installed pnpm wrapper reports that `@pnpm/exe.darwin-x64` is
missing from `pnpm-lock.yaml`, STOP and report the environment problem. Do not
edit the lockfile manually or weaken supply-chain settings to bypass it.

## Scope

**In scope** (create files where named):

- `src/lib/components/Reorder/Group.svelte`
- `src/lib/components/Reorder/Item.svelte`
- `src/lib/components/Reorder/types.ts`
- `src/lib/components/Reorder/context.ts`
- `src/lib/components/Reorder/checkReorder.ts`
- `src/lib/components/Reorder/checkReorder.spec.ts`
- `src/lib/components/Reorder/detectAxis.ts` and `detectAxis.spec.ts`
- `src/lib/components/Reorder/order.ts` and `order.spec.ts`
- Relevant Reorder component harnesses/specs under
  `src/lib/components/Reorder/__tests__/` and `reorder.component.spec.ts`
- `src/lib/components/Reorder/autoScroll.ts` and its spec, only if needed to
  support a documented `xy` policy
- `src/routes/tests/reorder/axis-auto/+page.svelte` (create)
- `src/routes/tests/reorder/grid/+page.svelte` (create)
- `src/routes/tests/reorder/rtl/+page.svelte` (create)
- Matching `e2e/reorder/axis-auto.spec.ts`, `grid.spec.ts`, and `rtl.spec.ts`
- `src/routes/+page.svelte`
- `docs/src/routes/docs/reorder/+page.svx`
- `docs/src/routes/examples/reorder/+page.svelte` and `+page.ts`
- Reusable examples under `docs/src/lib/examples/reorder/`
- `docs/src/lib/examplesIndex.ts` only if required to surface a new example
- `README.md` parity description
- Focused existing SVG, AnimatePresence, or will-change test files only when
  Step 2 proves the inherited Motion DOM behavior is otherwise unobserved
- `package.json` and `pnpm-lock.yaml` only to retain/complete the already-requested
  Motion 13.1.0 / motion-dom 13.0.0 dependency update

**Out of scope**:

- Porting React reconciliation, refs, `@emotion/is-prop-valid`, or React
  `MotionConfig` internals
- Replacing Svelte Motion's drag, projection, or presence architecture
- Removing edge auto-scroll or persistent unregister behavior
- Unrelated dependency upgrades or formatting unrelated files
- Editing `/Users/jasonkummerl/Github/motion`; it is read-only reference material
- Publishing packages, pushing, or opening a PR

## Git workflow

- Continue on the operator's package-update branch unless instructed otherwise.
- Use conventional commits, matching recent history such as
  `feat(svg): route SVG attributes and path drawing through the SVGVisualElement`.
- Prefer one logical commit for Reorder runtime/tests and one for docs/examples if
  the operator wants multiple commits. Do not push or open a PR without instruction.

## Steps

### Step 1: Add red tests for the Motion 13.1 Reorder contract

Update `checkReorder.spec.ts` fixtures to use complete `Box` layouts and point
offset/velocity values, then add assertions for:

1. Existing vertical and horizontal midpoint swaps remain unchanged.
2. `axis="xy"` moves an item within a row toward the closest neighboring box.
3. Crossing into another row inserts before/after the closest horizontal slot.
4. RTL reverses horizontal insertion direction for both `x` and `xy`.
5. Unknown values, zero relevant-axis velocity, boundaries, and unchanged
   positions return the same array reference.
6. Reordering measured items preserves positions reserved for unmeasured values.

Create `detectAxis.spec.ts` covering vertical stacks (`y`), horizontal rows (`x`),
wrapped/overlapping layouts (`xy`), one/zero measured items, and boundary-touching
boxes. Add component/type coverage proving omitted `axis` is accepted and
`axis="xy"` reaches each item as `drag={true}` or equivalent two-axis drag.

Model the expected algorithm on Motion 13.1's:

- `packages/framer-motion/src/components/Reorder/utils/check-reorder.ts`
- `packages/framer-motion/src/components/Reorder/utils/detect-axis.ts`
- `packages/framer-motion/src/components/Reorder/__tests__/index.test.tsx`
- `packages/framer-motion/cypress/integration/reorder-grid.ts`

Do not weaken existing Svelte tests to make the new signatures compile.

**Verify**: `pnpm test:only -- src/lib/components/Reorder` must FAIL because the
current API lacks full boxes/points, `xy`, automatic detection, and RTL behavior.
If all new assertions pass before implementation, STOP: the test does not capture
the parity gap.

### Step 2: Port the full-box data model and automatic axis detection

In `types.ts`, export a documented `ReorderAxis = 'x' | 'y' | 'xy'`; make
`ReorderGroupProps.axis` optional without claiming a fixed default. In
`context.ts`, store full `Box` layouts and accept point offset/velocity. Use the
project's existing `Box`/point-compatible types rather than introducing duplicate
geometry shapes.

Create `detectAxis.ts` as a small pure function based on upstream 13.1. Detect:

- `y` when item boxes are separated vertically but overlap horizontally,
- `x` when separated horizontally but overlap vertically,
- `xy` when the measured geometry forms wrapped/multidimensional placement.

For insufficient measurements, retain upstream's safe initial behavior (`y`)
until enough boxes are registered. In `Group.svelte`, distinguish an explicit
axis override from the detected axis, store complete layouts keyed by value, prune
entries absent from `values`, and recompute detection in `values` order. Preserve
explicit unregister behavior for Svelte teardown.

**Verify**: `pnpm test:only -- src/lib/components/Reorder/detectAxis.spec.ts src/lib/components/Reorder/reorder.component.spec.ts` exits 0.

### Step 3: Port multidimensional and RTL reorder decisions

Change `checkReorder` to accept `(order, value, offsetPoint, velocityPoint, axis,
direction = 'ltr')`. Port the upstream 13.1 behavior:

- For `x`/`y`, retain midpoint crossing and relevant-axis velocity semantics.
- For `xy`, calculate the dragged box center plus live offset, cluster overlapping
  boxes into visual rows, choose the closest row by vertical distance, then choose
  the insertion position by box/center distance.
- For RTL, reverse horizontal before/after comparisons without reversing the
  consumer's `values` array.
- Preserve same-reference returns when no reorder occurs.

In `Group.svelte`, derive direction from the rendered group's computed style via
its owner window, defaulting to `ltr` for SSR/no element. Build measured order in
the consumer's `values` order. Update `order.ts` so an arbitrary measured reorder
(not merely one adjacent swap) is mapped back onto the measured slots in the full
`values` array, preserving all unmeasured values.

**Verify**: `pnpm test:only -- src/lib/components/Reorder/checkReorder.spec.ts src/lib/components/Reorder/order.spec.ts` exits 0.

### Step 4: Feed both drag axes through Reorder.Item and preserve auto-scroll

In `Item.svelte`, pass both live offsets and both velocity components to
`context.updateOrder`. Explicit `x` and `y` axes must keep their current drag lock;
`xy` must enable two-axis dragging in the form accepted by this project's drag
API (likely `drag={true}`, not the literal string `"xy"`). An item-level `drag`
override must retain the current public behavior.

Define and test edge auto-scroll for `xy`: select the dominant active velocity
axis on each drag frame, or make two independent axis calls only if
`autoScroll.ts` and actual scroll containers safely support it. Prefer the
dominant-axis policy because it prevents diagonal double-scrolling. Document the
chosen policy in code JSDoc and public docs.

**Verify**: `pnpm test:only -- src/lib/components/Reorder` exits 0.

### Step 5: Add three focused browser fixtures and e2e coverage

Create and link these pages from `src/routes/+page.svelte`:

1. `/tests/reorder/axis-auto`: omit `axis`; provide controls or two groups proving
   horizontal and vertical geometry is detected. Assert dragging changes the
   correct order without perpendicular drift.
2. `/tests/reorder/grid`: a wrapped 2D grid using `axis="xy"`; assert moving an
   item across a row boundary updates DOM/value order and displaced siblings FLIP.
3. `/tests/reorder/rtl`: an RTL horizontal or wrapped group; assert dragging in
   visual directions produces the expected logical value order.

Each page must expose stable test IDs/current-order text and follow the pointer
interaction patterns in existing `e2e/reorder/*.spec.ts`. Avoid screenshot-only
assertions; assert value order and final transforms/positions after settling.

**Verify**: `pnpm exec playwright test e2e/reorder/axis-auto.spec.ts e2e/reorder/grid.spec.ts e2e/reorder/rtl.spec.ts` exits 0.

### Step 6: Update public documentation and reusable examples

Update `docs/src/routes/docs/reorder/+page.svx` to document omitted-axis automatic
detection, explicit `'x' | 'y' | 'xy'`, wrapped grids, RTL, and the `xy`
auto-scroll policy. Remove the stale statement that wrap-around grids are not
supported and update the props table/JSDoc accurately.

Add reusable grid and RTL/auto-axis demos under
`docs/src/lib/examples/reorder/demos/` and surface them on the existing public
Reorder example route. Update the root README parity row so it identifies Motion
13.1 parity rather than merely saying Reorder is supported.

The examples should recreate the Motion 13.1 "WOW" behavior: one continuous drag
moves a tile horizontally and vertically across wrapped rows while every displaced
tile springs into its new slot; the RTL example should feel visually correct
without consumers reversing their data.

**Verify**: `pnpm --dir docs run build` exits 0 and `pnpm check` exits 0.

### Step 7: Characterize inherited Motion 12.43/13.0 runtime behavior

Run the focused existing suites for SVG, color/will-change, and AnimatePresence.
Inspect whether they assert these observable outcomes:

- an accelerated SVG animation applies its exact final CSS/attribute state,
- `backgroundColor`/`color` is accepted by the accelerated/will-change path,
- interrupted/synchronized presence does not reorder surviving keyed children,
- a propagated exit with no motion descendant completes if Svelte Motion exposes
  equivalent behavior.

Only add focused regressions in existing relevant test files for missing
observable coverage. Do not port React-specific implementation tests and do not
invent a Svelte `isValidProp` API.

**Verify**: `pnpm exec playwright test e2e/svg e2e/animate-presence e2e/utilities/will-change.spec.ts` exits 0, and any newly touched unit specs pass via `pnpm test:only -- <files>`.

### Step 8: Run the complete release gate

Run formatting before the final checks, review that it touched only scoped files,
then run all repository validation.

**Verify**, in order:

1. `trunk fmt` completes; `git status --short` lists only in-scope files plus any
   operator-owned pre-existing modifications.
2. `trunk check` exits 0.
3. `pnpm check` exits 0.
4. `pnpm package` exits 0 and publint passes.
5. `pnpm test` exits 0.
6. `pnpm test:e2e` exits 0.
7. `pnpm --dir docs run build` exits 0.
8. `git diff --check` exits 0.

Follow the repository's failed-e2e workflow: review failures one page at a time
in the in-app browser, explain expected behavior, assertion, and visible state,
then decide with the operator whether behavior or test is wrong before editing.

## Test plan

- Red-first anchor: the full-box/point, `xy`, auto-axis, and RTL unit/component
  tests in Step 1 must fail against the current one-dimensional implementation.
- Pure unit coverage: `detectAxis`, `checkReorder`, and measured-to-full-values
  mapping, including empty/single layouts, row boundaries, RTL, same-reference
  no-ops, and virtualized/unmeasured entries.
- Component coverage: omitted axis, explicit override, `xy` drag wiring, reactive
  values, unmount cleanup, item drag override, and existing auto-scroll behavior.
- E2E coverage: one test file for each new test/demo page, asserting data/DOM order
  and settled positions after realistic pointer movement.
- Compatibility coverage: existing SVG, AnimatePresence, and will-change suites;
  add tests only for an upstream observable outcome not already asserted.

## Done criteria

- [ ] `package.json` resolves `motion` 13.1.0 and `motion-dom` 13.0.0 through the lockfile.
- [ ] Public `ReorderAxis` is documented and equals `'x' | 'y' | 'xy'`.
- [ ] Omitting `axis` automatically detects horizontal, vertical, and wrapped layouts.
- [ ] `axis="xy"` reorders within and across wrapped rows.
- [ ] Horizontal and wrapped reordering behave correctly in RTL without reversing `values`.
- [ ] Unmeasured values, Svelte unregistration, item drag overrides, and edge auto-scroll remain covered and passing.
- [ ] Three new test/demo routes exist, are linked from `src/routes/+page.svelte`, and each has a passing e2e spec.
- [ ] Public Reorder docs/examples describe and demonstrate the Motion 13.1 behavior.
- [ ] Motion 12.43/13.0 inherited SVG/color/presence outcomes have passing focused regression coverage.
- [ ] `trunk check`, `pnpm check`, `pnpm package`, `pnpm test`, `pnpm test:e2e`, and the docs build exit 0.
- [ ] `git diff --check` exits 0 and no out-of-scope files are modified.
- [ ] The sibling batch `README.md` status is updated.

## STOP conditions

Stop and report if:

- The dependency update resolves versions other than Motion 13.1.0 and
  motion-dom 13.0.0.
- Upstream tag `v13.1.0` no longer matches the algorithms described here.
- Supporting `xy` requires redesigning the core drag or projection systems rather
  than adapting Reorder's context/data flow.
- Auto-scroll cannot safely support a documented dominant-axis policy without
  changes outside `src/lib/components/Reorder/`.
- Existing public behavior for item-level `drag` overrides cannot be preserved.
- A newly written red test passes on the old one-dimensional implementation.
- A verification command fails twice after a reasonable correction.
- The pnpm executable identity error described above blocks installation.
- Completing the work requires an out-of-scope file not explicitly allowed here.

## Maintenance notes

- Future Motion Reorder changes should be diffed from `v13.1.0`, not from the old
  12.42.2 port, because the stored layout and callback signatures change here.
- Review row clustering carefully for variable-height items and boxes that only
  touch at their boundaries; match upstream tests before adding local heuristics.
- Review RTL using computed direction on the group, not document direction, so
  nested direction changes work.
- Keep React-only release notes classified as not applicable unless Motion moves
  the behavior into `motion-dom` or Svelte Motion exposes an equivalent API.
- This plan deliberately does not redesign general-purpose grid drag-and-drop;
  it implements Motion's lightweight `Reorder` semantics only.
