# Plan 001: Align with Motion 13.5.1

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.5.1/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Gate (run first)**: `npm view motion@13.5.1 version` must print `13.5.1`.
> If it doesn't, STOP: this plan is BLOCKED. If upstream skipped 13.5.1 and
> published a higher 13.5.x or 13.6.0 instead, STOP and report the version. The
> advisor must re-audit the delta first. (This happened once: 13.4.7 was tagged
> but never published, and upstream shipped 13.5.0.)
>
> **Dependency check**: `grep -rn "getBaseTarget(" src/lib` must return no
> matches outside `src/lib/utils/baseTarget.spec.ts`. If `_MotionContainer.svelte`
> still calls it, STOP: plan `.agents/.plans/motion-13.5.0/001-whilepan-base-target.md`
> must land first, or `whilePan` throws after this bump.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (motion-dom rewrites `animateChanges` and VisualElement variant-tree registration)
- **Depends on**: `motion-13.5.0/001` DONE, plus Motion 13.5.1 on npm
- **Category**: migration
- **Planned at**: commit `9eba7a61`, 2026-10-01 (upstream audited to `e7f7cfe6f`)

## Why this matters

svelte-motion mirrors upstream Motion versions. The unreleased 13.5.1 work
(upstream `v13.5.0..origin/main`, 13 commits) changes code our components run
directly through motion-dom:

- `animation-state.ts` is rewritten around one mount policy
  (`bf5947613`, `5114f0074`, `69f4acd31`). `VisualElement.getBaseTarget`,
  `addVariantChild`, and `getClosestVariantNode` are removed, and `baseTarget` and
  `initialValues` become public fields.
- VisualElement variant-tree registration now skips `inherit={false}` nodes (`b63833cb0`).
- `svgEffect` routes transforms and origins (`x`, `y`, `scale`, `rotate`,
  `originX`, …) through **style** instead of attributes (`98f4dcaf1`, PR #3876).
  `readSVGValue` falls back to the attribute when computed style is empty (`2165b4c9c`, PR #3878).
- `MotionValueState` keeps a rebound entry when the replaced binding is removed (`dc74b6be6`).

The public `AnimationState` interface is unchanged, so this should be a
dependency-only bump. Behavior differences must surface in our tests.

## Current state

- `package.json`: `"motion": "^13.5.0"`, `"motion-dom": "^13.5.0"`.
- `pnpm-workspace.yaml` exempts the motion family from the 48h `minimumReleaseAge`.
- The repo uses pnpm **12.6.0**, which has no `--save-prefix` flag; caret is the default.
- Our `svgEffect` is a straight re-export (`src/lib/utils/effects.ts`:
  `export const svgEffect: ElementEffect = svgEffectCore as ElementEffect`).
  Motion components render bound SVG values through `SVGVisualElement`, not
  `svgEffect` (see the header comment in `e2e/svg/motion-value-attributes.spec.ts`).
  So the routing change mostly affects users who call `svgEffect` directly.
- Previous bump exemplar: commit `3fd44585` ("feat: align with Motion 13.5.0 …")
  and `.changeset/motion-13-5-0.md`.

## Commands you will need

| Purpose        | Command                                                                       | Expected                                  |
| -------------- | ----------------------------------------------------------------------------- | ----------------------------------------- |
| Bump           | `pnpm --filter @humanspeak/svelte-motion update motion@13.5.1 motion-dom@13.5.1` | manifest `^13.5.1` for both              |
| Frozen install | `pnpm install --frozen-lockfile`                                              | exit 0, no tracked changes                |
| Tree           | `pnpm list motion motion-dom framer-motion motion-utils --depth 3`           | all four at 13.5.1 (or report actuals)    |
| Build          | `pnpm build`                                                                  | exit 0, publint "All good!"               |
| Types / units  | `pnpm check` ; `pnpm test:only`                                               | 0 errors ; all pass                       |
| Consumer       | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`                  | 3 "…passed." lines                        |
| Docs           | `pnpm --dir docs build` then `pnpm --dir docs check`                          | exit 0 / 0 errors                         |
| Full e2e       | `pnpm exec playwright test --reporter=line`                                   | 0 failed (baseline: 567 passed, 2 skipped at 13.5.0) |

Port 4198 is the maintainer's sign-off port. Never kill it. If it is busy,
report e2e as blocked. The docs build may rewrite `docs/static/r/*.json`
(Tailwind class re-sorting by the registry generator). Restore those with
`git checkout -- docs/static/r` when the source components didn't change.

## Scope

**In scope:** `package.json` (motion and motion-dom lines only), `pnpm-lock.yaml`,
`src/lib/utils/effects.spec.ts` (or the existing spec that covers `svgEffect`;
create `effects.svgRouting.spec.ts` if none fits), `.changeset/motion-13-5-1.md`
(create), and the README status row.

**Out of scope:** library source changes. If the bump needs one, STOP and report
with the failing test. The `inherit={false}` feature work is plan 002.

## Steps

### Step 1: Bump

Run the Bump command, then the frozen install and the Tree command. Inspect every
`pnpm-lock.yaml` hunk: only motion, framer-motion, motion-dom, and motion-utils
entries may change.

**Verify**: the manifest shows `^13.5.1` for both, the tree matches, and
`git status` shows only `package.json` and `pnpm-lock.yaml`.

### Step 2: Pin the `svgEffect` routing change

Add a unit test (jsdom): create an `SVGRectElement`
(`document.createElementNS('http://www.w3.org/2000/svg', 'rect')`), call
`svgEffect(rect, { x: motionValue(10) })`, and flush a frame. Then assert that
`rect.getAttribute('x')` is `null` and `rect.style.transform` contains
`translateX(10px)`. Add a control: `svgEffect(rect, { attrX: motionValue(5) })`
writes the `x` **attribute** `5`. Model the frame flush on existing effect specs:
`grep -rn "svgEffect\|styleEffect" src/lib --include=*.spec.ts`.

**Verify**: the new tests pass on 13.5.1. Temporarily reinstall 13.5.0
(`git stash` the lockfile, or check out the previous lock) to confirm the `x` case
behaves differently there. If you can't do that cleanly, skip the confirmation
and say so in the report.

### Step 3: Full gate

Run every command-table row, serialising the root build, docs build, and
Playwright build.

**Verify**: all pass. For **any** e2e failure, STOP and report the spec, test
name, and verbatim assertion. Do not edit tests to match new behavior. The
maintainer reviews e2e failures page by page (CLAUDE.md "Failed e2e review workflow").

### Step 4: Changeset

Create `.changeset/motion-13-5-1.md` (patch). It should say: "Update Motion and
motion-dom to 13.5.1. `svgEffect` now writes transforms and transform origins on
SVG elements as CSS (for example `x` becomes `translateX`) instead of SVG
attributes, matching Motion. Use `attrX`/`attrY` for the attributes." Never bump
the package version and never add minor/major labels. Versions mirror upstream.

**Verify**: `trunk check --no-fix .changeset/motion-13-5-1.md package.json` is clean.

## Test plan

- This is a dependency bump, so there is no red step. Upstream behavior changes
  are pinned by the new `svgEffect` routing test (Step 2).
- Regression: full unit, consumer (tree-shaking), docs build, and the full e2e
  suite against the 567/2 baseline.

## Done criteria

- [ ] Gate passes; motion and motion-dom are `^13.5.1`; lock and tree match; frozen install is clean
- [ ] `grep -rn "getBaseTarget(" src/lib` → only `baseTarget.spec.ts`
- [ ] svgEffect routing tests pass
- [ ] build, check, test:only, consumer, docs build/check, and full e2e pass (0 failed)
- [ ] Changeset added; root `version` unchanged; README row updated

## STOP conditions

- The gate fails, or the published version isn't exactly 13.5.1.
- `motion-13.5.0/001` isn't DONE.
- The lockfile changes anything beyond the motion family.
- Any e2e failure, or any need for a library source change.

## Maintenance notes

- After this lands, simplify `src/lib/utils/baseTarget.ts`. Its cast to
  `baseTarget`/`initialValues` is no longer needed, since they're public in 13.5.1.
- Plan 002 (`inherit={false}`) depends on this bump's VisualElement changes.
