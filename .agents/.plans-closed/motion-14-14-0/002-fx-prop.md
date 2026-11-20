# Plan 002: The `fx` prop renders as an empty `fx` attribute, as in Motion 14.14.0

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: this lane's Playwright port is **4272**. Prefix every Playwright command with `PW_PORT=4272`. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 4665b907..HEAD -- src/lib/types.ts src/lib/html/_MotionContainer.svelte src/routes/+page.svelte src/routes/tests/motion e2e/motion docs/src/routes/docs/api-reference`
> Plan 001 touches none of these paths. If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (one attribute, one type)
- **Depends on**: none. It does not need motion-dom 14.14.0. It is listed in wave 2 only so its lane is cut from a branch that already has plan 001.
- **Wave**: 2
- **Category**: migration (new public prop)
- **Planned at**: commit `4665b907`, 2026-11-14

## Why this matters

Motion 14.14.0 added an `fx` prop to motion components. It does nothing by itself: it renders an `fx` attribute that marks the element so a `<FX>` canvas layer it sits inside draws it separately and can apply effects to it. `<FX>` is not in the `motion` package at 14.14.0 (it belongs to Motion UI, which the CHANGELOG entry "Internal exports for use inside Motion UI" refers to). The prop is still public API on every motion component, with a JSDoc and a test upstream, so we match it: today `<motion.div fx />` in svelte-motion renders `fx="true"`, where upstream renders `fx=""`.

## Current state

- **Upstream** (read with `git -C ~/Github/motion show v14.14.0:<path>`):
  - `packages/motion-dom/src/node/types.ts:1096-1109`, in `MotionNodeAdvancedOptions`:
    ```ts
    /**
     * Draw this element on its own in the canvas of an `<FX>` it's
     * inside, at any depth, so it can have effects. Direct children of a
     * `<FX>` are drawn without it.
     *
     * ```jsx
     * <FX shaders={[motionBlur()]}>
     *   <ul>
     *     <motion.li fx animate={{ x: 300 }} />
     *   </ul>
     * </FX>
     * ```
     */
    fx?: boolean
    ```
  - `packages/framer-motion/src/render/dom/utils/filter-props.ts:32-39`:
    ```ts
    /**
     * `fx` marks the element for a canvas layer to draw. React doesn't
     * render `true` as an attribute.
     */
    if (key === "fx") {
        if (props.fx) (filteredProps as any).fx = ""
        continue
    }
    ```
  - `packages/framer-motion/src/motion/__tests__/fx-prop.test.tsx`: `<motion.div fx />` has `getAttribute("fx") === ""`; after re-rendering with `fx={false}` the attribute is absent; no console error.
  - `VisualElement.claimTarget` and a `shaders` animation-target type were added and then removed inside the range (`510e7b522`, `c11dd60aa`, removed by `94a35e0b3`). Do not port either.
- **svelte-motion**:
  - `src/lib/html/_MotionContainer.svelte:185-255` destructures the motion props and collects everything else in `...rest` (`:255`). `fx` is not a named prop, so it lands in `rest`.
  - `rest` flows into `spreadAttrs` (ends at `:1929`: `: (rest as Record<string, unknown>)`) and then into `derivedAttrs` (`:1932` on), which is spread onto the element:
    ```ts
    // Derived attributes to keep both branches in sync (focusability, data flags, style, class)
    const derivedAttrs = $derived<Record<string, unknown>>({
        ...spreadAttrs,
        // Upstream `render/html/use-props.ts:76-81`: `tabIndex = 0` from props
        …
        ...(upstreamDragDefaultStyle && (rest as Record<string, unknown>)?.draggable === undefined
            ? { draggable: 'false' }
            : {}),
    ```
  - Measured at planning time (jsdom, `render(motion.div, { props: { fx: true } })`): the element has `fx="true"`. With `fx: false` the attribute is absent.
  - `src/lib/types.ts:640` starts `export type MotionProps = {`. `transformTemplate?: TransformTemplate` is at `:722` with a JSDoc and an `@example` block in `svelte` fences; the new prop goes directly after it, in the same style. `HTMLElementProps` (`:1148`) has `[key: string]: unknown`, so `fx` already type-checks as `unknown`; the explicit member gives it a type and a doc.
  - Component-level unit tests render a probe or the component itself with `@testing-library/svelte`; see `src/lib/components/tapTabindex.spec.ts` for the `beforeEach`/`afterEach` shape (fake timers, a stubbed `requestAnimationFrame`, `flushTimers` from `$lib/__tests__/flushTimers`).
  - SSR tests: `src/lib/html/_MotionContainer.ssr.spec.ts` renders components on the server; copy one of its tests for the server-markup assertion.
  - Test pages live in `src/routes/tests/<area>/<page>/+page.svelte`, import from `$lib`, and are linked from `src/routes/+page.svelte`. The "Motion" section starts at `:22`; the `tap-options` link is at `:326-333`:
    ```svelte
    <li>
        <a
            class="text-blue-300 hover:underline"
            href={resolve('/tests/motion/tap-options') + searchParams}
        >
            Tap options: double tap, long press, repeat
        </a>
    </li>
    ```
  - Pages a human reviews use `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`), which hides itself under `?@isPlaywright=true`. Its step type is `{ text: string; expected: string; action?: { label?: string; run: () => void } }`. `src/routes/tests/motion/tap-options/+page.svelte` and `e2e/motion/tap-options.spec.ts` are the structural models.
  - Docs: `docs/src/routes/docs/api-reference/` holds the prop reference. Docs are `.svx` (mdsvex) and must not import `$lib`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Types | `pnpm check` | `0 ERRORS` |
| One unit file | `pnpm exec vitest run <path>` | as stated per step |
| One e2e file | `PW_PORT=4272 pnpm exec playwright test --project=chromium e2e/motion/fx-prop.spec.ts` | all pass |
| Docs | `pnpm build && pnpm --dir docs build && pnpm --dir docs check` | exit 0, 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Trunk is the lint and format authority. Do not run `prettier`, `eslint` or `pnpm lint` directly.

## Scope

**In scope:**
- `src/lib/types.ts`: one new `MotionProps` member
- `src/lib/html/_MotionContainer.svelte`: the `derivedAttrs` block only
- `src/lib/components/fxProp.spec.ts` (create)
- `src/lib/html/_MotionContainer.ssr.spec.ts`: one new test
- `src/routes/tests/motion/fx-prop/+page.svelte` (create)
- `e2e/motion/fx-prop.spec.ts` (create)
- `src/routes/+page.svelte`: one link in the Motion section, after the `tap-options` link
- `docs/src/routes/docs/api-reference/+page.svx`: one row or entry for `fx`
- `.changeset/fx-prop.md` (create)

**Out of scope:**
- Any `<FX>` component, canvas layer or shader. They do not exist in `motion` 14.14.0.
- `VisualElement.claimTarget` or a `shaders` target type (added and removed upstream inside the range).
- A docs example page. `fx` has no visible effect without `<FX>`; see the batch README's open questions.
- `src/lib/index.ts` (no new export).

## Git workflow

- Lane branch `lane/14140-fx`, cut from `feat/motion-14.14.0` after plan 001 is merged.
- Conventional commits, for example `test: fx prop renders an empty attribute (red)` and `feat: fx prop (Motion 14.14.0)`.
- Do not push.

## Steps

### Step 1: Write the failing tests

Create `src/lib/components/fxProp.spec.ts`. Header comment: cite upstream `fx-prop.test.tsx` and `filter-props.ts:32-39` at v14.14.0. Render `motion.div` from `'../index.js'` directly with `@testing-library/svelte`:

1. "fx renders as an empty attribute": `render(motion.div, { props: { fx: true } })`, then `container.querySelector('div[fx]')!.getAttribute('fx')` is `''`.
2. "fx={false} renders no attribute": after `await rerender({ fx: false })`, `container.querySelector('[fx]')` is `null`.
3. "fx can be turned back on": after `await rerender({ fx: true })`, the attribute is `''` again.
4. "no fx prop renders no attribute".
5. "a truthy non-boolean still renders an empty attribute": `fx: 'yes' as never` gives `''` (upstream tests `props.fx` for truthiness).

In `src/lib/html/_MotionContainer.ssr.spec.ts`, add "renders fx as an empty attribute on the server": the server markup of `<motion.div fx />` contains ` fx=""` and does not contain `fx="true"`.

**Verify**: `pnpm exec vitest run src/lib/components/fxProp.spec.ts src/lib/html/_MotionContainer.ssr.spec.ts` → tests 1, 3 and 5 and the SSR test FAIL with `expected 'true' to be ''` (or `'yes'` for test 5); tests 2 and 4 PASS. If test 1 passes on unmodified code, STOP.

### Step 2: Render the attribute

In `src/lib/html/_MotionContainer.svelte`, inside `derivedAttrs` and directly after `...spreadAttrs,`, add:

```ts
// Upstream `render/dom/utils/filter-props.ts:32-39` @ v14.14.0: `fx` marks
// the element for an `<FX>` canvas layer. A truthy value renders an empty
// attribute; anything else renders none.
...('fx' in spreadAttrs ? { fx: spreadAttrs.fx ? '' : undefined } : {}),
```

Do not add `fx` to the destructured prop list: it must stay in `rest` so it reaches both the HTML and the SVG branch through `spreadAttrs`.

**Verify**: `pnpm exec vitest run src/lib/components/fxProp.spec.ts src/lib/html/_MotionContainer.ssr.spec.ts` → all PASS.

### Step 3: Type and JSDoc

In `src/lib/types.ts`, directly after the `transformTemplate?: TransformTemplate` member of `MotionProps` (`:722`), add:

```ts
/**
 * Mark this element so an `<FX>` canvas layer it is inside draws it on
 * its own and can apply effects to it. Renders an empty `fx` attribute
 * and has no effect without such a layer.
 *
 * @example
 * ```svelte
 * <motion.li fx animate={{ x: 300 }} />
 * ```
 */
fx?: boolean
```

**Verify**: `pnpm check` → 0 errors.

### Step 4: Test page, e2e and home-page link

Create `src/routes/tests/motion/fx-prop/+page.svelte`, modelled on `tap-options`: a `motion.div id="box"` with `fx={on}`, a `<button id="toggle">` that flips `on`, a live readout `<output id="attr">` showing `box.getAttribute('fx')` as `""`, or `none` when absent, and a `TesterPanel` with two steps ("Look at the readout" / expected `fx=""`; "Click Toggle" / expected `no fx attribute`, with the toggle as the step action) and a live verdict in the `summary` snippet. The panel's `checks` snippet says plainly that `fx` has no visual effect in this release.

Create `e2e/motion/fx-prop.spec.ts`, loading `/tests/motion/fx-prop?@isPlaywright=true`: the box has `fx=""`; after clicking `#toggle` it has no `fx` attribute; after clicking again it has `fx=""`; the first assertion also holds with JavaScript disabled (server markup), following `e2e/text/exact-text.spec.ts` if it shows how this repo disables JS.

In `src/routes/+page.svelte`, add a link directly after the `tap-options` list item (`:326-333`), copying its markup: `href={resolve('/tests/motion/fx-prop') + searchParams}`, text `fx prop: renders an fx attribute (Motion 14.14)`.

**Verify**: `PW_PORT=4272 pnpm exec playwright test --project=chromium e2e/motion/fx-prop.spec.ts` → all PASS.

### Step 5: Docs and changeset

In `docs/src/routes/docs/api-reference/+page.svx`, add `fx` where the other advanced motion props (`transformTemplate`) are listed, in the same format as its neighbours: "`fx` — `boolean` — Renders an empty `fx` attribute that marks the element for an `<FX>` canvas layer (Motion 14.14). No effect without one."

Create `.changeset/fx-prop.md` (`'@humanspeak/svelte-motion': minor`): "Add the `fx` prop from Motion 14.14.0. It renders an empty `fx` attribute that marks the element for an `<FX>` canvas layer."

**Verify**: `pnpm build && pnpm --dir docs build && pnpm --dir docs check` → exit 0, 0 errors. Revert any change the docs build makes to `docs/static/r/animated-tabs.json`.

### Step 6: Gate

Run `pnpm check`, `pnpm test:only`, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; all unit tests pass; no new trunk issues.

## Test plan

- **Red-first anchor**: `fxProp.spec.ts` test 1 and the SSR test fail today with `fx="true"`.
- New unit tests: the five cases in Step 1, plus the SSR case. Model: `src/lib/components/tapTabindex.spec.ts` (shape), `_MotionContainer.ssr.spec.ts` (server render).
- New e2e: `e2e/motion/fx-prop.spec.ts` (three attribute states, plus server markup).
- Verification: `pnpm test:only` → all pass.

## Done criteria

- [ ] `pnpm check` → 0 errors
- [ ] `pnpm test:only` → all pass, including `fxProp.spec.ts`
- [ ] `e2e/motion/fx-prop.spec.ts` passes on port 4272
- [ ] `grep -n "fx?: boolean" src/lib/types.ts` → one line
- [ ] `grep -n "tests/motion/fx-prop" src/routes/+page.svelte` → one line
- [ ] `git status` shows only in-scope files

## STOP conditions

- The code at the locations in "Current state" does not match the excerpts.
- `fxProp.spec.ts` test 1 passes before Step 2.
- An SVG component (`motion.circle`) with `fx` renders `fx="true"` after Step 2: the SVG branch does not take `derivedAttrs`, and the fix needs a wider change than this plan allows.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- `fx` is inert until a `<FX>` layer exists. If upstream publishes `<FX>` (or Motion UI) later, that is a new feature with its own plan, docs page and example.
- `src/routes/+page.svelte` is a shared hotspot: plan 003 adds links in the "Layout" section (`:1221`), this plan in the "Motion" section. The hunks do not overlap.
- `_MotionContainer.svelte` is also edited by the `reactive-tracking-leaks` batch's plan 003 (one `onLayoutMeasure` effect, around `:3046-3132`) and possibly by this batch's plan 005 (around `:2700-2775`). This plan's hunk is at `:1932`.
- Reviewer: confirm `fx` was not added to the destructured props.
