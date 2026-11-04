# Plan 006: Document and demonstrate `transition.mixer` (and the SVG `d` attribute)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do not edit the batch `README.md`.
>
> **Before starting**: this plan depends on plan 001 (Motion 14.9.1 pins). In lane `lane/1491-bump`, plan 001 is already merged into `feat/motion-14.9.1`. Merge `feat/motion-14.9.1` into the lane (`git merge --no-ff feat/motion-14.9.1`), run `pnpm install --frozen-lockfile`, and confirm `node -p "require('motion-dom/package.json').version"` prints `14.9.1`. If it doesn't, STOP.
>
> **Drift check**: `git diff --stat fb9ed218..HEAD -- src/routes/tests/motion docs/src/routes/docs docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts docs/src/routes/examples docs/src/lib/examples`. Only plan 001's new `tests/motion/accelerated-remount` page is expected. On anything else, compare and STOP on a mismatch.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (docs and tests; no library code)
- **Depends on**: 001-bump-motion-14-9-1.md
- **Wave**: 2
- **Category**: docs (net-new upstream feature)
- **Planned at**: commit `fb9ed218`, 2026-11-04

## Why this matters

Motion 14.8.0 added `transition.mixer`: a function `(from, to) => (progress) => value` that blends values Motion can't blend by default. The typical case is morphing SVG paths with different numbers of points. Our `MotionTransition` type is motion-dom's `AnimationOptions` (`src/lib/types.ts:299`), so after plan 001 the option already works on `motion.*`, `animate()` and `useAnimate()`. Users can't discover it, though, and nothing tests it in a real browser.

The repo's feature checklist (`CLAUDE.md`, "New feature checklist") asks for the following for each new feature:
- a test page under `src/routes/tests/<feature>/`, linked from `src/routes/+page.svelte`
- an e2e spec
- docs under `docs/src/routes/docs/<feature>/`
- an example under `docs/src/routes/examples/<feature>/`, with a demo component in `docs/src/lib/examples/<feature>/`

## Current state

- The mixer JSDoc in motion-dom 14.9.1 (`v14.9.1:packages/motion-dom/src/animation/types.ts:560-587`, read with `git -C ~/Github/motion show`) reads, abridged:
  - "a function that maps progress (`0`-`1`, or beyond with springs and overshooting easing) to a value, or `undefined` to blend them as usual"
  - "Animations between numbers … and those where the mixer returns `undefined` for every pair, run as they would without it. The rest run on the main thread … Animations that only run in the browser, like those from `motion/mini`, don't use it."
  - "A mixer can be asked for the same pair more than once, so keep any costly setup for when its function is first called."
  - Signature: `mixer?: (from: any, to: any) => Mixer<any> | undefined`.
- Upstream's browser test page, `v14.9.1:dev/html/public/playwright/animate/animate-mixer.html`, with its spec in `tests/animate/animate.spec.ts`. The page:
  - Morphs a triangle `M10 10L90 10L90 90Z` into a square `M10 10L90 10L90 90L10 90Z` with a corner mixer: `() => (p) => p >= 1 ? square : \`M10 10L90 10L90 90L${90 - 80 * p} 90Z\``.
  - Runs the same morph inside a sequence.
  - Holds `filter` at `blur(5px)` with `mixer: () => () => 'blur(5px)'`.
  - Shows that a numeric `opacity` with a mixer still blends normally (the mixer is never called).
  - Shows that `oklch` with a mixer returning `undefined` stays on WAAPI.
  - Uses long, linear options (`{ duration: 10, ease: 'linear' }`) so the mid-point can be sampled.
- 14.9.1 also writes SVG path data to the **`d` attribute**, not `style.d`, and removes it when unset (upstream 0757359b3, f84dcecf6). The test page should assert `getAttribute('d')`.
- Exemplars to copy:
  - Test page with TesterPanel: `src/routes/tests/motion/svg-path-length/+page.svelte`.
  - Docs page: `docs/src/routes/docs/transition-out/+page.svx`. Its imports use `#lib/...` and `#lib/....js` specifiers, never `$lib`.
  - Example route: `docs/src/routes/examples/transition-out/+page.svelte`, with its demo `docs/src/lib/examples/transition-out/demos/Default.svelte`.
  - Nav: `docs/src/lib/docsNav.ts:92` (`{ title: 'transition.out', href: '/docs/transition-out', icon: Activity }`) and `docs/src/lib/examplesIndex.ts:256` (the `'transition-out'` entry).
  - The existing `docs/src/lib/examples/path-morphing/demos/Default.svelte` uses `flubber`'s `interpolate` through `useTransform`. The new example can use `flubber` as a mixer (`mixer: (a, b) => interpolate(a, b)`), since flubber is already a docs dependency.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| e2e (one file) | `PW_PORT=4231 pnpm exec playwright test --project=chromium e2e/motion/transition-mixer.spec.ts` | as per step |
| Docs | `pnpm build && pnpm --dir docs build && pnpm --dir docs check && pnpm --dir docs test` | exit 0, 0 errors |
| Docs browser | `pnpm exec playwright test --config docs/playwright.config.ts` | all pass |
| Format / lint | `trunk fmt <files>`; `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, never `git stash`. Revert any `docs/static/r/animated-tabs.json` change from the docs build.

## Scope

**In scope:**
- `src/routes/tests/motion/transition-mixer/+page.svelte` (create)
- `e2e/motion/transition-mixer.spec.ts` (create)
- `src/routes/+page.svelte` (one link)
- `docs/src/routes/docs/transition-mixer/+page.svx` (create)
- `docs/src/routes/examples/transition-mixer/+page.svelte` (create)
- `docs/src/lib/examples/transition-mixer/demos/Default.svelte` (create)
- `docs/src/lib/docsNav.ts` (one entry)
- `docs/src/lib/examplesIndex.ts` (one entry)
- `.changeset/transition-mixer-docs.md` (create)

**Out of scope:**
- Any `src/lib` code. If `mixer` doesn't work on `motion.path`, that is a STOP: report it, don't fix it here.
- `useTransform`'s mixer acceleration (plan 002).

## Git workflow

- Lane branch `lane/1491-bump`. Use conventional commits, e.g. `test(motion): transition.mixer page and e2e` and `docs: transition.mixer page and example`.
- End each commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

There is no red step: this documents a net-new upstream option that arrives with plan 001, so there is no earlier behaviour to pin.

### Step 1: Test page and e2e

1. **`src/routes/tests/motion/transition-mixer/+page.svelte`**: a Svelte port of upstream `animate-mixer.html`, using `motion.path` / `motion.div` with `animate` + `transition` props in place of `animate()` calls. Ids: `single`, `filter`, `opacity`, `oklch`. Also keep a `sequence` case using `animate()` from `$lib` with a segment array, as upstream does. Use the same paths, the same corner mixer and the same `{ duration: 10, ease: 'linear' }`.
   - Add `#unset`: a `motion.path` bound to a `$state` `d`. A button sets it to `undefined`, which should remove the attribute.
   - Add a `TesterPanel` with steps and expected text, for example "the triangle grows a fourth corner over 10 s", "the second box stays blurred at 5px" and "opacity fades normally".
   - Add live chips: the `single` path's `getAttribute('d')` corner count at 5 s, the `filter` value, and whether the opacity mixer was called.
   - Make sure nothing sits under the 360 px panel at 1920 wide.
2. **`e2e/motion/transition-mixer.spec.ts`**: port the mixer cases from upstream `tests/animate/animate.spec.ts` at v14.9.1, citing them in the header comment. Find them with `git -C ~/Github/motion show v14.9.1:tests/animate/animate.spec.ts | grep -n mixer`. Assert:
   - At about the mid-point, `single`'s `d` attribute has 4 points with the moving x between 10 and 90, and `style.d` is empty.
   - `filter` computes `blur(5px)`.
   - `opacity` is between 0 and 1 and the mixer flag stayed false.
   - After clicking unset, `#unset` has no `d` attribute.
3. Link the page from `src/routes/+page.svelte` next to the other `tests/motion` entries.

**Verify**: `PW_PORT=4231 pnpm exec playwright test --project=chromium e2e/motion/transition-mixer.spec.ts` → all pass.

### Step 2: Docs page, example and nav

1. **`docs/src/routes/docs/transition-mixer/+page.svx`**:
   - Model it on `transition-out`, with "(Motion 14.8)" in the intro.
   - Sections: what a mixer is, its signature, the `d` morph example (`<motion.path animate={{ d }} transition={{ mixer: morph }} />`), "return `undefined` to blend as usual", numbers still blend normally, and it runs on the main thread (not with `animateMini`).
   - Add a tip to keep costly setup inside the returned function, and embed the example.
2. **Demo** (`docs/src/lib/examples/transition-mixer/demos/Default.svelte`): a shape that morphs between two paths with different point counts using `flubber`'s `interpolate` as the mixer, toggled by a button.
3. **Example route** (`docs/src/routes/examples/transition-mixer/+page.svelte`): wire the demo in the same way as the `transition-out` example route.
4. **Nav**: add an entry next to `transition.out` in `docsNav.ts` and `examplesIndex.ts`, matching their shape.

**Verify**: the docs command row and the docs browser row → all pass.

### Step 3: Changeset and gate

1. Create `.changeset/transition-mixer-docs.md` with frontmatter `'@humanspeak/svelte-motion': patch`. Body: "Document `transition.mixer` (Motion 14.8), which blends values Motion can't, such as SVG paths with different point counts, with a docs page, an example and a browser test."
2. Run `pnpm check`, then `pnpm test:only`, then trunk on the changed files.

**Verify**: all green.

## Test plan

- Net-new upstream option, so there is no red-first step.
- `transition-mixer.spec.ts` is the browser proof of four things: the mixer drives `d`, a mixer can hold a string value, numbers ignore the mixer, and unsetting removes the attribute.

## Maintenance note

If upstream changes when the mixer is consulted (for example WAAPI vs the main thread), update the docs' "where it runs" paragraph and the opacity/oklch assertions together.

## STOP conditions

- After plan 001's merge, `motion.path` with `transition={{ mixer }}` doesn't call the mixer, or `d` lands in `style`. That is a library issue; report it.
- The docs build rejects `flubber` in the new demo. Report it and fall back to the hand-written corner mixer from the test page.
