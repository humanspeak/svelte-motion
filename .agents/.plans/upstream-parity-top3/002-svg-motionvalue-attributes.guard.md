# Guard log — 002 Bind MotionValues to SVG presentation attributes

Running oversight log for plan 002. One entry per checkpoint, append-only.

---

## Checkpoint 2026-07-09 — `guard parity 2` (red-test review, pre-implementation)

- **Verdict**: DRIFTING — the red tests encode a false assumption about which
  DOM channel `svgEffect` writes to. Two e2e tests can never pass against a
  correct implementation; one unit allowlist locks in React spellings Svelte
  authors never write.
- **Snapshot**: none — the `commit` skill's pre-commit hook refused (see Block).
  Reviewed against the working tree at branch tip `3b16d0a`
  (`feat/svg-motion-value-attributes`).
- **Plan `Planned at`**: `634983b`. Drift check
  (`git diff --stat 634983b..HEAD -- src/lib/utils/svg.ts src/lib/html/_MotionContainer.svelte src/lib/types.ts`)
  → empty. No source drift; "Current state" excerpts still hold.
- **Work under review**: `src/lib/utils/svg.spec.ts` (+205), `e2e/svg/motion-value-attributes.spec.ts` (new).
  No implementation yet. Tests are red for the right reason:
  `pnpm test src/lib/utils/svg.spec.ts` → 23 failed / 22 passed, every failure
  `TypeError: <helper> is not a function` or missing `SVG_ATTRIBUTE_PROPERTIES`.

### Block — snapshot commit refused by repo guardrail

`.husky/pre-commit` runs `svelte-check`, which fails on the red spec
(`svg.spec.ts:8,9,11,13,14` — "Module './svg' has no exported member ...").
A test-first commit is therefore impossible here without `--no-verify`; guard
does not force past guardrails. Working tree was restored exactly as found
(`git reset`, no commit created). Red tests can be committed only alongside
the implementation that makes them green.

### Evidence — `svgEffect` routes `cx` to `element.style`, not `setAttribute`

Upstream `motion-dom/src/effects/svg/index.ts` (`addSVGValue`):

```ts
if (key.startsWith("path"))  return addSVGPathValue(...)
else if (key.startsWith("attr")) return addAttrValue(element, state, convertAttrKey(key), value)
const handler = key in element.style ? addStyleValue : addAttrValue
```

Probed in the real e2e browser (Chromium, `page.evaluate`, `k in circle.style`):

| key                                                              | `in element.style` | svgEffect route                  |
| ---------------------------------------------------------------- | ------------------ | -------------------------------- |
| `cx` `cy` `r` `rx` `ry` `x` `y` `width` `height` `d`             | **true**           | `addStyleValue`                  |
| `strokeDashoffset` `strokeWidth` `stopColor` `*Opacity` `offset` | **true**           | `addStyleValue`                  |
| `points` `viewBox` `x1` `y1` `x2` `y2`                           | false              | `addAttrValue`                   |
| `attrX` `attrY` `attrScale`                                      | n/a (prefix)       | `addAttrValue` → `x`/`y`/`scale` |

Same probe: after `c.style.cx = '40px'`, `c.getAttribute('cx')` still returns
`"5"` while `getComputedStyle(c).cx === "40px"`. The attribute is never touched.

### Finding 1 — e2e `updates the cx attribute when the MotionValue changes` cannot pass

`e2e/svg/motion-value-attributes.spec.ts:33-45` polls `circle.getAttribute('cx')`
and asserts it grows. With the plan's prescribed `svgEffect` (Step 2), `cx` is
style-routed: the attribute keeps its SSR value forever and the poll times out.
The test asserts on the wrong channel. Fix: assert
`getComputedStyle(el).cx`, or drive the demo through a genuinely
attribute-routed key (`x1`/`x2`/`points`) or `attrX`.

### Finding 2 — e2e `drives a progress ring via r and stroke-dashoffset` cannot pass

`spec.ts:53-62`. `readOffset()` falls back to
`getComputedStyle(el).strokeDashoffset`, which returns `"12.5px"` (probed).
`Number("12.5px")` → `NaN`. Before and after are both `NaN`, and
`expect(NaN).not.toBe(NaN)` **fails** (`toBe` is `Object.is`, and
`Object.is(NaN, NaN) === true`). The test can never go green regardless of
implementation. Fix: `parseFloat`, and assert on the style channel directly.
Same root cause as Finding 1 — `r` is style-routed too.

### Finding 3 — `leaves plain numeric attributes static` passes vacuously

`spec.ts:106-115` asserts `static-circle`'s `cx` stays `"5"` after a click. Since
no implementation ever writes the `cx` _attribute_ (Finding 1), this assertion
holds even if the MotionValue subscription is completely broken. It cannot
distinguish the plan's "zero subscription overhead" intent from total failure.
Gamed-by-accident criterion; needs to assert on the same channel the live
element uses.

### Finding 4 — allowlist locks in React spellings; the idiomatic Svelte ones leak

`svg.spec.ts:227-240` requires `SVG_ATTRIBUTE_PROPERTIES` to contain
`stopColor`, `stopOpacity`, `fillOpacity`, `strokeOpacity`, `strokeWidth` — the
JSX names, copied from the plan (`002-...md:136-141`), which copied upstream's
React-facing list. Svelte templates take the DOM spelling: a user writes
`<motion.circle stroke-width={mv}>`, not `strokeWidth`. As specced, that prop
misses the allowlist, never gets claimed out of the raw spread, and renders
`stroke-width="[object Object]"` — precisely the failure the plan's _Why this
matters_ exists to kill. Probe shows `'stroke-width' in element.style === true`,
so kebab keys route correctly through `svgEffect` once claimed; the allowlist
just has to contain them. This one is a **plan defect**, not executor drift —
the plan dictated the list. Recommended amendment: allowlist both spellings
(or normalize before lookup), and add a unit case per kebab key.

### Finding 5 — `computeSSRSVGAttrValues` has no camel→kebab coverage

`svg.spec.ts:388-410` only exercises `cx`/`r`/`attrX`/`attrScale`. `resolveSVGAttrKey`
as specced only strips the `attr` prefix, so a `strokeDashoffset` MotionValue
would SSR as the attribute `strokeDashoffset` — not a real SVG attribute
(SVG attribute names are case-sensitive), so it is inert and the value flashes on
hydration. The plan's Step 2.3 ("hydration doesn't flash") is unmet and untested.
Add a case: `computeSSRSVGAttrValues({ strokeWidth: motionValue(4) })` →
`{ 'stroke-width': '4' }`.

### On track

- Unit tests for `resolveSVGAttrKey` (`svg.spec.ts:246-263`) correctly mirror
  upstream's `/^attr([A-Z])/` (`effects/svg/index.ts:58-62`), including the
  `attribute` / `attr` / `attrx` negatives. Real assertions, right semantics.
- `extractSVGMotionValueAttributes` keeping MotionValue keys **un-renamed**
  (`svg.spec.ts:305-317`) is correct and non-obvious: pre-renaming `attrScale`→
  `scale` would make `svgEffect` take the `key in element.style` branch instead of
  the `startsWith("attr")` branch. This is _more_ right than plan Step 1's
  "Include attrX/attrY/attrScale mapping to x/y/scale here", which reads as if the
  rename should happen at extraction. Plan text is imprecise; the test is correct.
- No-overlap-with-`SVG_PATH_PROPERTIES` (`svg.spec.ts:255`) and
  "don't claim path props even when they hold MotionValues" (`svg.spec.ts:327-333`)
  correctly protect the out-of-scope path pipeline.
- Non-mutation and empty-bag cases present. e2e `attrX`/`attrY`/`attrScale` tests
  (`spec.ts:65-104`) assert the right channel (`addAttrValue`) and correctly check
  that no CSS transform is produced.
- SSR e2e (`spec.ts:117-128`) is a genuine `request.get` against the server payload,
  not a hydrated snapshot. Correct approach.

### Next

- Operator decides Finding 4 (plan defect → amendment) before the executor
  rewrites the tests. Findings 1-3 and 5 are executor-side test fixes; the plan
  does not change for them.
- Plan's Test-plan bullet "no `[object Object]` in DOM" is well served; the
  "attribute updates" bullet must be restated as "the bound channel updates".
- No implementation exists yet, so no scope audit was possible beyond the two
  test files. Both are in the plan's in-scope list (`002-...md:105,110`).

---
