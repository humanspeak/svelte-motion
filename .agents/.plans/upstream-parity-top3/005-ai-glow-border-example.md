# Plan 005: Ship the Apple Intelligence wavy glow border as a flagship example — smooth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `.agents/.plans/upstream-parity-top3/README.md`.
>
> **Drift check (run first)**: `git diff --stat 634983b..HEAD -- src/lib/utils/svg.ts src/lib/utils/effects.ts docs/src/lib/docsNav.ts`
> Also confirm Plan 002's status is DONE in the batch README — this plan's
> declarative SVG-attribute form depends on it (see Dependencies).

## Status

- **Priority**: P2 (execute LAST — after 002; benefits from 001)
- **Effort**: M
- **Risk**: LOW–MED (the risk is performance, not correctness — the frame
  budget in Done criteria is the gate)
- **Depends on**: 002-svg-motionvalue-attributes.md (declarative
  `MotionValue` → SVG filter attribute binding). If 002 is not DONE, the
  `attrEffect` escape hatch (shipped today) is an acceptable fallback — note it
  in the README row and add a TODO comment referencing #435 at each fallback
  site.
- **Category**: direction (flagship docs example)
- **Planned at**: commit `634983b`, 2026-07-08
- **Issue**: <https://github.com/humanspeak/svelte-motion/issues/439>

## Why this matters

The wavy Apple Intelligence border (reference:
<https://www.youtube.com/watch?v=IopL3YyM8D0>) is a high-recognition effect no
CSS-only recreation fully nails — the public pens each miss the palette, the
organic waviness, or the bloom. A motion library is exactly what the effect
needs (independent springs per animated channel), so a faithful, SMOOTH
version is a flagship differentiator demo for svelte-motion and a showcase for
the SVG-attribute binding shipped in Plan 002. A working visual prototype
exists and validates the layer recipe; it also demonstrated the performance
traps this plan requires you to avoid.

## Current state

- **Reference prototype** (open it in a browser first):
  `.agents/.plans/upstream-parity-top3/assets/ai-glow-prototype.html` —
  vanilla HTML/CSS/JS, correct LOOK, poor frame pacing. The maintainer's
  verdict: "ok demo but not smooth at all". Your job is the same visual with
  compositor-friendly architecture and motion values.
- The library already ships everything needed except declarative SVG-attribute
  binding: `useMotionValue`/`useSpring`/`useMotionTemplate`
  (`src/lib/utils/*.svelte.ts`), `attrEffect`/`styleEffect`
  (`src/lib/utils/effects.ts`), `animate` re-export (`src/lib/index.ts:25` —
  note: if Plan 001 is DONE, `animate(mv, …)` needs no cast; if not, follow the
  existing `as unknown as RawMotionValue` convention in
  `src/routes/tests/ai-gradient-card/+page.svelte:18`).
- Related existing example to match conventions against:
  `docs/src/lib/examples/ai-gradient-card/` + `src/routes/tests/ai-gradient-card/`
  (conic gradient + `useMotionTemplate` — this plan's little sibling).
- Docs conventions: example components under `docs/src/lib/examples/<slug>/demos/`,
  example route under `docs/src/routes/examples/<slug>/`, nav entry in
  `docs/src/lib/docsNav.ts`, sitemap via `pnpm --filter docs sitemap:manifest`.

## The layer recipe (validated in the prototype)

Palette (canonical Apple Intelligence, from the SwiftUI reference
implementation): `#BC82F3 #F5B9EA #8D9FFF #AA6EEE #FF6778 #FFBA71 #C686FF`.

1. **Color field** — conic-gradient of the 7 colors, rotating slowly.
2. **Hot spots** — 4 blurred color blobs orbiting the card perimeter at
   incommensurate angular speeds (e.g. 0.21 / −0.16 / 0.12 / −0.26 rad·s⁻¹)
   with sinusoidal radius wobble → non-repeating brightness travel.
3. **Wavy edge** — SVG `feTurbulence` (fractalNoise, baseFrequency ≈ 0.011–0.014,
   2 octaves) → `feDisplacementMap` (scale ≈ 26 idle / ≈ 40 listening). Two
   copies of the same noise counter-scrolled via `feOffset dy` and merged with
   `feComposite`, so the flow never visibly loops. **Displace first, blur
   after** — reversing the order makes the waves crunchy instead of liquid.
4. **Bloom** — ring copies at increasing band width/blur (≈9 / 26 / 58px), the
   upper layers on `mix-blend-mode: screen`.
5. **Hairline** — crisp 1px inner border on the card (depth contrast).
6. **Listening state** — clicking the card springs waviness (+55%), flow speed
   (+90%), bloom (+25%), plus a ±0.6% breathing scale pulse.

## Performance requirements (why the prototype janked — each is a MUST)

The prototype's four sins, and the required replacements:

1. **No per-frame CSS-variable writes on `:root`** (prototype updated
   `document.documentElement` every frame → whole-document style recalc).
   Scope every animated custom property to the component wrapper — or better,
   avoid style-recalc channels entirely where a transform can do the job.
2. **Hot spots must be `transform`-driven elements**, not `background-position`
   radial-gradients (paint-bound). Four absolutely-positioned pre-blurred blob
   divs inside an overflow-clipped ring container, moved with
   `translate3d(x, y, 0)` from motion values (compositor-only). Use
   `styleEffect(blobEl, { x, y })` / bound `style={{ x, y }}` so writes go
   through motion's frameloop.
3. **The conic field must rotate via `transform: rotate()`** on an oversized
   (≈1.5×, square) child element, not by animating the gradient's `from` angle
   (gradient repaint per frame). GPU-composited rotation, driven by one motion
   value (or a CSS animation — but a motion value keeps the listening-state
   speed spring simple).
4. **Minimize the displacement raster area.** Apply `filter: url(#aiWave)`
   ONLY to the thin base ring band element. The wide haze layer gets NO
   displacement and NO per-frame changes — static blurred ring, cheap. The
   mid bloom layer may share the filter only if the frame budget holds;
   otherwise derive waviness visually from the base ring alone.
   Add `will-change: filter` on the filtered ring and `contain: layout paint`
   on the stage wrapper.

Also required: `prefers-reduced-motion` renders a static (non-animated) glow;
the component tears down all motion values/effects on unmount (follow the
cleanup pattern of `docs/src/lib/examples/ai-gradient-card/demos/Default.svelte`).

## MotionValue channel map (the point of the example)

| Channel                         | Driver                                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| conic rotation                  | `useMotionValue(0)` + `animate(v, 360, { repeat: Infinity, ease: 'linear', duration })` — duration springs shorter when listening |
| blob x/y (×4)                   | per-blob `useSpring` toward orbit targets computed in one `useAnimationFrame` callback                                            |
| noise scroll (`feOffset dy` ×2) | one motion value, bound to both offsets (negated for the second)                                                                  |
| displacement scale              | `useSpring` — idle 26 ↔ listening 40                                                                                              |
| bloom opacity                   | `useSpring` — idle 0.9 ↔ listening 1.15                                                                                           |
| pulse scale                     | `useSpring` 1 ↔ 1.008 + sine wobble while listening                                                                               |

SVG filter attributes (`feOffset dy`, `feDisplacementMap scale`) use Plan 002's
declarative binding (`<motion.feOffset dy={scroll}>` or the equivalent the plan
shipped); fall back to `attrEffect(filterEl, { dy })` only if 002 is not done.

## Commands you will need

| Purpose     | Command                                                       | Expected on success |
| ----------- | ------------------------------------------------------------- | ------------------- |
| Typecheck   | `pnpm check` and `pnpm --filter docs check`                   | exit 0              |
| Unit tests  | `pnpm test`                                                   | all pass            |
| e2e         | `pnpm exec playwright test e2e/motion/ai-glow-border.spec.ts` | all pass            |
| Docs dev    | `pnpm --filter docs dev`                                      | serves docs site    |
| Format/lint | `trunk fmt && trunk check`                                    | clean               |

e2e preview server pinned to port 4198 — do not change.

## Scope

**In scope** (create unless marked otherwise):

- `src/routes/tests/ai-glow-border/+page.svelte` (demo route)
- `src/routes/+page.svelte` (modify — link the demo)
- `e2e/motion/ai-glow-border.spec.ts`
- `docs/src/lib/examples/ai-glow-border/demos/Default.svelte` (reusable demo)
- `docs/src/routes/examples/ai-glow-border/` (example route)
- `docs/src/lib/docsNav.ts` (modify — nav entry)
- Docs sitemap regeneration

**Out of scope**:

- Library source (`src/lib/**`) — this is an EXAMPLE. If you find yourself
  needing a library change beyond what Plans 001/002 shipped, STOP and report.
- The archived prototype asset — reference only, do not "fix" it.
- Publishing/hero placement on the docs landing page — maintainer's call after
  sign-off.

## Git workflow

- Branch: `feat/ai-glow-border-example`
- Conventional commits, e.g. `feat(docs): Apple Intelligence wavy glow border example`
- Do NOT push or open a PR; the maintainer drives the live demo before sign-off
  (project convention — resize the browser to ≥1920 wide for review sessions).

## Steps

### Step 1: Build the demo route with the compositor-friendly architecture

`src/routes/tests/ai-glow-border/+page.svelte`, implementing the layer recipe
under the Performance requirements. Structure sketch:

```text
stage (contain: layout paint)
├─ glow-clip (ring mask, overflow hidden)
│   ├─ conic-rotor (1.5× square, transform: rotate ← MotionValue)
│   └─ blob ×4 (pre-blurred divs, translate3d ← springs)
├─ ring-base (thin band, filter: url(#aiWave) blur(9px), will-change: filter)
├─ ring-haze (wide band, static blur, screen blend — NO filter, NO animation)
├─ card (content + 1px hairline, scale ← pulse spring)
└─ svg defs: #aiWave (feTurbulence ×2 → feOffset ×2 ← MotionValue → feComposite → feDisplacementMap ← spring)
```

Include the listening-state toggle (click / keyboard-accessible button,
`aria-pressed`).

**Verify**: `pnpm check` → exit 0; `pnpm dev` and eyeball
`/tests/ai-glow-border` — waves flow with no loop seam, listening state boosts
smoothly.

### Step 2: Frame-budget instrumentation + e2e

`e2e/motion/ai-glow-border.spec.ts`:

1. Load the demo route; sample `requestAnimationFrame` deltas for 2 seconds via
   `page.evaluate`.
2. Assert p95 frame delta < 25ms (generous for CI) and zero deltas > 100ms
   after the first 500ms warmup.
3. Toggle listening state; assert the displacement scale attribute on
   `feDisplacementMap` increases (reads the DOM attribute) and the state chip /
   `aria-pressed` flips.
4. Reduced-motion case: emulate `prefers-reduced-motion: reduce`; assert the
   conic rotor's transform is static across two samples 500ms apart.

**Verify**: `pnpm exec playwright test e2e/motion/ai-glow-border.spec.ts` →
all pass. If the p95 gate fails, fix performance (re-check the four MUSTs)
before proceeding — do not loosen the threshold past 25ms without reporting.

### Step 3: Docs example

Port the demo into `docs/src/lib/examples/ai-glow-border/demos/Default.svelte`
(match the file layout of `docs/src/lib/examples/ai-gradient-card/`), create
the example route, add the nav entry, regenerate the sitemap
(`pnpm --filter docs sitemap:manifest`).

**Verify**: `pnpm --filter docs check` → exit 0; docs dev server renders the
example.

### Step 4: Full gates

**Verify**: `pnpm check && pnpm test` → exit 0; the new e2e spec passes;
`trunk fmt && trunk check` → clean.

## Test plan

Covered in Step 2 (frame budget, state toggle, reduced motion). No unit tests —
this is an example with no library-source surface; the e2e spec is the
verification layer.

## Done criteria

- [ ] `pnpm check`, `pnpm --filter docs check`, `pnpm test` all exit 0
- [ ] `pnpm exec playwright test e2e/motion/ai-glow-border.spec.ts` exits 0,
      including the p95 < 25ms frame gate
- [ ] `grep -rn "documentElement.style.setProperty" src/routes/tests/ai-glow-border docs/src/lib/examples/ai-glow-border` → 0 matches (perf MUST #1)
- [ ] Demo linked from `src/routes/+page.svelte`; docs nav entry + sitemap done
- [ ] Reduced-motion path verified by the e2e spec
- [ ] `git status` clean outside in-scope list; batch README row updated

## STOP conditions

Stop and report back if:

- Plan 002 is not DONE **and** the `attrEffect` fallback cannot bind an
  attribute the filter needs (e.g. a namespaced/read-only SVG attribute) —
  report the exact attribute.
- The p95 frame gate fails after implementing all four performance MUSTs —
  report profiler findings (which layer dominates) instead of shipping jank;
  the maintainer explicitly rejected the non-smooth prototype.
- Safari/WebKit renders `filter: url(#aiWave)` on HTML elements incorrectly
  (known WebKit weakness) — report with a screenshot; a WebKit-specific
  degradation path (waviness off, everything else on) is a maintainer decision.
- Matching the reference video's feel requires a channel the library cannot
  drive (i.e. you're about to edit `src/lib/**`).

## Maintenance notes

- This example doubles as a living regression test for Plan 002's SVG binding
  and (via its `animate(mv, …)` calls) Plan 001's typing fix — if either
  regresses, this page breaks visibly.
- Reviewer should scrutinize: DevTools Performance trace on the demo route
  (no per-frame style-recalc of the document, displacement raster confined to
  the ring), and teardown (navigate away → no lingering rAF/motion values).
- Deferred: docs landing-page hero placement; a `<AIGlowBorder>` reusable
  library component (only if users ask — examples stay examples until then).
