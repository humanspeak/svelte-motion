# Plan 002: Pin that values animated without a base value never render placeholders

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.5.0/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9eba7a61..HEAD -- src/routes/tests/svg src/routes/+page.svelte e2e/svg`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (tests and a demo page only)
- **Depends on**: none
- **Category**: tests (upstream parity characterization)
- **Planned at**: commit `9eba7a61`, 2026-10-01

## Why this matters

Motion 13.5.0 (installed) fixed a long-standing bug (motion #2791, PR #3850):
a value animated without a base value was rendered before its origin was read,
so the DOM briefly got placeholders like `points="undefined"` or `NaN`. The
keyframe resolver could then read that garbage back as the animation's origin.
We picked up the fix inside motion-dom's VisualElement. But our component also
writes first-paint and SSR attributes itself (`src/lib/utils/svg.ts`, the SVG
render path in `src/lib/html/_MotionContainer.svelte`), outside the
VisualElement. So it is unknown whether we're clean. This plan ports upstream's
regression fixture as a permanent test. If it fails, we have found a real bug,
and the fix gets its own plan.

## Current state

Upstream fixture `dev/react/src/tests/animate-unresolved-origin.tsx` (Motion v13.5.0):

```tsx
const pointPairs = [
    ["0,20 550,38", "720,38 712,50 389,50 380,36"],
    ["710,38 712,50 389,50 380,36", "850,38 830,50 400,50 390,36"],
]
export const App = () => (
    <>
        <svg width="900" height="100">
            {pointPairs.map(([from, to], i) => (
                <motion.polygon key={i} points={from} animate={{ points: to }}
                    transition={{ delay: 0.2 * i, duration: 3, type: "spring" }} />
            ))}
        </svg>
        <div style={{ "--x": 50 }}>
            <motion.div id="css-var" animate={{ "--x": 100 }}
                transition={{ ease: "linear", duration: 10 }} />
        </div>
    </>
)
```

Upstream assertions (`packages/framer-motion/cypress/integration/animate-unresolved-origin.ts`):

1. It patches `Element.prototype.setAttribute` before load and records every
   `points` write. After 1s there are more than 2 writes, and none match `/NaN|undefined/u`.
2. After 5s, `#css-var`'s computed `--x` is within `[65, 85]`. It animated from
   the **inherited** 50, not from 0.

Conventions:

- SVG test pages live in `src/routes/tests/svg/<name>/+page.svelte`, and specs in
  `e2e/svg/<name>.spec.ts`. Exemplar: `e2e/svg/motion-value-attributes.spec.ts`
  (`const ROUTE = '/tests/svg/motion-value-attributes'`).
- Index links go in `src/routes/+page.svelte` next to the existing
  `/tests/svg/motion-value-attributes` `<li>` (around line 882), using the same
  `<li><a class="text-blue-300 hover:underline" href={resolve(...) + searchParams}>`.
- Human-reviewed pages carry a guided `TesterPanel`
  (`src/routes/tests/layout/_parity/TesterPanel.svelte`), which is hidden under
  `?@isPlaywright=true`. Exemplar usage:
  `src/routes/tests/use-scroll/view-timeline-offsets/+page.svelte`.

## Commands you will need

| Purpose   | Command                                                              | Expected       |
| --------- | -------------------------------------------------------------------- | -------------- |
| e2e       | `pnpm exec playwright test e2e/svg/unresolved-origin.spec.ts`        | all pass       |
| Typecheck | `pnpm check`                                                         | 0 errors       |
| Lint      | `trunk fmt <files>` then `trunk check --no-fix <files>`              | no issues      |

Port 4198 is the maintainer's sign-off port. Never kill it. If it is busy,
report e2e as blocked.

## Scope

**In scope:** `src/routes/tests/svg/unresolved-origin/+page.svelte` (create),
`e2e/svg/unresolved-origin.spec.ts` (create), one link in `src/routes/+page.svelte`,
and the README status row.

**Out of scope:** any library source under `src/lib/`. If the tests fail, STOP.
Do not fix library code under this plan.

## Steps

### Step 1: Fixture page

Create the page mirroring the upstream fixture in Svelte: two `<motion.polygon>`
elements inside an `<svg width="900" height="100">` with `points={from}`,
`animate={{ points: to }}`, and `transition={{ delay: 0.2 * i, duration: 3, type: 'spring' }}`.
Also add a wrapper `<div style="--x: 50">` containing `<motion.div id="css-var"
animate={{ '--x': 100 }} transition={{ ease: 'linear', duration: 10 }} />`. Give
both polygons a visible `fill`. Add a `TesterPanel` with steps:

- "Reload the page and watch the shapes."
- Expected: "Both shapes morph smoothly from the start. No flash, no shape collapsing to a corner."

Add a live readout of `--x` (tester only), expected to climb from 50 to 100 over
10s. Add a "Replay" button that remounts the fixture (`{#key n}`). Link it from the
index as `SVG unresolved animation origins`.

**Verify**: `pnpm check` → 0 errors.

### Step 2: Spec

Create `e2e/svg/unresolved-origin.spec.ts`:

1. `page.addInitScript` patches `Element.prototype.setAttribute` to push every
   `points` value into `window.__points`. Navigate to `?@isPlaywright=true`, wait
   1500ms, read `window.__points`, and expect length > 2 with no value matching
   `/NaN|undefined/u`.
2. Sample `#css-var`'s `getComputedStyle(el).getPropertyValue('--x')` every 100ms
   for the first 1.5s. Every sample is ≥ 49.9 (it never starts from 0), and the last
   is > 50.5 (it is moving). Then poll until the value is ≥ 60 within 6s.
3. The index link exists, with the same pattern as other specs.

**Verify**: `pnpm exec playwright test e2e/svg/unresolved-origin.spec.ts` → all pass.

## Test plan

This is a characterization of behavior that Motion 13.5.0 fixed, so no red step
is planned: today's library is expected to pass. **If any assertion fails, that
is the finding.** Record the failing values verbatim (the offending `points`
strings, or the `--x` samples) and STOP. The advisor will plan the fix separately.

## Done criteria

- [ ] Page, spec, and index link exist; spec passes (3 tests)
- [ ] `pnpm check` 0 errors; trunk clean on touched files
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- Any spec assertion fails on unmodified library code. Report it; do not fix it.
- The page can't express the fixture without library changes.

## Maintenance notes

If this ever fails after a Motion bump, compare against upstream's
`animate-unresolved-origin` test first. The regression may be upstream.
