# Plan 010: `motion.*` always has every feature, `m.*` defers to LazyMotion, strict mode works, and Reorder ships from an `m` entry (#2232, #2094)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself (lanes
> never edit it).
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4220**. Prefix every Playwright command with `PW_PORT=4220`.
> Port 4198 belongs to the maintainer; never use or kill it. Never set `PW_REUSE_SERVER`.
>
> **Requires plan 001**: confirm `grep -n '"motion-dom": "14.7.1"' package.json` prints a line. If not, STOP.
>
> **Drift check (run first)**: `git diff --stat f8ac71aa..HEAD -- src/lib/m.ts src/lib/reorder.ts src/lib/components/LazyMotion.svelte src/lib/components/lazyMotion.context.ts src/lib/components/Reorder src/lib/html/_MotionContainer.svelte src/routes/tests/lazy-motion e2e/lazy-motion tests/consumer-vite6 docs/src/routes/docs/lazy-motion docs/src/routes/docs/reorder docs/src/lib/examples/lazy-motion docs/src/routes/examples/lazy-motion`
> Expected: only plan 001's changes and, in `_MotionContainer.svelte`, edits by other plans of this batch outside
> the regions listed in "Scope". If the regions you edit (see Scope) differ from the excerpts below, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED. `motion.*` inside `<LazyMotion>` gains features it was denied before (a documented behaviour
  change), `<LazyMotion strict>` starts throwing for `motion.*` in development, and `m.*` becomes a set of wrapper
  components instead of an alias of `motion`.
- **Depends on**: 001 (both edit `package.json` — 001 the pins, this plan the `exports` map — and this plan's e2e
  baseline is the 14.7.1 suite 001 triages)
- **Wave**: 2
- **Category**: direction (upstream parity)
- **Planned at**: commit `f8ac71aa` (`main` after the 14.6.0 release, v2.5.0, Motion 14.6.0), 2026-10-27

## Why this matters

Upstream Motion has two component kinds. `motion.*` preloads every feature and ignores `LazyMotion`; `m.*` gets
its features only from `LazyMotion`. `<LazyMotion strict>` makes rendering a `motion.*` inside it an error in
development, because it defeats the point of `LazyMotion`. In 14.7.0 Motion added a `Reorder` built from `m`
(`framer-motion/m`, `motion/react-m`) so Reorder can defer its features too (#2232), and made the main `Reorder`'s
strict-mode message a single, actionable warning (#2094).

In svelte-motion today `m` is the same component object as `motion`, so both read `LazyMotion`'s bundle (a
`motion.div` inside `<LazyMotion features={domMin}>` silently loses hover, tap, drag and layout), `strict` is
accepted but never read, and there is no `m` flavour of `Reorder`. This plan adopts upstream's behaviour.

It does **not** make `LazyMotion` save bytes. svelte-motion's features are boolean flags over code that is always
bundled (see "Bundle size" below). Getting real savings is a separate, larger refactor; this plan ends with a
measurement and a report instead.

## Current state

### svelte-motion

- `src/lib/m.ts:11-13` — `m` is `motion` re-keyed:
  ```ts
  export const m: MotionComponents = Object.fromEntries(
      Object.entries(html).map(([key, component]) => [key.toLowerCase(), component])
  ) as MotionComponents
  ```
  `src/lib/motion.ts:5-7` builds `motion` the same way. `src/lib/index.ts:17-19` exports `m`, `motion`, `Reorder`.
- Every element wrapper is a generated file (`scripts/generate-html.ts`, `scripts/_template.template`) like
  `src/lib/html/Div.svelte`:
  ```svelte
      let { children, ref = $bindable(), ...rest }: HTMLElementProps = $props()
  ...
  <MotionContainer bind:ref tag="div" {motionValueChild} {...rest}>
  ```
  so any extra prop given to `Div` reaches `MotionContainer` through `rest`.
- `src/lib/html/_MotionContainer.svelte` — the shared implementation (3312 lines). Regions this plan touches:
  - imports, lines 7-9: `getMotionConfig`, `getLazyMotionContext`, `import { domMax } from '$lib/features/domMax'`.
  - `type Props` (lines 150-155) and the `$props()` destructure (lines 159-222; starts
    `children, motionValueChild, tag = 'div', key: keyProp, …`, ends `ref = $bindable(), ...rest`).
  - features resolution, lines 246-250:
    ```ts
        const lazyMotion = getLazyMotionContext()
        const activeFeatures = $derived(lazyMotion?.getFeatures() ?? domMax)
        const hasGestureFeatures = $derived(!!activeFeatures.gestures)
        const hasDragFeatures = $derived(!!activeFeatures.drag)
        const hasLayoutFeatures = $derived(!!activeFeatures.layout)
    ```
    The three `has*` flags gate the pan props (about lines 583-594), the drag props (about lines 595-613) and
    later effects (lines ~1434, 1445, 1588, 2083, 2335, 2386, 2479, 2798, 2828). Those consumers do not change.
  - Plans 004, 006 and 007 of this batch also edit this file, in other regions. Touch nothing else.
- `src/lib/components/LazyMotion.svelte` — `features` (bundle or async loader) and `strict` (lines 15-24); publishes
  `getFeatures`, `getIsLoaded`, `strict` (lines 31-37). While an async loader is pending it serves `domMin`
  (lines 26-29, 50-51). `strict` is never read anywhere.
- `src/lib/components/lazyMotion.context.ts:7-14` — `LazyMotionContext { getFeatures, getIsLoaded, strict }`.
- `src/lib/features/{domMin,domAnimation,domMax}.ts` — plain objects of booleans (`{ animations: true }`,
  `+ gestures`, `+ drag + layout`).
- `src/lib/reorder.ts:22-28` — `export const Reorder = { Group, Item } as const`, the only Reorder entry.
- `src/lib/components/Reorder/Group.svelte` renders `<MotionContainer bind:ref tag={as} {...rest} … data-reorder-axis={axis}>`
  (lines 236-247) and calls `setReorderContext<V>({ … })` at line 101. `src/lib/components/Reorder/Item.svelte`
  reads `const context = getReorderContext<V>()` (line 44) and renders `<MotionContainer bind:ref tag={as}
  drag={itemDrag} tabindex={0} {...rest} … {layout} …>` (lines 176-193). `ReorderContextProps<V>` is in
  `src/lib/components/Reorder/context.ts:40-…`.
- `package.json` `exports` (lines 69-101): `.`, `./vite`, `./three`, `./vgpu`, `./html/*.svelte` (+ four renamed
  html files). No `./m`. Entries with Svelte components use the `svelte` condition (`".": { "types": "./dist/index.d.ts", "svelte": "./dist/index.js" }`).
- `src/lib/vite.ts` (`svelteMotionOptimize`) rewrites only `motion.TAG` (regexes at lines 197-217) to direct
  `html/Tag.svelte` imports; `m.TAG` is left alone. Direct html imports and `MotionDiv`-style named exports are
  therefore `motion`-kind, which is correct.
- Dev-only warnings use `import { DEV } from 'esm-env'` (`src/lib/utils/arc.ts:32`, one-time `console.warn`).
  `motion-utils` is not a direct dependency; do not import it.
- The e2e server is a **production** build (`playwright.config.ts:25`), so `DEV` is false there: dev-only
  warnings and throws are only observable in unit tests (vitest runs with `DEV` true — `src/lib/utils/arc.spec.ts:35`
  spies on `console.warn` and sees the warning).
- Existing coverage: `src/lib/components/LazyMotion.spec.ts` (probe `__tests__/LazyMotionProbe.svelte`, all `m.*`),
  `lazyMotion.context.spec.ts`, `src/lib/features/index.spec.ts`, `e2e/lazy-motion/basic.spec.ts` (3 tests over
  `src/routes/tests/lazy-motion/{basic,feature-bundles,async}`, all `m.*`), the Reorder unit specs
  (`src/lib/components/Reorder/*.spec.ts`, pointer helpers in `reorder.component.spec.ts:1-80`), `e2e/reorder/*`
  (12 specs), and `tests/consumer-vite6` (`verify.mjs`, `verify-tree-shaking.mjs`, `verify-types.mjs` with
  fixture `src/reorder-types.ts`).
- **Correction to the survey**: `src/routes/tests/lazy-motion/feature-bundles/+page.svelte:27` ("Hover/tap works
  for domAnimation and domMax. Drag is only enabled for domMax.") stays TRUE under upstream semantics, because that
  page renders `m.div`, and `m` keeps deferring to `LazyMotion`. What changes is `motion.*` inside `LazyMotion`,
  which no page or doc demonstrates yet; Step 1 adds it. `docs/src/routes/docs/lazy-motion/+page.svx` says
  `LazyMotion` "mirrors Framer Motion's bundle split while keeping the default `motion` export unchanged", which
  the current code does not do (motion IS gated); after this plan it is true.

### Upstream (verified at `~/Github/motion`, `git show v14.7.1:<path>`)

- `packages/framer-motion/src/render/components/motion/create.ts` — `motion` components call
  `createMotionComponent(Component, options, featureBundle, createDomVisualElement)`, `featureBundle` being
  animations + gestures + drag + layout (`motion/feature-bundle.ts`). `render/components/m/create.ts` calls
  `createMotionComponent(Component, options)` with neither, so `m` gets its renderer and features only from
  `LazyMotion` (`motion/utils/use-visual-element.ts:41-62`: `createVisualElement || lazyContext.renderer`).
- `packages/framer-motion/src/motion/index.tsx:215-246`:
  ```tsx
  function useStrictMode(configAndProps: MotionProps, preloadedFeatures?: FeaturePackages) {
      const isStrict = useContext(LazyContext).strict
      if (process.env.NODE_ENV !== "production" && preloadedFeatures && isStrict) {
          const strictMessage =
              "You have rendered a `motion` component within a `LazyMotion` component. This will break tree shaking. Import and render a `m` component instead"
          /** `ignoreStrict` is set by the main `Reorder`, which renders `motion` on every render of every item,
           *  so warn once and point to the `Reorder` that renders `m`. */
          configAndProps.ignoreStrict
              ? warnOnce(false, strictMessage + '. For Reorder, import it from "motion/react-m"', "lazy-strict-mode")
              : invariant(false, strictMessage, "lazy-strict-mode")
      }
  }
  ```
  It runs only on the client (`index.tsx:136-137`, inside `if (!isStatic && typeof window !== "undefined")`).
  `invariant` throws `new Error(formatErrorMessage(message, code))`; `warnOnce` warns once per message; both append
  `. For more information and steps for solving, visit https://motion.dev/troubleshooting/lazy-strict-mode`
  (`motion-utils/src/{errors,warn-once,format-error-message}.ts`).
- `ignoreStrict` is passed by the main Reorder's elements: `components/Reorder/Group.tsx:311`, `Item.tsx:179`.
- #2232 (`512cf889c`, tests `87b65d30b`): `Reorder/Group.tsx` exports `createReorderGroup(proxy)`; the group puts
  `proxy` in `ReorderContext` and `Item.tsx` renders `context!.proxy[as]` ("Render the group's kind of component,
  `motion` or `m`"). `Reorder/namespace.ts` = `createReorderGroup(motion)` + `ReorderItem`;
  `Reorder/m-namespace.ts` = `createReorderGroup(m)` + the same `ReorderItem`; `src/m.ts` adds
  `export * as Reorder from "./components/Reorder/m-namespace"`.
- #2094 (`b86ec58f8`): the warn-once path above, and its tests.
- Tests to port: `tests/react/reorder-lazy-motion.spec.ts` + `dev/react/src/tests/reorder-lazy-motion.tsx`,
  `tests/react/issue-2094.spec.ts` + `dev/react/src/tests/issue-2094.tsx`, and
  `packages/framer-motion/src/components/Reorder/__tests__/{lazy-motion,strict-warning,server.ssr}.test.tsx`.
  `__tests__/tree-shaking.test.ts` asserts the `m` Reorder bundle has none of the domMax canaries — that cannot hold
  here (see "Bundle size"); it is not ported.

### Upstream behaviours adopted by plan 011, not here

- An `m.*` outside any `LazyMotion` is inert upstream (no renderer, no VisualElement, no animations). Here it keeps
  today's full feature set (`domMax`).
- While an async `LazyMotion` loader is pending, upstream `m.*` is inert; here it keeps today's `domMin`.

Both need a "no features" render mode in `_MotionContainer.svelte`. Plan
`011-m-without-lazy-motion-features.md` (same lane, runs right after this one) adds it. Do not implement either
here; where this plan's docs and JSDoc mention them, they point at the state after plan 011 (see Step 6).

### Bundle size (why this plan does not shrink bundles)

`_MotionContainer.svelte` statically imports the 1486-line projection adapter
(`$lib/utils/motionDomProjection`, line 89) and `$lib/utils/visualElementCore` (line 98), and
`visualElementCore.ts` statically imports `VisualElementDragControls` and `PanSession` (lines 24-45) and registers
every feature, drag and pan included, in `registerMotionFeatures()` (lines 605-640). Swapping the `domMax` import
for something dynamic saves nothing: `domMax` is a three-key object. Real savings mean moving the drag, pan and
layout implementations behind the bundle objects (`domAnimation` / `domMax` would import and register them, and
`_MotionContainer` would get the projection adapter from the active bundle), an XL refactor of the three files
other plans are editing. Out of scope; Step 6 measures and reports.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| E2E | `PW_PORT=4220 pnpm exec playwright test <paths>` | all pass |
| Build | `pnpm build` | exit 0 |
| Package + publint | `pnpm package` | exit 0, publint reports no errors |
| Vite 6 consumer | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | exit 0 (needs `pnpm build` first) |
| Docs | `pnpm --dir docs build`, `pnpm --dir docs check` | exit 0 / 0 errors (docs consume the built `dist`; run `pnpm build` first; restore `docs/static/r/animated-tabs.json` if rewritten) |

## Scope

**In scope**:

- `src/lib/utils/motionKind.ts` (create) and `src/lib/utils/motionKind.spec.ts` (create)
- `src/lib/m.ts` (becomes the `./m` entry: `m` + `Reorder`)
- `src/lib/reorder.ts`
- `src/lib/components/Reorder/Group.svelte` (the `setReorderContext` call at line 101, the props destructure, and
  the `<MotionContainer>` at lines 236-247), `Item.svelte` (the `<MotionContainer>` at lines 176-193),
  `context.ts` (one `kind` field), `types.ts` (one `@internal` `__motionKind?: MotionKind` on `ReorderGroupProps`)
- `src/lib/html/_MotionContainer.svelte` — **only** lines 7-9 (imports), the `Props` type (150-155), the
  destructure (add two entries next to `motionValueChild`, ~line 161), and lines 246-250 plus the strict check
  inserted directly after them
- `src/lib/components/LazyMotion.svelte` and `lazyMotion.context.ts` (JSDoc for `strict` only)
- `src/lib/components/LazyMotion.spec.ts`, `src/lib/components/__tests__/LazyMotionKindProbe.svelte` (create),
  `src/lib/components/Reorder/lazyMotion.component.spec.ts` (create), `src/lib/components/Reorder/__tests__/LazyReorderHarness.svelte` (create)
- `src/routes/tests/lazy-motion/feature-bundles/+page.svelte`, `src/routes/tests/lazy-motion/reorder-m/+page.svelte` (create),
  `src/routes/tests/lazy-motion/reorder-strict/+page.svelte` (create)
- `e2e/lazy-motion/basic.spec.ts`, `e2e/lazy-motion/reorder-lazy-motion.spec.ts` (create), `e2e/lazy-motion/reorder-strict.spec.ts` (create)
- `src/routes/+page.svelte` (two links in the LazyMotion list, lines ~44-70)
- `package.json` — the `exports` map only
- `tests/consumer-vite6/verify.mjs`, `verify-tree-shaking.mjs`, `verify-types.mjs`, and (create)
  `src/reorder-m-types.ts`, `src/ReorderSsr.svelte`, `src/ReorderMSsr.svelte`, `src/KindSsr.svelte`,
  `src/render-reorder-ssr.js`, `src/render-reorder-m-ssr.js`, `src/render-kind-ssr.js`
- `docs/src/routes/docs/lazy-motion/+page.svx`, `docs/src/routes/docs/reorder/+page.svx`,
  `docs/src/lib/examples/lazy-motion/demos/LazyReorder.svelte` (create), `docs/src/routes/examples/lazy-motion/+page.svelte`
- `.changeset/lazy-motion-m-split.md` (create)

**Out of scope**: the two behaviours plan 011 adopts, the bundle-size refactor above; `src/lib/vite.ts`;
`scripts/generate-html.ts` and the 180 generated `src/lib/html/*.svelte` files (the kind is injected, not
generated); every other region of `_MotionContainer.svelte`; `"version"` in `package.json`.

## Git workflow

- Lane branch `lane/1471-lazy` in `../svelte-motion-1471-lazy`, created by the dispatcher from
  `feat/motion-14.7.1` after plan 001 is merged.
- Conventional commits per step, e.g. `test(lazy-motion): motion ignores LazyMotion, strict throws, Reorder from m`,
  `feat(lazy-motion): split motion and m like Motion (#2232, #2094)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR. No PR labels.

## Steps

### Step 1: Red tests

1. `src/lib/components/__tests__/LazyMotionKindProbe.svelte`: props `features`, `strict = false`, `include`
   (`'motion' | 'm' | 'both'`, default `'both'`). Inside `<LazyMotion {features} {strict}>` render, per `include`,
   `<motion.div data-testid="motion-tap" whileTap={{ scale: 0.9 }}>` and `<m.div data-testid="m-tap" whileTap={{ scale: 0.9 }}>`.
2. In `src/lib/components/LazyMotion.spec.ts` add (same mocks/timers as the file's existing cases):
   - `motion components keep every feature inside LazyMotion` — `features: domMin`: `motion-tap` has
     `tabindex="0"` (red: no tabindex); `m-tap` has no `tabindex` (guard).
   - `throws when a motion component renders inside LazyMotion strict` — `features: domMax, strict: true,
     include: 'motion'`: `render(...)` throws an error whose message contains
     "You have rendered a `motion` component within a `LazyMotion` component" and ends with
     "https://motion.dev/troubleshooting/lazy-strict-mode" (red: no throw).
   - `m components render inside LazyMotion strict without warnings` — `include: 'm'`, strict, spy on
     `console.warn`: no throw, no warn (guard).
3. `src/lib/components/Reorder/__tests__/LazyReorderHarness.svelte`: props `features`, `strict`, `entry: 'main' | 'm'`,
   `onReorder`; renders `<LazyMotion {features} {strict}>` around `<Reorder.Group axis="y" values={items} onReorder=…>`
   with three `<Reorder.Item value={item} data-testid={item}>`, choosing `Reorder` from `$lib/reorder` or `$lib/m` by
   `entry`. `src/lib/components/Reorder/lazyMotion.component.spec.ts` — model the drag on
   `reorder.component.spec.ts` (its `FakeResizeObserver`, pointer dispatch helpers, frame flushing and the way it
   gives items a layout). Ports of upstream `lazy-motion.test.tsx`, `strict-warning.test.tsx`, `server.ssr.test.tsx`:
   - `Reorder from the m entry is inert until LazyMotion loads its features` — async loader resolving `domMax` on
     demand: a drag past the next item does not call `onReorder`; after resolving, the same drag calls it with
     `['b', 'a', 'c']`.
   - `Reorder from the m entry renders within LazyMotion strict without a strict-mode warning` — `domMax`, strict:
     drag reorders; `console.warn` not called with anything containing "LazyMotion".
   - `the main Reorder within LazyMotion strict warns once, with a fix` — `entry: 'main'`, `domMax`, strict,
     re-render a few times and drag once: exactly one `console.warn` containing
     "within a `LazyMotion` component", and it contains `For Reorder, import it from "@humanspeak/svelte-motion/m"`.
     No throw.
   - The upstream `server.ssr.test.tsx` port (the `m` Reorder renders the same server markup as the main one) does
     NOT go in this file: see the next paragraph and Step 5.3.

   **Do not server-render under vitest in this plan.** No spec in `src` uses `svelte/server`;
   `src/lib/html/_MotionContainer.ssr.spec.ts` is a jsdom client render despite its name. `vitest.config.ts` runs
   every spec in jsdom (`test.environment: 'jsdom'`), sets `resolve.conditions: ['browser']` whenever `VITEST` is
   set, and adds `svelteTesting()`, which also inserts `browser` before `node` in `resolve.conditions`
   (`node_modules/@testing-library/svelte/src/vite.js` `addBrowserCondition`). Under the `browser` condition,
   `svelte` resolves to `src/index-client.js` (svelte's `exports["."]`: `"browser": "./src/index-client.js"`,
   `"default": "./src/index-server.js"`). Whether a `// @vitest-environment node` file escapes that depends on how
   Vitest 4's `ssr` Vite environment applies the top-level `resolve.conditions` and whether `svelte` is externalized
   there; that was NOT verified while planning (no tests were run), so this plan does not rely on it and adds no
   vitest project. The repo already has a proven server-render harness: `tests/consumer-vite6/verify.mjs`
   `renderWithVite('/src/render-root.js', …)` (`render-root.js` = `render(Component).body` from `svelte/server`,
   run through Vite 6 `ssrLoadModule`). All SSR checks go there (Step 5.3). If, while doing Step 5.3, you find the
   consumer harness can't render the `./m` entry, STOP rather than adding a vitest SSR project.

   Isolation: `warnOnce` (Step 2) keeps a module-level `Set`, so add `beforeEach(() => resetWarnOnceForTests())`
   at the top of this file (and in `LazyMotion.spec.ts`), otherwise "warns exactly once" fails when an earlier case
   already warned.
   If simulating the drag in jsdom fails for reasons unrelated to this plan, keep the drag assertions in e2e only
   (Steps 1.5-1.6), keep the warning / inert-before-load assertions here (for "inert", assert
   `elementDragControls.get(visualElementStore.get(item))` is undefined before load and defined after), and say so
   in the commit.
4. `src/routes/tests/lazy-motion/feature-bundles/+page.svelte`: add a fourth card "motion.div in domMin" — a
   `motion.div` (not `m`) `data-testid="lazy-motion-motion-in-domMin"` inside `<LazyMotion features={domMin}>`, same
   `whileHover` / `whileTap` / `drag` props. Update the intro text: "`m` components get the bundle's features:
   hover/tap for domAnimation and domMax, drag only for domMax. A `motion` component ignores LazyMotion and always
   has every feature." In `e2e/lazy-motion/basic.spec.ts` `gates gesture affordances by feature bundle`, add
   `await expect(page.getByTestId('lazy-motion-motion-in-domMin')).toHaveAttribute('tabindex', '0')`.
5. `src/routes/tests/lazy-motion/reorder-m/+page.svelte` — port of `dev/react/src/tests/reorder-lazy-motion.tsx`:
   `Reorder` from `$lib/m` in `<LazyMotion strict features={…}>`; `?features=async` uses a loader that resolves
   `domMax` when `window.loadFeatures()` is called. Items `a`,`b`,`c` as `li` with `data-testid` = value, 50 px
   high, 200 px wide, margin-bottom 10. `e2e/lazy-motion/reorder-lazy-motion.spec.ts` — port of
   `tests/react/reorder-lazy-motion.spec.ts` (both `sync` and `async`; drop the `process` init script; read order
   via `li` `data-testid`s; keep `dragFirstDown`; also assert no `pageerror`).
6. `src/routes/tests/lazy-motion/reorder-strict/+page.svelte` — port of `dev/react/src/tests/issue-2094.tsx`: an
   `m.div data-testid="m-sibling"` and the MAIN `Reorder` inside `<LazyMotion strict>` (`?features=async` loads
   `domMax` with a dynamic import of `$lib`). `e2e/lazy-motion/reorder-strict.spec.ts` — port of
   `tests/react/issue-2094.spec.ts`: drag item 0 past item 1 → order `item-1, item-0, item-2`, and no `pageerror`
   (the main Reorder must not throw). The warn-once assertion is NOT made here: the e2e server is a production build
   and the warning is development-only; the unit test in 1.3 covers it. Put that sentence in the spec's header
   comment.
7. Link both new pages from the LazyMotion list in `src/routes/+page.svelte`.

**Verify**:
- `pnpm exec vitest run src/lib/components/LazyMotion.spec.ts` → "keep every feature" and "throws … strict" FAIL;
  the `m` strict case passes.
- `pnpm exec vitest run src/lib/components/Reorder/lazyMotion.component.spec.ts` → FAILS at import (no `Reorder`
  export in `$lib/m`). That import error is the whole red for this file: none of its behavioural cases runs yet.
  They first run after Step 4, and must all pass then; if one fails there, treat it as a real failure (not as
  "expected red").
- `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion` → `gates gesture affordances` FAILS on the new
  assertion; the two Reorder specs fail (page import error) — expected red.
- If "keep every feature" passes before Step 3, STOP.

Commit (`test(lazy-motion): motion ignores LazyMotion, strict throws, Reorder from m (#2232, #2094)`).

### Step 2: The kind wrapper (spike first)

Create `src/lib/utils/motionKind.ts` (Google-style JSDoc on every export):

- `export type MotionKind = 'motion' | 'm'`
- `export const MOTION_KIND_PROP = '__motionKind'` (internal prop name; `MotionContainer` destructures it, so it
  never reaches the DOM)
- `export function withMotionKind<C>(component: C, props: Record<string, unknown>): C` — returns a function
  `(anchor, componentProps) => component(anchor, injected)` where `injected` is a `Proxy` over `componentProps`
  that adds the given keys: forward `get`, `has`, `set`, `ownKeys`, `getOwnPropertyDescriptor` (report injected
  keys as `{ value, enumerable: true, configurable: true }`), and `deleteProperty`; everything not injected must
  hit the original object so Svelte's reactive getters, spread props and `bind:` setters keep working on client and
  server. Mark calls `/* @__PURE__ */` at use sites.
- `export const LAZY_STRICT_MESSAGE` = upstream's `strictMessage` verbatim, `export const REORDER_STRICT_HINT =
  '. For Reorder, import it from "@humanspeak/svelte-motion/m"'`, and `formatLazyStrictMessage(message)` that
  appends `. For more information and steps for solving, visit https://motion.dev/troubleshooting/lazy-strict-mode`.
- `export function warnOnce(message: string): void` — a module-level `Set`, like upstream `warn-once.ts`; plus
  `/** @internal Test-only: forget which messages were warned. */ export function resetWarnOnceForTests(): void`
  that clears the Set. Not re-exported from any public entry.

Spike tests in `src/lib/utils/motionKind.spec.ts` (render a tiny harness or `html/Div.svelte` wrapped with
`withMotionKind(Div, { [MOTION_KIND_PROP]: 'm' })`):
- a prop change through `rerender` reaches the element (e.g. `class`), `bind:ref` still binds, spread props with
  keys added later still arrive;
- `warnOnce` warns once per message, and again after `resetWarnOnceForTests()`.
(SSR through the wrapper is checked in Step 5.3, not here; see Step 1.3 for why vitest can't do it.)

**Verify**: `pnpm exec vitest run src/lib/utils/motionKind.spec.ts` → all pass. If reactivity or `bind:ref`
cannot be made to work through the wrapper, STOP and report (the fallback — emitting a second set of generated
`m` wrappers from `scripts/generate-html.ts` — doubles the generated files and needs the maintainer's call).

Commit (`feat(lazy-motion): add the motion/m kind wrapper`).

### Step 3: `motion` vs `m` and strict mode in `_MotionContainer`

1. `src/lib/m.ts`: build `m` as
   `Object.fromEntries(Object.entries(html).map(([key, c]) => [key.toLowerCase(), withMotionKind(c, { [MOTION_KIND_PROP]: 'm' })]))`.
   Update its JSDoc: `m` components get their features only from the nearest `<LazyMotion>`. (Plan 011 makes an
   `m` outside LazyMotion featureless and finishes this JSDoc; until then it keeps every feature.)
2. `_MotionContainer.svelte`, allowed regions only:
   - Props type: add `[MOTION_KIND_PROP]?: MotionKind` (write it as `__motionKind?: MotionKind`, `@internal`) and
     `ignoreStrict?: boolean` (`@internal`, upstream's name: "set by the main `Reorder`, so strict mode warns once
     instead of throwing").
   - Destructure next to `motionValueChild`: `__motionKind: motionKindProp = 'motion'`,
     `ignoreStrict: ignoreStrictProp = false`.
   - Replace line 247 with
     `const activeFeatures = $derived(motionKindProp === 'm' ? (lazyMotion?.getFeatures() ?? domMax) : domMax)`
     and add the upstream comment ("`motion` preloads every feature and ignores LazyMotion; `m` defers to it").
   - Directly after line 250, the strict check, client-only and dev-only (`import { BROWSER, DEV } from 'esm-env'`):
     ```ts
         if (DEV && BROWSER && motionKindProp === 'motion' && lazyMotion?.strict) {
             if (ignoreStrictProp) warnOnce(formatLazyStrictMessage(LAZY_STRICT_MESSAGE + REORDER_STRICT_HINT))
             else throw new Error(formatLazyStrictMessage(LAZY_STRICT_MESSAGE))
         }
     ```
     (Component init runs once; upstream re-checks every render. Note that in a comment; a `strict` flip after mount
     is not re-checked.)
3. `LazyMotion.svelte` / `lazyMotion.context.ts`: JSDoc for `strict` — "In development, rendering a `motion`
   component inside throws; render `m` components instead (Reorder: import it from `@humanspeak/svelte-motion/m`)."

**Verify**: `pnpm exec vitest run src/lib/components/LazyMotion.spec.ts src/lib/components/lazyMotion.context.spec.ts` → all pass.
`pnpm check` → 0 errors (Reorder test files may still fail to import — fine until Step 4).

Commit (`feat(lazy-motion): motion components ignore LazyMotion; strict mode (#2094)`).

### Step 4: Reorder kinds and the `./m` entry

1. `context.ts`: add `readonly kind: MotionKind` to `ReorderContextProps` (JSDoc: "The group's component kind,
   `motion` or `m`, for its items to render — upstream `ReorderContextProps.proxy`").
2. `types.ts`: add `/** @internal Set by the `m` entry's `Reorder.Group`. */ __motionKind?: MotionKind` to
   `ReorderGroupProps`. `Group.svelte`: destructure `__motionKind: kind = 'motion'` from props; pass `kind` in `setReorderContext`; on its
   `<MotionContainer>` pass `__motionKind={kind}` and `ignoreStrict={kind === 'motion'}`.
3. `Item.svelte`: on its `<MotionContainer>` pass `__motionKind={context.kind}` and
   `ignoreStrict={context.kind === 'motion'}` (it already errors without a group context; keep that).
4. `src/lib/reorder.ts`: unchanged `Reorder` (motion kind). `src/lib/m.ts`: also
   `export const Reorder = { Group: /* @__PURE__ */ withMotionKind(Group, { [MOTION_KIND_PROP]: 'm' }), Item } as const`,
   typed exactly like `src/lib/reorder.ts`'s `Reorder` (`readonly Group: typeof Group; readonly Item: typeof Item`),
   JSDoc mirroring upstream `m-namespace.ts` ("renders `m` components, so it gets its features from LazyMotion;
   reordering needs `domMax`"). `src/lib/index.ts` keeps `export { m } from '$lib/m'` (named, so the `m`
   Reorder is not re-exported from the main entry). Do not edit `index.ts`.
5. `package.json` `exports`: add `"./m": { "types": "./dist/m.d.ts", "svelte": "./dist/m.js" }` after `"."`.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder` → all pass (new and existing).
`pnpm check` → 0 errors. `pnpm build` → exit 0, and `ls dist/m.js dist/m.d.ts` lists both. `pnpm package` → publint
clean.

Commit (`feat(reorder): a Reorder that defers to LazyMotion, from @humanspeak/svelte-motion/m (#2232)`).

### Step 5: e2e green, consumer test

1. `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion e2e/reorder` → all pass (re-run a failing spec alone once
   and say so).
2. `tests/consumer-vite6`: create `src/reorder-m-types.ts`, a copy of `src/reorder-types.ts` importing
   `{ Reorder } from '@humanspeak/svelte-motion/m'`; extend `verify-types.mjs` to type-check it too (same
   options, assert 0 diagnostics) and assert `dist/m.d.ts` exists. In `verify-tree-shaking.mjs` add a check: bundling
   `export { m, Reorder } from '@humanspeak/svelte-motion/m'` succeeds and the entry's exports are exactly
   `['Reorder', 'm']` (sorted). Do not port upstream's "no domMax canaries" assertion; add a comment explaining why
   (features are bundled regardless; see this plan's "Bundle size").

3. SSR checks in the consumer (ports `server.ssr.test.tsx`, and the wrapper's SSR spike). Create
   `tests/consumer-vite6/src/ReorderSsr.svelte` (main `Reorder` with `as="article"` / `as="main"`, `values={[]}`,
   one item `value={0}`), `src/ReorderMSsr.svelte` (the same with `Reorder` from `@humanspeak/svelte-motion/m`,
   inside `<LazyMotion features={domMax} strict>`), `src/KindSsr.svelte` (a `motion.div` and an `m.div` with the same
   `class`, `style`, `initial`, `whileTap` and `drag="x"` props, each in its own wrapper `div` with a
   `data-kind` attribute), and one `src/render-<name>.js` per component in the `render-root.js` pattern. In
   `verify.mjs`, render each with `renderWithVite(..., { configFile: false, plugins: [svelte()], resolve: { dedupe: ['svelte'] } })`
   and assert: the two Reorder bodies are equal after stripping `<!--…-->` comments and both contain
   `overflow-anchor: none`; in `KindSsr`, the inner HTML of the two `data-kind` wrappers is equal after stripping
   comments, and neither contains `__motionKind` or `ignoreStrict`. If the wrapper changes SSR output, STOP (the
   Step 2 STOP applies).

**Verify**: `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → exit 0.

Commit (`test(consumer): type-check and bundle the ./m entry`).

### Step 6: Docs, changeset, bundle measurement, gate

1. `docs/src/routes/docs/lazy-motion/+page.svx`: replace the "keeping the default `motion` export unchanged"
   sentence with the upstream model: `motion` always has every feature and ignores LazyMotion; `m` gets the bundle's
   features; add `## Strict mode` (dev-only error for `motion` inside `<LazyMotion strict>`, the Reorder warning and
   fix) and `## Reorder with LazyMotion` (import `Reorder` from `@humanspeak/svelte-motion/m`, needs `domMax`).
   Do not describe `m` outside LazyMotion or the async-pending state; plan 011 writes those paragraphs. Do state
   that, in svelte-motion, LazyMotion selects behaviour but does not yet reduce bundle size. Leave the existing
   "## Async loading" sentence ("renders with `domMin` first") untouched; plan 011 rewrites it.
2. `docs/src/routes/docs/reorder/+page.svx`: a short "With LazyMotion" section pointing at the `/m` entry.
3. `docs/src/lib/examples/lazy-motion/demos/LazyReorder.svelte`: a small list using `Reorder` from
   `@humanspeak/svelte-motion/m` inside `<LazyMotion features={domMax} strict>`; add it as a third section in
   `docs/src/routes/examples/lazy-motion/+page.svelte`, mirroring how `FeatureBundles` is registered there (its
   `sections` entry, `sourceUrl`, and `demoCodeSample(...)` call).
4. `.changeset/lazy-motion-m-split.md` (bump `patch`; the maintainer sets the release version): "**Behaviour
   change (Motion parity):** `motion.*` components now always have every feature and ignore `<LazyMotion>`; only
   `m.*` components take LazyMotion's bundle. `<LazyMotion strict>` now throws in development when a `motion`
   component renders inside it. New `@humanspeak/svelte-motion/m` entry exports `m` and a `Reorder` that gets its
   features from LazyMotion; the main `Reorder` inside `<LazyMotion strict>` warns once with that fix
   (Motion 14.7.0, #2232, #2094). LazyMotion does not reduce bundle size yet." Do not mention `m` outside
   LazyMotion or async-pending behaviour; plan 011's own changeset covers both.
5. Bundle measurement (report only, nothing committed): after `pnpm build`, bundle with the consumer's Vite 6 set-up
   (a throwaway script outside the repo, or `node -e` against `tests/consumer-vite6`) `export { motion } from '@humanspeak/svelte-motion'`
   and `export { m, LazyMotion, domAnimation } from '@humanspeak/svelte-motion'` and record both minified byte
   sizes in your report, so the maintainer can size the follow-up.
6. Gate: `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm build`, `pnpm package` (publint clean),
   `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`, `pnpm --dir docs build`, `pnpm --dir docs check`
   (0 errors), `PW_PORT=4220 pnpm exec playwright test e2e/lazy-motion e2e/reorder e2e/drag` (all pass),
   `trunk fmt` then `trunk check` on changed files, `git status` shows only in-scope files.

Commit (`docs(lazy-motion): motion vs m, strict mode, Reorder from the m entry`).

## Test plan

- Red-first anchors: the two new `LazyMotion.spec.ts` cases, the four `Reorder/lazyMotion.component.spec.ts` cases,
  the new `basic.spec.ts` assertion and the two new e2e specs (Step 1); all green after Steps 3-5.
- Guards: `m` behaviour per bundle (existing `LazyMotion.spec.ts` cases and `e2e/lazy-motion/basic.spec.ts`), `m`
  in strict mode, every existing Reorder unit spec and `e2e/reorder`, `e2e/drag` (the drag props gate), the
  consumer type and tree-shaking checks.
- Structural models: `reorder.component.spec.ts` (drag in jsdom), `LazyMotion.spec.ts` (mocks/timers),
  `e2e/reorder/basic.spec.ts`.

## Done criteria

- [ ] `grep -n "motionKindProp === 'm'" src/lib/html/_MotionContainer.svelte` → one match
- [ ] `grep -n '"./m"' package.json` → one match; `dist/m.js` and `dist/m.d.ts` exist after `pnpm build`
- [ ] All Step 1 tests pass; `e2e/lazy-motion`, `e2e/reorder`, `e2e/drag` pass
- [ ] `pnpm check` 0 errors; `pnpm test:only`; `pnpm package`; consumer test; docs build and check; `trunk check` clean
- [ ] Changeset exists and names the behaviour change; bundle sizes reported
- [ ] No out-of-scope files modified; `_MotionContainer.svelte` diff confined to the four listed regions

## STOP conditions

- `package.json` is not on motion-dom 14.7.1.
- "motion components keep every feature" passes before Step 3.
- The kind wrapper cannot keep reactivity or `bind:ref` intact (Step 2), or changes SSR output (Step 5.3).
- Making `motion` ignore LazyMotion breaks an existing e2e or unit test that encodes the old gating, other than
  the ones this plan updates — report it rather than editing that test.
- Any change is needed in `_MotionContainer.svelte` outside the four regions, or in `src/lib/vite.ts`.
- `pnpm package` (publint) rejects the `./m` export.

## Maintenance notes

- Plan 011 follows in the same lane: featureless `m` outside LazyMotion and while an async bundle loads. It will
  rewrite this plan's tabindex-based unit/e2e assertions into behavioural ones, because upstream adds `tabindex`
  from props whatever the features. Follow-up to plan separately: real tree-shaking — move drag, pan and the projection
  adapter behind `domAnimation` / `domMax`, then port upstream's `Reorder/__tests__/tree-shaking.test.ts` canaries
  into `tests/consumer-vite6/verify-tree-shaking.mjs`.
- The strict check runs once at component init; upstream re-checks per render.
- `svelteMotionOptimize` rewrites only `motion.TAG`; if it ever learns `m.TAG`, it must keep the kind (import from
  the `./m` entry, not `html/Tag.svelte`).
- Reviewers: check the Proxy in `withMotionKind` forwards every trap Svelte uses (`get`, `has`, `ownKeys`,
  `getOwnPropertyDescriptor`, `set`), and that `__motionKind` / `ignoreStrict` never render as DOM attributes.
