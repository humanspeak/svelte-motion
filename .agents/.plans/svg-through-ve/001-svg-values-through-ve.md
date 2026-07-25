# Plan 001: Route SVG attributes and path drawing through the SVGVisualElement

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `.agents/.plans/svg-through-ve/README.md`.
>
> **Drift check (run first)**: `git diff --stat f183b74..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/svg.ts src/lib/utils/effects.ts`
> Expect empty. Re-stamped 2026-07-25: PR #454 squash-merged the entire
> visual-element-core batch (incl. plan 006) into main as `f183b74`; the
> original per-plan SHAs no longer exist in this branch's history. All
> excerpts below were re-verified against `f183b74` — the cited container
> line numbers hold. The archived batch records live at
> `.agents/.plans-closed/visual-element-core/`. Any drift vs the excerpts
> is a STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — `e2e/svg` is fully green today; this migration must be
  behavior-neutral, and it trades working bespoke code for upstream machinery
- **Depends on**: visual-element-core batch (MERGED to main in PR #454, `f183b74`)
- **Category**: tech-debt (deferred from visual-element-core plan 002 Step 6
  by guard ruling; GitHub issue #449 follow-up)
- **Planned at**: commit `f183b74`, 2026-07-25 (re-stamped post-squash-merge)

## Why this matters

SVG elements already get an `SVGVisualElement` (the container passes `isSVG`
at creation), and their style-channel animation flows through the
animationState like HTML — but their ATTRIBUTE channel and path drawing still
run on a legacy side path: `svgEffect` subscribes MotionValue-bound attrs
directly, and `transformSVGPathProperties` hand-converts
`pathLength`/`pathOffset` into `stroke-dasharray`/`stroke-dashoffset` at two
remaining call sites. `SVGVisualElement` does all of this natively
(`buildSVGAttrs` + `buildSVGPath` handle `pathLength`/`pathSpacing`/
`pathOffset`; `renderSVG` writes attrs), so the side path is duplicate
machinery — the last non-drag writer outside the VisualElement. Removing it
completes the single-writer story for SVG and deletes ~2 conversion layers.

## Current state

(All excerpts re-verified at `f183b74`.)

- **The attr side channel** — `_MotionContainer.svelte:1399-1430`: MotionValue
  SVG attributes are split out of the prop spread
  (`svgMotionValueAttrs`, `:1406`) and bound via
  `return svgEffect(element, values)` (`:1430`), with a comment noting the
  seed/race design ("`svgEffect` owns" the keys, `:1414-1415`).
- **Path-drawing conversion, call site 1** — key-change rewind,
  `:2863-2869`: `transformSVGPathProperties(element, keyChangeInitialKeyframes)`
  then direct dash-attribute writes ("the VE's … rewind cannot; keep writing
  them directly").
- **Path-drawing conversion, call site 2** — mount seed, `:2984-2990`:
  `transformSVGPathProperties(element!, initialKeyframes)` + synchronous
  `stroke-dasharray`/`stroke-dashoffset` attribute writes "that prevent a
  mount flash".
- **The Step-6 skip marker** — `:1270-1274`: "SVG path HANDLING itself is
  untouched per the Step 6 skip ruling: `svgEffect`,
  `transformSVGPathProperties`, `readSVGPathDrawingState` and the
  mount-effect dash-attribute seeding all remain, and `e2e/svg` stays green."
- Helpers: `transformSVGPathProperties` at `src/lib/utils/svg.ts:441`;
  `svgEffect` re-export at `src/lib/utils/effects.ts:81`; SSR attr values via
  `computeSSRSVGAttrValues` / `computeNormalizedSVGInitialAttrs`
  (imports at `:124-125`).
- **Installed motion-dom surface** (12.42.2,
  `node_modules/motion-dom/dist/index.d.ts`): `SVGVisualElement` (class,
  `:4150-4162`), `SVGRenderState extends HTMLRenderState { attrs }`
  (`:1211-1217`), exported `buildSVGAttrs`, `renderSVG`,
  `scrapeSVGMotionValuesFromProps`. Upstream reference for pathLength
  semantics: `~/Github/motion/packages/motion-dom/src/render/svg/utils/path.ts`
  (`buildSVGPath` — writes `stroke-dasharray`/`stroke-dashoffset` from
  `pathLength`/`pathSpacing`/`pathOffset`, normalized to a 0–1 path length)
  and `build-attrs.ts` (attr vs style routing, `attrX`/`attrY`/`attrScale`).
- **Constraint ledger applies** (visual-element-core plan 002 revisions
  #4–#9): never memoize style-slot reads; never skip the first
  `animateChanges()` pass; `scheduleRenderMicrotask()` for flushes;
  the adapter's `updateOptions` stays untracked; VE creation reads must be
  declared above the creation block (TDZ — bit three times).
- Verification commands: trunk is the lint authority (`trunk fmt` /
  `trunk check`); `pnpm check`, `pnpm test:only`, `pnpm test:e2e <dirs>`.

## Commands you will need

| Purpose     | Command                                                    | Expected         |
| ----------- | ---------------------------------------------------------- | ---------------- |
| Typecheck   | `pnpm check`                                               | 0 errors         |
| Unit        | `pnpm test:only`                                           | all pass         |
| SVG e2e     | `pnpm test:e2e e2e/svg`                                    | all pass         |
| Gate        | `pnpm test:e2e e2e/svg e2e/motion e2e/vanilla-values`      | all pass         |
| SSR pin     | `pnpm test:only src/lib/html/_MotionContainer.ssr.spec.ts` | passes unchanged |
| Format/lint | `trunk fmt` / `trunk check`                                | no new issues    |

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (attr routing into VE props; delete
  the `svgEffect` subscription and both `transformSVGPathProperties` call
  sites where the VE takes over)
- `src/lib/utils/svg.ts` (delete helpers that go unreferenced — grep first)
- `src/lib/utils/effects.ts` (`svgEffect` re-export STAYS — it is public API
  via `src/lib/index.ts`; only the container's internal use goes)
- `src/lib/utils/visualElementCore.ts` (only if SVG props scraping needs the
  SVG scraper selected — it already branches on `isSVG`; verify, don't assume)
- New/updated colocated specs for changed units
- `.agents/.plans/svg-through-ve/README.md`

**Out of scope**:

- Public API: `svgEffect` export, `MotionPath`-style types, docs pages.
- Drag/layout files; the presence clone path.
- `e2e/svg` spec assertions — if one seems wrong, STOP and report.

## Git workflow

- Branch from the current integration branch (operator names it at dispatch);
  conventional commits (`feat(svg): …`); never push; never reset past commits
  you did not author.

## Steps

### Step 1: Characterization baseline

`pnpm test:e2e e2e/svg` + `pnpm test:only` — record counts. Read the whole
`e2e/svg` directory's specs first; note which assert ATTRIBUTE values (these
pin the output format your migration must reproduce, e.g.
`stroke-dasharray` exact strings).

**Verify**: all green, counts recorded.

### Step 2: Attrs into the VE props

For SVG elements, carry the motion-value attribute map into
`buildMotionNodeProps()` the way upstream SVG props are shaped (top-level
attr keys — see `scrapeSVGMotionValuesFromProps`), so
`updateMotionValuesFromProps` binds them and `buildSVGAttrs`/`renderSVG`
write them. Then delete the container's `svgEffect` subscription
(`:1399-1430` region). Preserve the SSR normalization
(`computeSSRSVGAttrValues`) — SSR has no VE.

**Verify**: `pnpm test:e2e e2e/svg` → all pass;
`pnpm test:only src/lib/html/_MotionContainer.ssr.spec.ts` → unchanged.

### Step 3: pathLength through the render state

Stop pre-converting `pathLength`/`pathOffset` in animation targets: let the
raw keys reach the animationState and `buildSVGPath` do the conversion at
render time. Replace the two `transformSVGPathProperties` call sites: the
mount seed (`:2984`) becomes a `latestValues`-seeded first render (the VE
composes the dash attrs) — keep a synchronous pre-hydration guard ONLY if
Step 1's specs show a mount flash without it; the key-change rewind
(`:2863`) jumps the raw `pathLength` values and lets the render convert.
Check upstream normalization: motion-dom's `pathLength` is 0–1 normalized
with `pathSpacing` — if our public API's `pathLength` semantics differ
(inspect `svg.ts:441` conversion and the e2e expectations), preserve OUR
semantics at the props boundary and STOP if that requires resolver changes.

**Verify**: `pnpm test:e2e e2e/svg` → all pass, including path-drawing specs
with byte-identical attribute assertions.

### Step 4: Delete dead helpers + full gate

`grep -rn "transformSVGPathProperties\|readSVGPathDrawingState" src/` — delete
helpers with zero remaining references (public exports stay). Then
`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` →
`pnpm test:e2e e2e/svg e2e/motion e2e/vanilla-values`.

**Verify**: all green; deletions justified by grep output in the report.

## Test plan

- No red-first test: behavior-preserving migration; Step 1's `e2e/svg`
  baseline (attribute-exact assertions included) is the pin.
- New unit coverage: attr-routing through `buildMotionNodeProps` for SVG
  (assert scraped values land on `ve.values` / `latestValues`).
- Verification: full unit + the three-suite gate.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues
- [ ] `pnpm test:only` exits 0
- [ ] `pnpm test:e2e e2e/svg e2e/motion e2e/vanilla-values` exits 0,
      matching Step 1 baseline
- [ ] `grep -n "svgEffect(" src/lib/html/_MotionContainer.svelte` → no matches
- [ ] `grep -n "transformSVGPathProperties" src/lib/html/_MotionContainer.svelte` → no matches
- [ ] `svgEffect` still exported from `src/lib/index.ts`
- [ ] SSR pin passes unchanged
- [ ] README status row updated

## STOP conditions

- Drift beyond plan 006's expected container changes.
- Any `e2e/svg` spec pins an attribute format `buildSVGPath` cannot
  reproduce (pathLength normalization mismatch) — report the exact spec and
  both formats; do not translate at render time without a ruling.
- The mount-flash guard (Step 3) cannot be removed without a visible flash
  AND cannot coexist with VE rendering — report the sequencing.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- After this lands, the only writer outside the VisualElement is drag
  (visual-element-core plan 005, deferred, has its own re-scope notes).
- Reviewer should scrutinize: pathLength unit semantics (ours vs upstream
  0–1 normalization), SSR attr parity, and that `svgEffect` public behavior
  is untouched.
