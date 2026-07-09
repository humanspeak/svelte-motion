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

## Checkpoint 2026-07-09 — `guard parity 2` — PLAN AMENDED

- **Verdict**: PLAN AMENDED (operator agreed)
- **Snapshot**: `af90f5a` — the executor's red tests, committed with `--no-verify`
  under **explicit operator authorization**, overriding the block recorded in the
  previous entry. The pre-commit `svelte-check` fails by design on a test-first
  commit (helpers not yet exported from `svg.ts`); the operator judged this a
  known-red snapshot and directed guard to bypass. Recorded here because guard
  does not otherwise pass guardrails.
- **`Planned at`** re-stamped `634983b` → `af90f5a`, so the drift check
  re-baselines against the amended intent.
- **Evidence preserved**: `assets/svg-channel-probe.mjs` — the Chromium probe
  behind this amendment, runnable from the repo root. Re-run it if a Chromium
  bump is suspected of moving a key between channels. Output on Chromium
  149.0.7827.55: `cx cy r rx ry x y width height d` + `stroke-*`/`*Opacity`/
  `stopColor`/`offset` style-routed; `points viewBox x1 y1 x2 y2` attr-routed;
  `element.style.cx = '40px'` leaves `getAttribute('cx') === "5"`;
  `Number("12.5px") === NaN`.

### What changed in the plan, and why

Root cause of Findings 1-5: the plan spoke of a single "attribute" channel.
`svgEffect` has two (`effects/svg/index.ts:44-52`), and the split is decided by
`key in element.style` — which is `true` for `cx cy r rx ry x y width height d`
and the `stroke-*`/`*Opacity`/`stopColor`/`offset` family in Chromium. Those are
written to `element.style`; only `points viewBox x1..y2` and `attr*` reach
`setAttribute`. Every wrong-channel test traced back to plan text.

| Plan section       | Amendment                                                                                                                              | Finding         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Step 1 (allowlist) | Must carry kebab-case DOM spellings (`stroke-width`, …), not just React's camelCase                                                    | 4               |
| Step 1 (attr keys) | Do **not** rename `attr*` on the MotionValue side; expose `resolveSVGAttrKey` for static + SSR use only                                | (was imprecise) |
| Step 2.3 (SSR)     | Emit DOM attribute names; kebab for hyphenated keys, else the attribute is inert and flashes on hydration                              | 5               |
| Step 3 (e2e)       | Poll the **bound channel**; `parseFloat` not `Number` on computed styles; static-attr assertion must not read a channel nothing writes | 1, 2, 3         |
| Test plan          | Cover one key per channel (`attrX` + `cx`); require a kebab-case unit case                                                             | 1-5             |

Findings 1-3 and 5 remain **executor-side test fixes** — the amendment tells the
executor what to assert, it does not lower any bar. No done criterion was
weakened, none removed. Finding 4 widened the _implementation_ requirement
(more keys must be claimed), which is a strictly higher bar than the original.

### Batch README

Row 002 `TODO` → `IN PROGRESS`, with a pointer to this log.

### Next after amendment

- Executor picks up the revised plan: rewrite the three wrong-channel e2e tests,
  add the kebab-case unit cases, then implement Steps 1-5.
- `guard parity 2` again once implementation lands; `final` gates the PR.

---

## Checkpoint 2026-07-09 — `guard parity 2` (casing ruling v2 + executor test fixes)

- **Verdict**: ON TRACK (still pre-implementation)
- **Snapshots**: `5c307fe` (plan ruling v2 + README), `b932936` (executor's test
  fixes). `b932936` used `--no-verify` under the same standing operator
  authorization as `af90f5a` — tests remain knowingly red (29 failed / 22 passed,
  all on absent `svg.ts` helpers), so pre-commit `svelte-check` cannot pass.
- **Plan `Planned at`**: `af90f5a`. Drift check → empty; `svg.ts` still untouched.

### Plan amendment authored outside guard — process note, not a violation

The "Upstream ruling on Step 2.3 SSR attribute casing" was written into the plan
by the **advisor** (plan author), not by guard and not by the operator. Per
separation of powers only guard amends the plan, with operator agreement. This is
**not tampering**: the executor did not touch the plan (its edits are confined to
`svg.spec.ts` + the e2e spec, both in scope), and the operator surfaced the ruling
deliberately. Recorded because a ruling that arrives pre-approved invites adoption
without re-derivation — and v1 of this one carried three defects.

### Guard verification of the ruling (evidence, not assertion)

Every v1 citation re-read against `~/Github/motion` and the **installed** package
(`node_modules/motion-dom` → `12.42.2`, matching the version ruled against):

| Claim                                                                          | Result                                                                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderSVG` gates writes on `!camelCaseAttributes.has(k) ? camelToDash(k) : k` | CONFIRMED — `render/svg/utils/render.ts:15-19`, verbatim                                                                                            |
| `SVGVisualElement.readValueFromInstance` applies the same gate                 | CONFIRMED — `SVGVisualElement.ts:39-40`                                                                                                             |
| `camelToDash` is a pure uppercase replacer; `'stroke-width'` untouched         | CONFIRMED — `render/dom/utils/camel-to-dash.ts:1-3`                                                                                                 |
| `camelCaseAttributes` is a public export                                       | CONFIRMED — `index.ts:302`; **and reachable from the installed package** (`import { camelCaseAttributes } from 'motion-dom'` → `.size === 23`)      |
| "26 entries"                                                                   | **FALSE — 23.** Source count and live `.size` agree                                                                                                 |
| `camelToDash` also exported                                                    | **OMITTED by v1** — it is (`'camelToDash' in md` → true); without this the executor hand-rolls the dash-caser, the exact vendoring v1 warns against |

### Finding 6 (guard-found, now normative point 4) — gate-vs-prefix ordering

The gate MUST run **after** `resolveSVGAttrKey` strips the `attr` prefix. Probed
against the real exports:

```text
attrX -> attr-x      attrScale -> attr-scale      viewBox -> viewBox
strokeDashoffset -> stroke-dashoffset             stroke-width -> stroke-width
```

`attrX` is not in `camelCaseAttributes`, so gating first emits the inert attribute
`attr-x` instead of `x`. Both orderings pass a naive `strokeDashoffset` test, so
nothing in the prior test plan caught it. Now point 4 with its own unit case.

### Finding 7 (guard-found, now conditional point 5) — v1 mandated dead code

v1's read-path requirement ("add a unit case covering one read-back through the
gate") had no caller to test: `svg.ts` is unimplemented, and the only
SVG-attribute `getAttribute` calls in `src/lib/` are hardcoded kebab strings in
the out-of-scope path pipeline (`_MotionContainer.svelte:882,888`). Requiring the
test would have forced the executor to build a read-back path it does not need.
Now conditional: the invariant binds _if_ a read-back is introduced, and the plan
explicitly says not to build one to satisfy the point.

All three corrections were adopted by the advisor into ruling **v2** (`5c307fe`),
which credits the guard verification. Points 1-3 stand as confirmation.

### Executor status — Findings 1-3 resolved

- e2e now reads the bound channel: `getComputedStyle(...).getPropertyValue(prop)`
  for `cx`/`r`/`stroke-*`, `getAttribute` for the `attr*` family; `parseFloat`
  replaces `Number` throughout (`motion-value-attributes.spec.ts`).
- First-paint assertion tightened `!Number.isNaN(...)` → `Number.isFinite(...)`.
- Unit: kebab-case allowlist cases added; SSR emitter cases pin `viewBox`
  unchanged and `strokeDashoffset` → `stroke-dashoffset`.
- Finding 3's vacuous static assertion — **not yet re-verified**; check at `final`
  that it reads the same channel the live element uses.

### Next after v2

- Executor implements Steps 1-5. `svg.ts` must import both `camelCaseAttributes`
  and `camelToDash` from `motion-dom` (no vendored copies), and order
  resolve-then-gate.
- At `final`: confirm Finding 3's fix, the point-4 ordering unit case exists, and
  that point 5 stayed unbuilt (no gratuitous read-back path).

---
