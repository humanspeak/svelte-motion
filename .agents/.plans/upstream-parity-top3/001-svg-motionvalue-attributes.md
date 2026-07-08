# Plan 001: Bind MotionValues to SVG presentation attributes and add attrX/attrY/attrScale

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/upstream-parity-top3/README.md`).
>
> **Drift check (run first)**: `git diff --stat 634983b..HEAD -- src/lib/utils/svg.ts src/lib/html/_MotionContainer.svelte src/lib/types.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction (upstream parity)
- **Planned at**: commit `634983b`, 2026-07-08
- **Issue**: <https://github.com/humanspeak/svelte-motion/issues/435>

## Why this matters

Upstream framer-motion lets a `MotionValue` drive any SVG presentation attribute:
`<motion.circle cx={x} />`, scroll-linked progress rings via `r`/`stroke-dashoffset`,
animated chart lines via `x1/y1/x2/y2/points`. In svelte-motion, only the three
path-drawing props (`pathLength`/`pathOffset`/`pathSpacing`) get special handling;
a MotionValue passed as any other SVG attribute is spread raw onto the element and
stringifies as `[object Object]`. Upstream also renders `attrX`/`attrY`/`attrScale`
as the SVG `x`/`y`/`scale` _attributes_ (distinct from the CSS transform), which we
don't support at all. This is a marquee Motion use case (SVG data viz, progress
indicators) and the gap makes the port look broken rather than incomplete.

## Current state

Relevant files:

- `src/lib/utils/svg.ts` — SVG helpers. Line 7 defines the entire special-cased
  attribute surface:
    ```ts
    // src/lib/utils/svg.ts:7
    export const SVG_PATH_PROPERTIES = new Set(['pathLength', 'pathOffset', 'pathSpacing'])
    ```
    Lines ~142-220 map path props to `stroke-dasharray`/`pathLength="1"` semantics.
- `src/lib/html/_MotionContainer.svelte` — the single motion-element container
  (~2400 lines; both HTML and SVG render through it).
    - Around line 1387, `svgEffect` (from `motion-dom`) is invoked **only** for the
      path props during path animations:
        ```ts
        // src/lib/html/_MotionContainer.svelte:~1387
        cleanupSVGPathAttributeEffect = svgEffect(path, values)
        ```
    - Around line 1470, all remaining props are spread raw into the rendered
      attributes — this is where a MotionValue-valued attribute leaks through
      unstringified:
        ```ts
        // src/lib/html/_MotionContainer.svelte:~1470
        const derivedAttrs = $derived<Record<string, unknown>>({
            ...(rest as Record<string, unknown>),
            ...
        ```
- `src/lib/types.ts` — `MotionProps`. No `attrX`/`attrY`/`attrScale` types exist.
- `src/lib/index.ts` — already exports `attrEffect`, `svgEffect`, `propEffect`,
  `styleEffect` (line ~44), so the underlying motion-dom machinery is available.

Upstream reference (for semantics, read before implementing):

- `~/Github/motion/packages/motion-dom/src/effects/svg/index.ts` — `addSVGValue`
  routes any non-path/attr key through style-vs-attribute detection.
- `~/Github/motion/packages/motion-dom/src/render/svg/utils/build-attrs.ts:23-25,82-85`
  — `attrX`/`attrY`/`attrScale` render as `x`/`y`/`scale` attributes.

Repo conventions:

- Svelte 5 runes throughout; effects that need teardown return a cleanup and are
  registered in `onMount`/`$effect` blocks — follow the existing
  `cleanupSVGPathAttributeEffect` pattern in `_MotionContainer.svelte`.
- Google-style JSDoc on all exported functions/types.
- MotionValue detection: use the existing `isMotionValue` helper from `motion-dom`
  (grep for current import sites in `src/lib/utils/` and match them).

## Commands you will need

| Purpose    | Command                               | Expected on success |
| ---------- | ------------------------------------- | ------------------- |
| Install    | `pnpm install`                        | exit 0              |
| Typecheck  | `pnpm check`                          | exit 0, 0 errors    |
| Unit tests | `pnpm test`                           | all pass            |
| One spec   | `pnpm test src/lib/utils/svg.spec.ts` | all pass            |
| e2e        | `pnpm exec playwright test e2e/svg`   | all pass            |
| Format     | `trunk fmt`                           | exit 0              |
| Lint       | `trunk check`                         | no new issues       |

Note: e2e preview server is pinned to port 4198 (sibling repos collide on 4173 —
do not change the port config).

## Scope

**In scope** (the only files you should modify/create):

- `src/lib/utils/svg.ts` (attribute classification helpers)
- `src/lib/utils/svg.spec.ts` (extend)
- `src/lib/html/_MotionContainer.svelte` (MotionValue-attr subscription + attrX/Y/Scale mapping)
- `src/lib/types.ts` (attrX/attrY/attrScale types)
- `src/routes/tests/svg/motion-value-attributes/+page.svelte` (create demo)
- `src/routes/+page.svelte` (link the demo)
- `e2e/svg/motion-value-attributes.spec.ts` (create)
- `docs/src/routes/docs/svg-animation/` + `docs/src/lib/examples/svg-animation/` +
  `docs/src/lib/docsNav.ts` (docs page — **required**, see Docs step)

**Out of scope** (do NOT touch, even though they look related):

- The path-drawing pipeline (`SVG_PATH_PROPERTIES` handling, `buildSVGPath` usage)
  — it is correct and covered by `e2e/motion/svg-path-length.test.ts`.
- `src/lib/utils/style.ts` / transform building — CSS transforms are not part of
  this plan; `attrX` is an _attribute_, not a transform channel.
- Drag/projection/AnimatePresence code paths in `_MotionContainer.svelte`.

## Git workflow

- Branch: `feat/svg-motion-value-attributes` (repo uses `feat/`/`fix/` prefixes —
  see `git log --oneline`: e.g. `feat(values): vanilla motion-value layer...`).
- Conventional commits, e.g. `feat(svg): bind MotionValues to SVG presentation attributes`.
- Do NOT push or open a PR; the maintainer signs off on live demos first
  (project convention).

## Steps

### Step 1: Classify SVG attribute props in `svg.ts`

Add to `src/lib/utils/svg.ts`:

- An `SVG_ATTRIBUTE_PROPERTIES` set covering the attribute-animatable keys
  upstream supports: `cx, cy, r, rx, ry, x, y, x1, y1, x2, y2, width, height,
points, d, offset, stopColor, stopOpacity, fillOpacity, strokeOpacity,
strokeWidth, viewBox` (cross-check against upstream
  `build-attrs.ts`/`camel-case-attrs.ts` and include what upstream includes —
  cite the upstream file in the JSDoc).
- A helper `extractSVGMotionValueAttributes(rest: Record<string, unknown>)` that
  returns `{ motionValueAttrs, staticAttrs }` — splitting entries whose value is
  a MotionValue from plain values. Include `attrX`/`attrY`/`attrScale` mapping to
  `x`/`y`/`scale` here.

**Verify**: `pnpm test src/lib/utils/svg.spec.ts` → passes (write the unit tests
in the same step: classification, attrX→x mapping, non-MotionValue passthrough).

### Step 2: Subscribe MotionValue attributes in `_MotionContainer.svelte`

In the SVG branch of `_MotionContainer.svelte`:

1. Before the `derivedAttrs` spread (~line 1470), strip MotionValue-valued
   attribute entries out of `rest` so they never reach the raw spread.
2. On mount (client only), call `svgEffect(element, motionValueAttrs)` for SVG
   elements (or `attrEffect` for the `attrX/attrY/attrScale`-mapped keys),
   following the existing `cleanupSVGPathAttributeEffect` register/cleanup
   pattern at ~line 1387. Re-run the effect if the identity of the MotionValue
   props changes (match how `styleEffect` subscriptions are managed — grep
   `styleEffect` in the file, ~line 617).
3. SSR: render the MotionValue's **current** value as the initial attribute so
   server output is correct and hydration doesn't flash (`[object Object]` must
   never appear in SSR output either).

**Verify**: `pnpm check` → 0 errors. Then the demo (Step 3) shows a moving circle.

### Step 3: Demo route + e2e

Create `src/routes/tests/svg/motion-value-attributes/+page.svelte`:

- A `<motion.circle>` whose `cx` is a `useSpring`/`useMotionValue` driven by a
  slider or button, and a progress ring whose `r`/`stroke-dashoffset` tracks a
  MotionValue. Link it from `src/routes/+page.svelte` (match existing link list).

Create `e2e/svg/motion-value-attributes.spec.ts` (model after an existing spec in
`e2e/svg/`):

- Assert the rendered attribute is numeric (never `[object Object]`).
- Mutate the MotionValue (click the button), poll the attribute, assert it changes.

**Verify**: `pnpm exec playwright test e2e/svg` → all pass.

### Step 4: Docs page (**required — docs update flagged for this item**)

- New docs page `docs/src/routes/docs/svg-animation/+page.svx` + `+page.ts`
  covering: MotionValue→attribute binding, path drawing (`pathLength`), and
  `attrX/attrY/attrScale`. Reusable example under
  `docs/src/lib/examples/svg-animation/`, example route under
  `docs/src/routes/examples/svg-animation/`, nav entry in
  `docs/src/lib/docsNav.ts`.
- Regenerate sitemap: `pnpm --filter docs sitemap:manifest`.
- Match the structure of an existing docs page, e.g.
  `docs/src/routes/docs/transform-template/`.

**Verify**: `pnpm --filter docs check` (or the docs build) → exit 0.

### Step 5: Full gates

**Verify**: `pnpm check && pnpm test` → exit 0; `trunk fmt && trunk check` →
clean; `pnpm exec playwright test e2e/svg` → pass.

## Test plan

- Unit (`src/lib/utils/svg.spec.ts`): attribute classification; attrX/attrY/attrScale
  → x/y/scale mapping; MotionValue extraction leaves static attrs untouched;
  path props are NOT claimed by the new set (no double handling).
- e2e (`e2e/svg/motion-value-attributes.spec.ts`): no `[object Object]` in DOM;
  attribute updates when MotionValue changes; SSR/hydration initial value correct
  (load page with JS, assert first paint attribute is numeric).
- Pattern: model unit tests after existing `src/lib/utils/svg.spec.ts` blocks;
  e2e after `e2e/svg/` existing specs.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm test` exits 0; new svg.spec.ts cases exist and pass
- [ ] `pnpm exec playwright test e2e/svg` exits 0 incl. new spec
- [ ] Demo route exists and is linked from `src/routes/+page.svelte`
- [ ] Docs page exists with nav entry; sitemap regenerated
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] Batch README status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The excerpts in "Current state" don't match the live code (drift).
- `svgEffect`/`attrEffect` from `motion-dom` turn out not to handle a needed
  attribute (e.g. `points`) — report the gap instead of hand-rolling a writer.
- Subscribing attributes conflicts with the path-props pipeline on the same
  element (double writes to `stroke-dasharray`) — report with a failing test.
- Fixing SSR requires changes to `src/lib/utils/style.ts` or the HTML (non-SVG)
  branch — that's out of scope; report.

## Maintenance notes

- Future upstream versions may extend the attribute list — the JSDoc on
  `SVG_ATTRIBUTE_PROPERTIES` cites the upstream file to diff against.
- Reviewer should scrutinize: hydration behavior (no attribute flash), and that
  `<motion.circle cx={5}>` (plain number) still renders statically with zero
  subscription overhead.
- Deferred: MotionValue-driven `transform` attribute on SVG (upstream handles
  via transform box tricks); `useMotionValueEvent`-style attr listeners.
