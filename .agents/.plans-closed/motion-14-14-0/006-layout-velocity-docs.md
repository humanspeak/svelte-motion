# Plan 006: Document layout velocity and `mass: "auto"`, with an example page

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: docs e2e uses the docs Playwright config and its own fixed port. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 4665b907..HEAD -- docs/src/routes/docs/layout-animations docs/src/routes/docs/use-spring docs/src/routes/examples docs/src/lib/examples docs/src/lib/examplesIndex.ts docs/src/lib/docsNav.ts`
> Expected: no output (plan 002 edits only `docs/src/routes/docs/api-reference`). If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (docs and a demo; no library code)
- **Depends on**: 003-layout-velocity.md (the demos import the built package, which must carry velocity through an interrupt; `mass: "auto"` needs plan 001's pin)
- **Wave**: 3
- **Category**: docs
- **Planned at**: commit `4665b907`, 2026-11-14

## Why this matters

Motion 14.13 added two things to layout animations that users have to opt into, so they need to be told: a spring layout transition now carries the element's velocity through an interrupt, and `mass: "auto"` sizes the spring's mass to the element. Neither does anything with the default layout transition (a tween). Without docs and a demo, nobody will find them.

## Current state

- **What the feature does** (motion-dom 14.14.0, `packages/motion-dom/src/projection/node/create-projection-node.ts`; read with `git -C ~/Github/motion show v14.14.0:<path>`):
  - Only a layout transition with `type: 'spring'` takes velocity (`:2045`), and not when it has `repeat` (`:2094`). A tween starts from rest. A spring set with `duration` also starts from rest, so it ends on time; springs set with `visualDuration`/`bounce` or `stiffness`/`damping` carry velocity.
  - Each edge of the box gets its own spring, so an edge that does not move stays still while the others carry their speed, and a thrown element keeps its size.
  - A child animating inside an animating parent keeps its place in the parent and carries only its own velocity relative to it.
  - A dragged element that hands off to another with the same `layoutId` passes on its throw velocity.
  - `mass: "auto"` (`projection/animation/layout-velocity.ts:18-34`): mass is the element's size (the square root of width × height) divided by 300, clamped to 0.25 to 2. A 300 px square has mass 1. Damping is scaled with mass so the bounce stays the same; bigger elements settle later. Outside a layout animation, `"auto"` behaves like the default mass of 1.
  - The default layout transition is unchanged: `{ duration: 0.45, ease: [0.4, 0, 0.1, 1] }` (`:2926`).
- **Docs files**:
  - `docs/src/routes/docs/layout-animations/+page.svx`: sections `## Single-element layout animation` (`:29`), `## Shared layout with layoutId` (`:47`), `## Scrolling and layout animations` (`:125`), `## API reference` (`:177`) with `### Layout animation callbacks` (`:195`) and `### layoutRoot and layoutAnchor` (`:202`), then `## Related` (`:209`).
  - `docs/src/routes/docs/use-spring/+page.svx` has an options table with a `mass` row. `docs/src/routes/docs/gestures/+page.svx` has "### Interrupts carry momentum", which links to `/examples/velocity-interrupts`.
  - Docs are `.svx` (mdsvex). They must not import `$lib`; demos import `@humanspeak/svelte-motion` (the built package) and docs code imports use `#lib/….js` specifiers.
- **Example conventions** (model: the `layout-root` example):
  - Demos: `docs/src/lib/examples/layout-root/demos/{CenteredAnchor,SidebarTabs}.svelte`, each a self-contained component importing from `@humanspeak/svelte-motion` and `@lucide/svelte`, with a header comment saying what it shows.
  - Page: `docs/src/routes/examples/layout-root/+page.svelte` (sets breadcrumbs and SEO context, builds an `ExampleSection[]` for `ExampleV2` from `@humanspeak/docs-kit`, loads code with `demoCodeSample` from `#lib/demo-loaders.js`). Some examples also have a `+page.ts`; copy `layout-root`'s file set exactly.
  - Index: `docs/src/lib/examplesIndex.ts:148-152`:
    ```ts
    'layout-root': {
        title: 'layoutRoot & layoutAnchor',
        description:
            'A tab underline glides one tab while the whole tab bar jumps, and a centred child stays centred while its parent resizes.'
    },
    ```
    Entries are alphabetical by key.
  - Nav: `docs/src/lib/docsNav.ts:83` lists `Layout Animations`. This plan adds a section to that page, not a new docs page, so `docsNav.ts` does not change.
  - Docs demos consume the built `dist`: after a library change, run `pnpm build` at the repo root and clear the docs Vite cache (`rm -rf docs/node_modules/.vite`) before the docs dev server or build will see it.
- **Known rendering trap**: an emoji that animates `scale` lurches sideways. Use Lucide icons or SVG in the demos, not emoji.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0; `motion-dom` is 14.14.0 |
| Build the package | `pnpm build` | exit 0 |
| Clear docs cache | `rm -rf docs/node_modules/.vite` | — |
| Docs build | `pnpm --dir docs build` | exit 0 |
| Docs types | `pnpm --dir docs check` | 0 errors |
| Docs units | `pnpm --dir docs test` | all pass |
| Docs output | `pnpm --dir docs test:geo-seo` | all pass |
| Docs e2e | `pnpm exec playwright test --config docs/playwright.config.ts` | all pass |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

The order matters: the root build first, then the docs build, then docs check and tests. Trunk is the lint and format authority.

## Scope

**In scope:**
- `docs/src/routes/docs/layout-animations/+page.svx`: one new section and two API-reference rows
- `docs/src/routes/docs/use-spring/+page.svx`: the `mass` row (one clause)
- `docs/src/lib/examples/layout-velocity/demos/InterruptedSpring.svelte` (create)
- `docs/src/lib/examples/layout-velocity/demos/AutoMass.svelte` (create)
- `docs/src/routes/examples/layout-velocity/` (create; the same file set as `docs/src/routes/examples/layout-root/`)
- `docs/src/lib/examplesIndex.ts`: one entry
- A docs e2e spec for the new example, if `docs/e2e` has one per example for comparable pages (check `ls docs/e2e`; follow what exists, do not invent a pattern)
- Any generated docs index that the docs build rewrites for a new example and that the repo commits (check `git status` after the build)

**Out of scope:**
- Any file under `src/`. If a demo does not behave as documented, that is a STOP.
- `docs/src/lib/docsNav.ts`.
- `docs/static/r/animated-tabs.json`: the docs build re-sorts it; revert it, never commit it.
- A demo of the drag-throw `layoutId` handoff: it depends on plan 004, which may not have landed. One sentence in the docs covers it, worded so it is true either way (see Step 1).
- Retuning the existing `velocity-interrupts` example.

## Git workflow

- Lane branch `lane/14140-docs`, cut from `feat/motion-14.14.0` after plan 003 is merged.
- Conventional commits, for example `docs(layout): layout velocity and mass auto` and `docs(examples): layout velocity example`.
- Do not push.

## Steps

### Step 1: The docs section

In `docs/src/routes/docs/layout-animations/+page.svx`, add `## Spring velocity` directly before `## Scrolling and layout animations` (`:125`). Content, in plain sentences:

- What it is: with a spring layout transition, an element that is interrupted mid-animation starts the next one at the speed it was already moving. Show the opt-in:
  ```svelte
  <motion.div layout transition={{ type: 'spring', visualDuration: 0.4, bounce: 0.2 }} />
  ```
- When it applies, as a short table: `type: 'spring'` with `visualDuration`/`bounce` or `stiffness`/`damping` → carries velocity; `type: 'spring'` with `duration` → starts from rest, ends on time; a tween (including the default layout transition) → starts from rest; any transition with `repeat` → starts from rest.
- Two sentences on what stays put: an edge that does not move in either layout stays still, and a child keeps its place inside an animating parent.
- One sentence on shared layout: an element with the same `layoutId` continues the motion of the one it replaces.
- `### mass: "auto"`: the opt-in snippet (`transition={{ type: 'spring', visualDuration: 0.45, bounce: 0, mass: 'auto' }}`), the rule (a 300 px square has mass 1; mass follows size between 0.25 and 2; the bounce stays the same and bigger elements settle later), and that it only has an effect in layout animations.
- A link to the new example: `[layout velocity example](/examples/layout-velocity)`.
- State the Motion version once: "Added in Motion 14.13."

In `## API reference`, add a `### Layout transition` table after `### Layout animation callbacks` with two rows: `transition.type: 'spring'` ("A spring layout transition carries the element's velocity through an interrupt.") and `transition.mass: 'auto'` ("Sets the spring's mass from the element's size. Layout animations only.").

In `docs/src/routes/docs/use-spring/+page.svx`, extend the `mass` row's description with: "`"auto"` is accepted in layout transitions only; see [Layout Animations](/docs/layout-animations#spring-velocity)." Check the anchor against how mdsvex slugs headings on this site (look at an existing in-page link in the docs) before writing it.

**Verify**: `grep -n "## Spring velocity" docs/src/routes/docs/layout-animations/+page.svx` → one line.

### Step 2: The demos

Create `docs/src/lib/examples/layout-velocity/demos/InterruptedSpring.svelte`: two rows, each a track with a `motion.div layout` puck and one shared "Toggle" button that flips both. Row one uses `{ type: 'spring', visualDuration: 0.6, bounce: 0.15 }` and is labelled "spring: keeps its speed"; row two uses `{ duration: 0.6 }` and is labelled "tween: starts from rest". The WOW behaviour to recreate: click Toggle twice quickly, and the spring puck swings round while the tween puck stops and turns. Add a short caption telling the reader to do exactly that.

Create `docs/src/lib/examples/layout-velocity/demos/AutoMass.svelte`: a small tile and a large tile, both `layout`, moved together by one button, with a switch between `mass: 1` and `mass: 'auto'`. The WOW behaviour: with `auto`, the large tile visibly lags and settles later, the small one snaps over; with `1`, they move in lockstep.

Both demos: import from `@humanspeak/svelte-motion`; a header comment saying what it shows and citing Motion 14.13; theme-aware classes copied from the `layout-root` demos; no emoji; usable at phone width.

**Verify**: `pnpm build && rm -rf docs/node_modules/.vite && pnpm --dir docs check` → 0 errors.

### Step 3: The example page and index

Create `docs/src/routes/examples/layout-velocity/` with the same files as `docs/src/routes/examples/layout-root/`, adapted: breadcrumb title "Layout velocity", SEO title "Layout velocity & mass auto | Svelte Motion", a description of one sentence, `ogSlug: 'examples-layout-velocity'`, and two `ExampleSection`s (FIG-001 the interrupted spring, FIG-002 auto mass), each with its demo, its code via `demoCodeSample`, and a two-sentence explanation.

Add to `docs/src/lib/examplesIndex.ts`, in alphabetical position (after `'layout-scroll'`):
```ts
'layout-velocity': {
    title: 'Layout velocity',
    description:
        'A spring layout animation keeps its speed when interrupted, and mass: "auto" makes bigger elements move heavier.'
},
```

If `docs/e2e` has a per-example spec pattern, add the matching spec for `/examples/layout-velocity` (the page renders, both demos are present, the Toggle button moves the puck).

**Verify**: `pnpm --dir docs build` → exit 0, and the build output lists `/examples/layout-velocity`.

### Step 4: Check the demos behave as documented

Start the docs dev server on its own port (not 4198) and open `/examples/layout-velocity` in a browser, or drive it with a throwaway Playwright script:
- In the first demo, click Toggle, then again about 200 ms later, and sample both pucks' left edges per frame. The spring puck must travel on past its position at the second click (more than 5 px); the tween puck must not (less than 2 px, or up to one frame's travel if plan 005 has not landed: note which).
- In the second demo with `auto`, the large tile's layout animation must finish at least 200 ms after the small one's.

**Verify**: your report gives the measured numbers. If the spring puck does not carry on, the built package lacks plan 003: STOP.

Stop the dev server when done.

### Step 5: Gate

Run, in order: `pnpm build`, `pnpm --dir docs build`, `pnpm --dir docs check`, `pnpm --dir docs test`, `pnpm --dir docs test:geo-seo`, `pnpm exec playwright test --config docs/playwright.config.ts`, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: all exit 0. Revert `docs/static/r/animated-tabs.json` if the build changed it. `git status` shows only in-scope files.

## Test plan

- No red-first test: this plan has no library runtime surface (docs and demos only). The behaviour it documents is pinned by plan 003's e2e tests.
- Step 4 measures the demos against the documented behaviour.
- Docs gates: `docs check`, `docs test`, `docs test:geo-seo` and the docs Playwright projects.

## Done criteria

- [ ] `grep -n "## Spring velocity" docs/src/routes/docs/layout-animations/+page.svx` → one line
- [ ] `ls docs/src/lib/examples/layout-velocity/demos` → `AutoMass.svelte InterruptedSpring.svelte`
- [ ] `grep -n "'layout-velocity'" docs/src/lib/examplesIndex.ts` → one line
- [ ] `pnpm --dir docs build`, `check`, `test`, `test:geo-seo` and the docs Playwright run → all pass
- [ ] `grep -rn "\$lib" docs/src/lib/examples/layout-velocity docs/src/routes/examples/layout-velocity` → no output
- [ ] `git status` shows only in-scope files, and `docs/static/r/animated-tabs.json` is unchanged

## STOP conditions

- `node_modules/motion-dom` is not 14.14.0, or the built package does not carry velocity through an interrupt (Step 4).
- The file set of `docs/src/routes/examples/layout-root/` differs from what "Current state" describes in a way that changes how a new example is registered.
- The docs build rewrites a committed generated file other than `animated-tabs.json` in a way you cannot explain.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- The sentence about a `layoutId` element continuing the motion of the one it replaces is true for an interrupted shared animation after plan 003, and for a dragged card after plan 004. If plan 004 is rejected, re-read that sentence.
- If plan 005 is rejected or blocked, the docs' "starts from rest" for tweens is still right in what the user sees (no jump), though a tween travels on for up to one frame.
- Sign-off: the maintainer drives `/docs/layout-animations` and `/examples/layout-velocity` against an upstream twin built from `dev/react/src/tests/layout-velocity-interrupt.tsx` and `layout-velocity-auto-mass.tsx` at v14.14.0, with the same buttons.
- Reviewer: check the demos use no emoji, import only the built package, and that the table of which transitions carry velocity matches `create-projection-node.ts:2045` and `:2094`.
