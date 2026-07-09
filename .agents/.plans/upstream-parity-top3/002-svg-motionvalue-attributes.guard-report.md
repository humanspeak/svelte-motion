# Guard close-out report — 002 Bind MotionValues to SVG presentation attributes

- **Verdict**: **NO-PASS** — retracted from PASS on 2026-07-09 after a CodeRabbit
  review surfaced a functional bug that every done criterion missed. See
  **Blocker 1**. PR #441 is open but **must not merge** until it is fixed.
- **Date**: 2026-07-09 (revised same day)
- **Plan**: `002-svg-motionvalue-attributes.md` (`Planned at` `9557778`, revision (b))
- **Snapshot reviewed**: `54b7620` on `feat/svg-motion-value-attributes`
  (source gates run at `8f51399`; `54b7620` is a docs-only follow-up — see Late edit)
- **Base**: `3b16d0a` (merge-base with `main`)
- **PR**: <https://github.com/humanspeak/svelte-motion/pull/441> (open, unmerged)

## Blocker 1 — filter-primitive attributes still render `[object Object]`

**This is the exact failure `Why this matters` exists to eliminate, on the exact
elements Plan 005 depends on.** Found by CodeRabbit, reproduced by guard.

`SVG_ATTRIBUTE_PROPERTIES` (`svg.ts:34-69`) never claims the filter-primitive
attributes, so a `MotionValue` on one falls through to `staticAttrs` and hits the raw
spread. Reproduced against the real module:

```text
stdDeviation    claimed: false      numOctaves  claimed: false
baseFrequency   claimed: false      dx / dy     claimed: false   (feOffset)
radius          claimed: false      cx          claimed: true

extractSVGMotionValueAttributes({ stdDeviation: motionValue(4) })
  motionValueAttrs: []
  staticAttrs     : ['stdDeviation']
  rendered as     : stdDeviation="[object Object]"
```

Why every gate missed it: the demo drives `feDisplacementMap` through **`attrScale`**,
which takes the `attr`-prefix branch and works. No demo, e2e, or unit case ever passes a
MotionValue on a bare filter-primitive key through classification.

The plan's own v2 ruling named these keys: _"the filter-primitive entries
(`baseFrequency`, `numOctaves`, `stdDeviation`) are exactly what Plan 005's
`feTurbulence` work will drive through this path."_ They reach the SSR casing gate
correctly and were unit-tested there — but they never get **claimed**, so the gate is
never called for them.

**Fix**: extend the allowlist with the filter-primitive keys, or resolve against
`camelCaseAttributes` before the final `isSVGMotionValueAttribute` check.

## Blocker 2 — two tests create false confidence

- `svg.spec.ts:547` ("should honor upstream camelCase entries beyond the ones we
  hand-picked") passes `stdDeviation`/`baseFrequency`/`numOctaves` **directly** to
  `computeSSRSVGAttrValues`, bypassing `extractSVGMotionValueAttributes`. It reads as
  filter-primitive coverage and is why Blocker 1 hid in plain sight. Route the same keys
  through classification.
- `+page.svelte:297` binds the `highlight` class to the **`mv-circle`** `<svg>`, while
  `attr-rect` lives in a separate `<svg>` at `:374-390`. The e2e
  _"an unrelated re-render does not clobber attribute-routed values"_
  (`spec.ts:~330-337`) toggles it and then asserts on `attr-rect` — so it can pass even
  if the clobbering bug returns. Move the class onto the `attr-rect` subtree or a shared
  ancestor.

Non-blocking nits from the same review: `role="toolbar"` missing on the demo's
`aria-label`led `div`; docs snippets aren't copy-paste self-contained; an SSR doc comment
at `spec.ts:33-36` describes output that `computeSSRSVGAttrValues` doesn't produce;
`attrY`/`attrScale` lack the JSDoc `@example` that `attrX` has (repo convention requires
`@param`/`@returns`/`@example` on `src/lib/utils/*.ts`).

## What guard got wrong

Every done criterion passed and the work still fails `Why this matters` on filter
primitives. That is "in-scope but beside the point," and the final gate did not catch
it: guard verified the _channel split_ and the _casing gate_ exhaustively, and checked
that `attrScale` reached `feDisplacementMap`, but never asked whether a bare
filter-primitive key survives classification. The `attrScale` demo made the filter path
look covered. A green suite is not coverage — this is the same lesson Findings 3 and 8
taught, missed a third time.

## Does it deliver `Why this matters`?

Partially — see Blocker 1. For shape geometry and the `attr*` family, yes. For filter
primitives, no.

The plan existed because a `MotionValue` passed as any non-path SVG attribute
was spread raw and stringified as `[object Object]`, and because `attrX/attrY/attrScale`
did not exist. The `attr*` family is closed, and the e2e asserts the absence of
`[object Object]` in the hydrated DOM _and_ in the raw SSR payload (`request.get`, not a
hydrated snapshot) — but only for the keys the demo exercises. Scroll-linked rings and
chart lines work. Filter primitives work **only** through `attrScale`; a bare
`stdDeviation={mv}` still stringifies (Blocker 1).

The work also exceeded the plan in one way that matters: it fixed SVG **tag-name**
casing (revision (b), operator-approved). `motion.fedisplacementmap` was rendering an
inert generic `SVGElement` — the filter primitive was silently ignored. That was never
in the original plan and would have blocked Plan 005.

## Done criteria — every one re-run at `8f51399` (all green, and insufficient — see Blocker 1)

| #   | Criterion                                           | Result                                                        |
| --- | --------------------------------------------------- | ------------------------------------------------------------- |
| 1   | `pnpm check` exits 0                                | **PASS** — 0 errors, 32 pre-existing warnings                 |
| 2   | `pnpm test`; new `svg.spec.ts` cases pass           | **PASS** — 66 files, 745/745                                  |
| 3   | `pnpm exec playwright test e2e/svg`                 | **PASS** — full suite re-run: 315 passed, 2 skipped, 0 failed |
| 4   | Demo route exists and is linked                     | **PASS** — `src/routes/+page.svelte`                          |
| 5   | Docs page exists w/ nav entry; sitemap regenerated  | **PASS on intent** — see Plan defect 1                        |
| 6   | No modified files outside the in-scope list         | **PASS** — scope audit `3b16d0a...8f51399` exact              |
| 7   | Batch README status row updated                     | **PASS** — 002 → DONE                                         |
| 8   | Tag-casing asserted on a **client-created** element | **PASS** — independently verified non-vacuous (below)         |

The 2 e2e skips (`e2e/drag/single-frame.spec.ts:20` `test.fixme`,
`e2e/motion/svg-path-length.test.ts:149` `test.skip`) are pre-existing — neither file
is touched by this branch. `trunk check` → no issues across 16 modified files.

## Finding 8 (prior checkpoint) — verified closed, by experiment

The earlier checkpoint found the tag-casing tests vacuous: they asserted on the
first-paint node, which the HTML parser creates and silently case-corrects, and which
Svelte reuses when hydrating
(`svelte/src/internal/client/dom/blocks/svelte-element.js:74`).

The executor's fix adds `await remount(page)` before asserting. Guard did **not** take
that on trust. In a throwaway `git worktree` (the real tree untouched), the fix was
reverted (`this={renderTag}` → `this={tag}`, 4 sites) and the test re-run:

```text
1 failed
  › renders camelCase SVG tags with their case-sensitive spec spelling
  expect(info.tagName).toBe('feDisplacementMap')   // spec.ts:186
```

The test now genuinely detects the bug it was written for. Worktree removed; the real
working tree was never modified.

## Findings 1-7 — all closed

- **1, 2** (e2e polled `getAttribute('cx')` for style-routed keys; `Number("12.5px")`
  → `NaN`): fixed. e2e reads `getComputedStyle(...).getPropertyValue(prop)` and
  `parseFloat` throughout.
- **3** (vacuous static-attribute assertion): fixed with the reasoning inlined —
  `spec.ts:292-294` reads the style channel and comments _"Asserting the attribute is
  unchanged would pass even if the subscription were broken."_
- **4** (React camelCase allowlist would let `stroke-width={mv}` render
  `[object Object]`): fixed; kebab spellings allowlisted and unit-tested.
- **5** (SSR emitted inert `strokeDashoffset`): fixed via the upstream casing gate.
- **6** (gate-vs-`attr`-prefix ordering — `attrX` must never emit `attr-x`): fixed at
  `svg.ts:169-170`, `resolveSVGAttrKey` **then** the gate; unit-pinned at
  `svg.spec.ts:542-544` (`not.toHaveProperty('attr-x')`).
- **7** (v1 ruling mandated a read-back test with no caller): respected —
  `grep -c getAttribute src/lib/utils/svg.ts` → **0**. No dead read-back path was built.

## Upstream fidelity

`camelCaseAttributes` and `camelToDash` are **imported from `motion-dom`**
(`svg.ts:1-7`), not vendored, so upstream additions track on version bumps — exactly
what the v2 ruling required. Installed `motion-dom` is `12.42.2`, the version the
ruling was made against.

## Plan defect 1 — criterion 5's sitemap command no longer exists (not executor drift)

Step 4 says `Regenerate sitemap: pnpm --filter docs sitemap:manifest`. That script is
gone: `docs/package.json` has no sitemap script, `docs/src/lib/sitemap-manifest.json`
is gitignored (`docs/.gitignore:36`) and emitted by a docs vite plugin at build time.

Guard verified the **intent** rather than the command: the on-disk manifest contains
`svg-animation` (2 entries — docs + examples), and `pnpm --filter docs check` → 0
errors. So the criterion's purpose is satisfied and no work is missing. The plan text
is stale, not the work. Not amended — guard does not amend without operator agreement,
and nothing here needed lowering to reach PASS.

**Recommended (optional) amendment**: reword criterion 5 to "docs page + nav entry
exist; sitemap manifest regenerates on build and contains the new routes."

## Quality notes (unprompted improvements worth keeping)

- The old `renders attrScale as the scale attribute` test asserted `scale` on a
  `<rect>`, where the attribute is inert. Replaced with a `feDisplacementMap` case that
  reads `scale.baseVal` through the SVG IDL, plus `expect(scale).not.toContain('px')`
  pinning the unitless `numberValueTypes` entry.
- The docs page teaches the two-channel split honestly, including the devtools trap:
  _"the attribute you see in devtools is the initial server-rendered value"_
  (`+page.svx:46-65`). A user debugging a "stuck" `cx` will find the answer.
- `SVG_TAG_CASING` covers the full SVG 2 case-sensitive element set; the omitted names
  (`altGlyph*`, `glyphRef`, `font-face-*`) are SVG 1.1 elements removed from SVG 2.

## Process notes

- The plan was twice amended by the **advisor** rather than guard (the "upstream
  ruling"). Not tampering — the executor never touched the plan, and the operator
  surfaced both. Recorded because v1 of that ruling shipped three defects that only
  independent verification caught (a wrong entry count, an omitted public export, and
  the `attr-x` ordering bug).
- Two commits were made with `--no-verify` (`af90f5a`, `b932936`) under explicit
  operator authorization, because the repo's pre-commit `svelte-check` cannot pass on a
  knowingly-red test-first commit. Both messages record the reason.
- `8f51399` was committed by the maintainer concurrently with guard's checkpoint rather
  than by guard. No content impact — the snapshot is complete and the tree is clean.

### Late edit — caught at the PR preflight

After the gates passed at `8f51399`, the `pr` preflight found the tree dirty again: two
docs files had been edited under guard. Publication was stopped rather than pushed over
unreviewed work. The diff was read (`docs/.../demos/Default.svelte`,
`docs/.../svg-animation/+page.svx`): cosmetic typography only — `<strong>`/`<code>` in
the embedded demo were losing to `.prose-v2`'s rules on cascade order, plus dropping
`isSmall`. `git diff --name-only -- src/ e2e/` → **0 files**, so no source gate was
invalidated. Snapshotted as `54b7620`; the two gates it could affect were re-run:
`pnpm --filter docs check` → 0 errors, `trunk check` → no issues (17 files).

## Publication

Work is committed at `54b7620` and published as
[PR #441](https://github.com/humanspeak/svelte-motion/pull/441) (`Closes #435`).
The PR was opened under the original PASS and is **now blocked** — do not merge until
Blockers 1 and 2 are resolved.

**What flips this back to PASS**: the allowlist claims filter-primitive attributes
(`stdDeviation`, `baseFrequency`, `numOctaves`, `dx`, `dy`, `radius`, …) — ideally by
resolving against `camelCaseAttributes` rather than another hand-maintained list — with
a unit case driving them through `extractSVGMotionValueAttributes` (not just the SSR
helper), an e2e asserting a MotionValue-driven `stdDeviation` never renders
`[object Object]`, and the `highlight` toggle moved onto the `attr-rect` subtree.

Guard stops here and does not fix the code. **Merging remains the operator's call.**
