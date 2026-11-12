# Plan 005: Pinch docs page and the pinch-to-zoom photo example

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.** Never use or kill port 4198. Never set `PW_REUSE_SERVER`. The docs Playwright config uses its own fixed port (5201); run it while no other lane is running it.
>
> **Drift check (run first)**: `git diff --stat 82bf6e74..HEAD -- docs/src/routes/docs/pinch docs/src/routes/examples/pinch docs/src/lib/examples/pinch docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts docs/src/routes/docs/lazy-motion docs/src/routes/docs/gestures docs/src/routes/docs/drag`
> The only expected change is plan 002's two sentences in `docs/src/routes/docs/gestures/+page.svx` (section "Interrupts carry momentum"). If anything else changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (docs only)
- **Depends on**: 004-pinch-prop.md (the demos import `pinchFeatures` and use the `pinch` prop). It also documents the vanilla `pinch()` that plan 001 exports.
- **Wave**: 3
- **Category**: docs
- **Planned at**: commit `82bf6e74`, 2026-11-12

## Why this matters

Pinch is the headline feature of this release, and it has a setup step that is easy to miss: the `pinch` prop does nothing until `pinchFeatures` is loaded through `LazyMotion`. The repo's feature checklist (`CLAUDE.md`, "New feature checklist") requires a public docs page under `docs/src/routes/docs/<feature>/`, an example page under `docs/src/routes/examples/<feature>/`, and reusable demo components under `docs/src/lib/examples/<feature>/`. The example to recreate is upstream's photo demo: pinch to zoom and twist a card while dragging it; it resists past its limits, springs back, and snaps to the nearest 90°.

## Current state

- **API after plans 001 and 004** (confirm by reading `src/lib/index.ts`, `src/lib/types.ts` and `src/lib/features/pinchFeatures.ts`; if `pinchFeatures` is missing, STOP):
  - Vanilla: `pinch(elementOrSelector, options?)` and `pinch(elementOrSelector, onPinchStart, options?)`, returning a function that removes the gesture. `onPinchStart(element, startEvent)` may return nothing, an end handler `(event, info) => void`, or `{ onPinch, onComplete }`.
  - Component: `pinch?: boolean | PinchProps` and `whilePinch` on every motion component, enabled only inside `<LazyMotion features={…pinchFeatures…}>`. This holds for `motion.*` components too: pinch is not part of `domMax`.
  - `PinchProps` = options + `onStart`, `onMove`, `onEnd`, each `(event, info) => void`.
  - Options: `scale?: boolean | { min?, max? }` (default `true`), `rotate?: boolean | { min?, max?, snap? }` (default `true`, degrees), `pan?: boolean` (default `true`: the element follows the focal point), `origin?: 'pointer' | { x, y }` (default `'pointer'`; `{ x, y }` is a fraction of the element's size, `{ x: 0.5, y: 0.5 }` is its centre; with `pan: false` the default is the centre), `elastic?: boolean | number | { min?, max? }` (default `0.35`; `0` stops at the limit, `1` does not resist), `snapToOrigin?: boolean`, `transition?: SpringOptions` (the spring used to return inside limits, to a snap angle or to the origin).
  - `PinchInfo`: `point` (focal point in client coordinates), `offset` (how far it moved), `scale` (relative to the gesture's start), `rotate` (degrees since the start).
  - Input sources: two touches or pens, a trackpad pinch (ctrl + wheel in Chrome, Edge, Firefox), Safari's `gesture*` events. A Mac trackpad in Chrome reports no rotation.
  - While pinch is on, the element gets `touch-action: none` unless its `style` sets a `touch-action` (for example `pan-y` so a pinchable list still scrolls with one finger).
  - Pinch composes with `drag`: a drag started by one of the touches carries on from where the pinch leaves the element. Drag constraints are not applied while pinching. It assumes the default `transform-origin` (the centre).
- **Upstream references** (`~/Github/motion` at `v14.12.0`; read with `git -C ~/Github/motion show v14.12.0:<path>`): the JSDoc in `packages/motion-dom/src/gestures/pinch/index.ts:18-197` (types) and `:880-908` (`pinch()`), `packages/framer-motion/src/render/dom/features-pinch.ts`, and the demo `dev/react/src/examples/Pinch-photo.tsx`:
  ```tsx
  <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
      <motion.div
          drag
          dragMomentum={false}
          pinch={{ scale: { min: 1, max: 4 }, rotate: { snap: 90 } }}
          style={{ width: 300, height: 200, borderRadius: 20,
                   background: "linear-gradient(135deg, #ff0088 0%, #8800ff 100%)" }}
      />
  </LazyMotion>
  ```
- **Our docs** (the most recent complete example of a new feature's docs is `reorder-board`; copy its pieces):
  - Docs page: `docs/src/routes/docs/reorder-board/+page.svx`. Frontmatter `title`/`description`, then a `<script>` that imports `Example` from `'#lib/components/general/Example.svelte'`, a demo from `'#lib/examples/<feature>/demos/<Name>.svelte'`, and sets the SEO block (`seo.title`, `seo.description`, `seo.ogTitle`, `seo.ogTagline`, `seo.ogFeatures`, `seo.ogSlug`). The demo renders as `<Example><Demo /></Example>`.
  - Example page: `docs/src/routes/examples/tap-options/+page.svelte` (imports `CodeReferenceV2`, `ExampleV2`, `ExampleSection`, `formatSheetLabel` from `@humanspeak/docs-kit`, `demoCodeSample` from `'#lib/demo-loaders.js'`, sets breadcrumbs and the SEO block, then builds `sections: ExampleSection[]`). `docs/src/routes/examples/reorder-board/+page.ts` is the `load` that returns `title` and `description`.
  - Demos: `docs/src/lib/examples/tap-options/demos/Default.svelte`. Demos import the library as `'@humanspeak/svelte-motion'` (the built `dist`, not `$lib`).
  - `docs/src/lib/docsNav.ts:101-106`, the Gestures group:
    ```ts
            title: 'Gestures',
            icon: Hand,
            items: [
                { title: 'Gestures (overview)', href: '/docs/gestures', icon: Hand },
                { title: 'Drag', href: '/docs/drag', icon: Hand },
                { title: 'Pan', href: '/docs/pan', icon: Hand },
    ```
  - `docs/src/lib/examplesIndex.ts:249-253`, the shape of an entry:
    ```ts
    'tap-options': {
        title: 'Tap options',
        description:
            'Double tap, long press and auto-repeat from one tap gesture, with the tap prop’s count, hold and repeat.'
    },
    ```
  - `docs/src/routes/docs/lazy-motion/+page.svx:40-48`, the "Feature bundles" table (`domMin`, `domAnimation`, `domMax`).
  - Find every registration point of a feature with `grep -rln "reorder-board" docs/src docs/static`. Hand-edited: `docsNav.ts`, `examplesIndex.ts`, `demo-loaders.ts`. The rest (`sitemap-manifest.json`, `demo-manifest.json`, `docs/static/**/*.md`, `llms*.txt`) are written by the docs build.
- **Conventions**:
  - Docs files import with `#lib/....js` specifiers, never `$lib`.
  - The docs site consumes the library's built `dist`. Run `pnpm build` at the repo root before any docs command, and again after pulling library changes.
  - `pnpm --dir docs build` rewrites `docs/static/r/animated-tabs.json`; always revert that file.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Build library | `pnpm build` | exit 0 |
| Docs build | `pnpm --dir docs build` | exit 0 |
| Docs types | `pnpm --dir docs check` | 0 errors |
| Docs units | `pnpm --dir docs test` | all pass |
| Docs SEO | `pnpm --dir docs test:geo-seo` | all pass |
| Docs browser | `pnpm exec playwright test --config docs/playwright.config.ts` | all pass |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**In scope:**
- `docs/src/routes/docs/pinch/+page.svx` (create)
- `docs/src/routes/examples/pinch/+page.svelte` and `+page.ts` (create)
- `docs/src/lib/examples/pinch/demos/Photo.svelte`, `Limits.svelte`, `Vanilla.svelte` (create)
- `docs/src/lib/docsNav.ts` (one entry, after Pan), `docs/src/lib/examplesIndex.ts` (one entry), `docs/src/lib/demo-loaders.ts` (only if `reorder-board`/`tap-options` demos are registered there by hand)
- `docs/src/routes/docs/lazy-motion/+page.svx` (one table row and one sentence)
- `docs/src/routes/docs/gestures/+page.svx` (a short `## whilePinch` section linking to the pinch page)
- `docs/src/routes/docs/drag/+page.svx` (one sentence under its related links or notes, linking to the pinch page)
- `docs/src/lib/compare-data.ts` (only if it enumerates gestures; add a pinch row)
- Files the docs build regenerates for the new pages, if they are tracked (`git ls-files --error-unmatch <file>` exits 0)

**Out of scope:**
- Any `src/lib` code. If a demo exposes a pinch bug, STOP and report it.
- `docs/static/r/*.json`.
- The existing `velocity-interrupts`, `vanilla-drag` and `tap-options` examples.

## Git workflow

- Lane branch `lane/14120-pinch-docs`, cut from `feat/motion-14.12.0` after plan 004 is merged.
- A conventional commit, for example `docs(pinch): pinch page and pinch-to-zoom photo example`.
- Do not push.

## Steps

### Step 1: Demos

All three import from `'@humanspeak/svelte-motion'`.

1. `Photo.svelte` (the headline demo): a port of upstream's `Pinch-photo.tsx`. `<LazyMotion features={{ ...domMax, ...pinchFeatures }}>` around a `motion.div` with `drag`, `dragMomentum={false}`, `pinch={{ scale: { min: 1, max: 4 }, rotate: { snap: 90 } }}`, `whilePinch={{ boxShadow: '0 12px 40px #0006' }}`, and a 300×200 gradient card (an image is fine if the docs already ship one that suits). Add a live readout of scale and rotation from `onMove`, a "Reset" button (animate `scale` to 1 and `rotate`, `x`, `y` to 0), and one line of hint text: "Trackpad: pinch. Touch: pinch and twist with two fingers." Keep the card inside its demo frame with `overflow: hidden` on the frame.
2. `Limits.svelte`: two small cards side by side showing `elastic: 0` (hard stop) against the default (resists, springs back), both with `scale: { min: 0.5, max: 2 }`, and a third with `snapToOrigin`.
3. `Vanilla.svelte`: a plain `<div>` bound with `bind:this`, made pinchable in `onMount` with `pinch(el, () => ({ onPinch: (_, info) => …, onComplete: … }), { rotate: { snap: 45 } })`. Return the stop function from `onMount`. Show the event log.

Each demo needs a visible focus-free fallback line for mouse users ("hold ctrl and scroll over the card").

**Verify**: `pnpm build && pnpm --dir docs check` → 0 errors.

### Step 2: Docs page

Create `docs/src/routes/docs/pinch/+page.svx`, copying the frontmatter and SEO block layout of `docs/src/routes/docs/reorder-board/+page.svx`. Sections:
- intro (one paragraph) and the `Photo` demo;
- `## Setup` — the `LazyMotion` + `pinchFeatures` requirement, stated first and plainly: without it the prop does nothing, on `motion.*` components too. Show `features={{ ...domMax, ...pinchFeatures }}` and `features={pinchFeatures}`;
- `## Usage` — `pinch` as a boolean and with options;
- `## Limits and elasticity` — `scale`/`rotate` `{ min, max }`, `elastic`, with the `Limits` demo;
- `## Rotation and snapping` — `rotate.snap`, `snapToOrigin`, `transition`;
- `## Panning and origin` — `pan`, `origin`;
- `## Callbacks` — `onStart`, `onMove`, `onEnd` and the `PinchInfo` table;
- `## whilePinch` — like `whileDrag`; variant labels reach children;
- `## With drag` — the hand-off, and that constraints are not applied while pinching;
- `## touch-action` — the default `none`, and keeping `pan-y` for a scrolling list;
- `## Vanilla pinch()` — both call forms, the three return shapes of the start callback, cleanup, `scopeMotion`, with the `Vanilla` demo;
- `## Input support` — touches, trackpad, Safari; no rotation from a Mac trackpad in Chrome;
- `## Options` — one table of every option with its default;
- `## Related` — Gestures, Drag, LazyMotion.

Credit Motion 14.11 as the origin. Port wording from upstream's JSDoc where it is clearer than your own; convert every snippet to Svelte.

### Step 3: Example page and registration

1. Create `docs/src/routes/examples/pinch/+page.svelte` with three `ExampleSection`s (Photo, Limits, Vanilla), copying `docs/src/routes/examples/tap-options/+page.svelte`, and `+page.ts` copying `docs/src/routes/examples/reorder-board/+page.ts`. Title "Pinch"; description "Pinch to zoom, rotate and move an element, with elastic limits and rotation snapping."
2. `docs/src/lib/docsNav.ts`: add `{ title: 'Pinch', href: '/docs/pinch', icon: Hand }` after the Pan entry.
3. `docs/src/lib/examplesIndex.ts`: add a `pinch` entry in alphabetical position.
4. Register the demos wherever `tap-options` demos are registered by hand (`grep -n "tap-options" docs/src/lib/demo-loaders.ts`).
5. `docs/src/routes/docs/lazy-motion/+page.svx`: add a table row `| `pinchFeatures` | the `pinch` prop and `whilePinch`; spread it with another bundle |` and one sentence below the table saying pinch is not part of `domMax` and applies to `motion.*` components as well, with a link to `/docs/pinch`.
6. `docs/src/routes/docs/gestures/+page.svx`: add `## whilePinch` after the `whileInView` section (before `## Composing with transition`): two sentences and a link.
7. `docs/src/routes/docs/drag/+page.svx`: one sentence linking to `/docs/pinch#with-drag`.
8. `grep -n -i "drag\|gesture" docs/src/lib/compare-data.ts`: if it enumerates gestures per library, add a pinch row marked as matching Motion.

**Verify**: `pnpm build && pnpm --dir docs build && pnpm --dir docs check && pnpm --dir docs test && pnpm --dir docs test:geo-seo` → all pass. Then `pnpm exec playwright test --config docs/playwright.config.ts` → all pass. Revert `docs/static/r/animated-tabs.json`. Run `git status --short docs/` and keep regenerated files only if they are tracked and their diff is about the new pinch pages.

### Step 4: Format

Run `trunk fmt` and `trunk check` on the changed files.

**Verify**: no new issues.

## Test plan

Docs only, so there is no red-first test: no runtime behaviour changes here. The gates are the docs build, the typecheck, the docs unit tests (including the SEO title policy), the geo-seo check and the docs browser projects.

## Done criteria

- [ ] `docs/src/routes/docs/pinch/+page.svx` and `docs/src/routes/examples/pinch/+page.svelte` exist
- [ ] `grep -n "pinch" docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts` → a match in each
- [ ] `grep -n "pinchFeatures" docs/src/routes/docs/lazy-motion/+page.svx docs/src/routes/docs/pinch/+page.svx` → matches in both
- [ ] `grep -rn "\$lib" docs/src/routes/docs/pinch docs/src/routes/examples/pinch docs/src/lib/examples/pinch` → no match
- [ ] Docs build, check, test, test:geo-seo and browser projects all pass
- [ ] `git diff --stat docs/static/r` is empty
- [ ] Only in-scope files changed

## STOP conditions

- `pinchFeatures` is not exported from the built package (plan 004 is not merged, or `pnpm build` was not run).
- A demo misbehaves in the docs dev server in a way that points to a library bug (a jump when a pinch starts during a drag, scale not springing back, the page zooming while pinching the card).
- The SEO title policy test (`docs/src/lib/seo-title-policy.spec.ts`) rejects the new pages and the fix is not a title tweak.

## Maintenance notes

- The docs page states that pinch needs `pinchFeatures` on `motion.*` components too. If that gating ever changes in `_MotionContainer.svelte`, update `## Setup` and the LazyMotion page together.
- The demo pages go to the maintainer for live sign-off before any PR, next to an upstream twin of `Pinch-photo.tsx` (see the batch README).
- Reviewer: check every snippet is Svelte (no JSX), and that the options table matches `PinchOptions` in the installed `motion-dom`.
