# Guard close-out report — 002 Bind MotionValues to SVG presentation attributes

- **Verdict**: **PASS**
- **Date**: 2026-07-09 (supersedes the same-day NO-PASS; both blockers closed)
- **Plan**: `002-svg-motionvalue-attributes.md` (`Planned at` `9557778`, revision (b))
- **Snapshot reviewed**: `1f593e2` on `feat/svg-motion-value-attributes`
- **Base**: `3b16d0a` (merge-base with `main`)
- **PR**: <https://github.com/humanspeak/svelte-motion/pull/441> (open, unmerged)

## Does it deliver `Why this matters`?

Yes, now including the case that broke the previous gate. A `MotionValue` bound to any
non-path SVG attribute reaches its element instead of stringifying as `[object Object]`
— shape geometry (`cx`, `r`, `x2`), the `stroke-*` family, `attrX/attrY/attrScale`, and
**filter primitives** (`stdDeviation`, `baseFrequency`, `numOctaves`, `dx`, `dy`,
`radius`). Plan 005's `feTurbulence`/`feOffset` dependency is unblocked.

Beyond the original plan, the work also fixed case-sensitive SVG **tag names**
(revision (b)): `motion.fedisplacementmap` had been rendering an inert generic
`SVGElement`, silently discarding every filter primitive created client-side.

## Done criteria — every one re-run at `1f593e2`, not trusted

| #   | Criterion                                       | Result                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------ |
| 1   | `pnpm check` exits 0                            | **PASS** — 0 errors, 32 pre-existing warnings          |
| 2   | `pnpm test`; new `svg.spec.ts` cases pass       | **PASS** — 66 files, 752/752 (+7 since the NO-PASS)    |
| 3   | `pnpm exec playwright test e2e/svg`             | **PASS** — full suite: 317 passed, 2 skipped, 0 failed |
| 4   | Demo route exists and is linked                 | **PASS**                                               |
| 5   | Docs page + nav entry; sitemap regenerated      | **PASS on intent** — see Plan defect 1                 |
| 6   | No modified files outside the in-scope list     | **PASS** — scope audit `3b16d0a...1f593e2` exact       |
| 7   | Batch README status row updated                 | **PASS** — 002 → DONE                                  |
| 8   | Tag-casing asserted on a client-created element | **PASS** — verified non-vacuous at the prior gate      |

The 2 e2e skips are pre-existing (`e2e/drag/single-frame.spec.ts:20`,
`e2e/motion/svg-path-length.test.ts:149`), in files this branch never touched.
`pnpm --filter docs check` → 0 errors. `trunk check` → no issues, 17 files.

## Blocker 1 — closed, and the fix was verified by reverting it

`isSVGMotionValueAttribute` (`svg.ts:107-115`) now resolves in a deliberate order:

1. path props rejected **first**;
2. `attr`-prefixed props accepted;
3. **motion-dom's exported `camelCaseAttributes`** consulted;
4. local allowlist last, for the lowercase/kebab names upstream cannot express.

Step 1 preceding step 3 is load-bearing — `pathLength` is a member of
`camelCaseAttributes`, and claiming it would double-write `stroke-dasharray`. This is
pinned by `svg.spec.ts:528` ("should still refuse pathLength even though
camelCaseAttributes lists it"), which passes.

No vendored copy: `grep baseFrequency src/lib/utils/svg.ts` → one hit, in a JSDoc line.
The set itself is imported. `dx`/`dy`/`radius` are added explicitly because upstream's
set holds camelCase names only — pinned by a unit case asserting they are **absent**
from `camelCaseAttributes`, so nobody later assumes the import covers them.

Guard did not take the fix on trust. In a throwaway worktree the `camelCaseAttributes`
lookup and the three lowercase keys were removed, and both new e2e tests **failed**:

```text
2 failed
  › binds a MotionValue to a filter primitive attribute
  › server-renders a filter primitive attribute without stringifying it
```

## Blocker 2 — closed, both tests verified non-vacuous

- The SSR unit case now routes filter keys through `extractSVGMotionValueAttributes`
  rather than straight into `computeSSRSVGAttrValues`. It went red without the fix
  (5 failures at `22ed10e`), green with it.
- The clobber e2e now marks `attr-rect`'s subtree with `data-highlight` and changes the
  motion element's own `class`, and **asserts its own premise**
  (`rect.closest('[data-highlight="true"]')`) before checking `x`. Reverting only the
  fixture makes it fail:

```text
1 failed
  › an unrelated re-render does not clobber attribute-routed values
```

That self-assertion is the durable part: the old test lied because nothing forced the
toggle to reach the element under test.

## A relaxed assertion, examined and accepted

The executor widened the SSR check from `/stdDeviation="[\d.]+"/` to a case-insensitive
match, with a story attached. Weakening a test to fit observed output is the classic
laundering move, so guard verified the story rather than the diff.

It holds. Svelte's SSR spread lowercases attribute names — the live payload really is
`<feGaussianBlur ... stddeviation="2">` (tag name preserved, attribute lowercased). The
HTML parser's SVG attribute-adjustment table maps it back, confirmed in Chromium:

```text
setContent('<svg><filter><feGaussianBlur stddeviation="2">…')
  getAttributeNames() -> ['data-testid','in','stdDeviation']
  stdDeviationX.baseVal -> 2      (also baseFrequency, numOctaves)
```

So there is no inert attribute and no hydration flash. The test still forbids
`std-deviation=`, the one casing no parser would rescue, and the client-DOM test asserts
`stdDeviationX.baseVal` after a live update. The property under test survived; only the
over-specific spelling was dropped. Accepted.

## Findings 1-8 — all closed

1, 2 (wrong DOM channel; `Number("12.5px")` → `NaN`), 3 (vacuous static assertion),
4 (React camelCase allowlist), 5 (inert `strokeDashoffset` in SSR), 6 (`attrX` → `attr-x`
ordering), 7 (read-back path with no caller — respected: `grep -c getAttribute
src/lib/utils/svg.ts` → **0**), 8 (tag test asserted on a parser-created node).

## Plan defect 1 — criterion 5's sitemap command no longer exists (not executor drift)

Step 4 says `pnpm --filter docs sitemap:manifest`; no such script exists.
`docs/src/lib/sitemap-manifest.json` is gitignored (`docs/.gitignore:36`) and emitted by
a docs vite plugin at build. Verified on intent: the manifest contains `svg-animation`
(2 entries) and docs check is clean. Plan text is stale, the work is not. **Not amended**
— nothing needed lowering to reach PASS.

## Environment hazard worth fixing (outside this plan)

`playwright.config.ts:21` sets `reuseExistingServer: !process.env.CI`. During this gate,
a stale preview server left over on port 4198 caused a worktree run with the fix
**reverted** to pass — it was silently served the old, fixed build. Guard caught it via
`lsof` and re-ran with `CI=1`, which produced the correct failures. Any local e2e run can
be validated against a stale build this way. The port pin (4198) prevents cross-repo
collisions but not stale-server reuse.

## Quality notes

- `attrScale`'s JSDoc example correctly uses `<feDisplacementMap>`, the only element
  where the attribute means anything.
- CodeRabbit's SSR doc-comment finding was a **false positive**, rejected with evidence:
  SSR emits `x="10"` (raw stringify) while the client's `addAttrValue` applies the px
  value type (`x="10px"`). The comment sits on the client reader and was already right.
  The executor then improved it to document both.

## Process notes

- Two commits used `--no-verify` (`af90f5a`, `b932936`, plus `22ed10e`) under explicit
  operator authorization: the pre-commit `svelte-check` cannot pass on a knowingly-red
  test-first commit. Each message records the reason.
- The plan was twice amended by the advisor rather than guard. Not tampering — the
  executor never edited the plan. Recorded because v1 of that "upstream ruling" shipped
  three defects that only independent verification caught.
- The CodeRabbit nits were fixed by a dispatched executor, not by guard, preserving the
  separation that lets guard gate the result.

## Publication

Work is committed at `1f593e2` and published as
[PR #441](https://github.com/humanspeak/svelte-motion/pull/441) (`Closes #435`), opened
under the earlier PASS and now re-validated. Guard stops here.
**Merging remains the operator's call.**
