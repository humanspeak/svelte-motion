# Plan 002: `inherit={false}` stops variant inheritance, matching Motion 13.5.1

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.5.1/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Dependency check (run first)**: `node -p "require('motion-dom/package.json').version"`
> must print `13.5.1` or higher. If it doesn't, STOP: plan 001 (the bump) must land first.
>
> **Drift check**: `git diff --stat 9eba7a61..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/types.ts src/lib/utils/visualElementCore.ts docs/src/routes/docs/variants/+page.svx`.
> Plan 001 should not touch these. If they changed, re-check the excerpts below.
>
> Revision 2026-10-02 (guard pre-flight): the drift baseline moves to **`25379974`**
> (plan 001 integrated; motion-dom 13.5.1 installed). `_MotionContainer.svelte`
> changed since `9eba7a61` (Motion 13.5.0 follow-ups), but every excerpt below was
> verified present. The line numbers moved: `parentVariantStore` is at ~919, the
> subscriptions at ~926/943, `effectiveAnimate` at ~950,
> `setVariantContext(localVariantStore)` at ~977, `getInitialVariantContext()` at
> ~991, its non-controlling return at ~1006, and the store `$effect` at ~1146. Use
> `git diff --stat 25379974..HEAD -- <paths>` as the drift check. **NEVER use `git stash`.**

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (variant propagation is central; covered by the existing variants e2e)
- **Depends on**: 001-motion-dependency-refresh.md (DONE)
- **Category**: direction (upstream parity)
- **Planned at**: commit `9eba7a61`, 2026-10-01

## Why this matters

Framer Motion documents `inherit={false}` on a motion element. It means: don't
follow the parent's variant changes, and don't let the parent's variant tree
reach my descendants either. Motion 13.5.1 (upstream commit `b63833cb0`, "Honour
inherit={false} in variant inheritance and propagation") makes both walks stop at
any element with `inherit={false}`.

svelte-motion propagates variants over **two** channels:

1. motion-dom's VisualElement variant tree (`variantChildren`), which drives
   parent-triggered and gesture animations. 13.5.1 fixes this one for us inside
   `VisualElement.mount`.
2. Our own Svelte context stores in `_MotionContainer.svelte`, which supply the
   inherited **animate** label (`localVariantStore`) and the inherited **initial**
   label (`setInitialVariantContext`). Today these ignore `inherit` entirely.

On top of that, `inherit` isn't in our public prop types or docs. It is only
read through a cast in `visualElementCore.ts:388`. So after the bump, an element
with `inherit={false}` would leave the VisualElement tree but still receive the
parent's labels through our stores, and the two channels would disagree. This
plan makes our stores honor `inherit={false}`, types and documents the prop, and
ports upstream's four tests.

## Current state

### Upstream tests to port (`packages/framer-motion/src/motion/__tests__/variant.test.tsx`, commit `24febe178`)

```tsx
describe("inherit={false}", () => {
    test("child does not follow parent variant changes", ...)
    // parent: animate={variant} initial="a"; child: inherit={false}
    //   variants={{ a: { opacity: 0.2 }, b: { opacity: 0.8 } }} transition={{ type: false }}
    //   style={{ opacity: 0.5 }}  → stays 0.5 before and after the parent switches a → b
    test("descendants of an inherit={false} node do not follow the outer parent", ...)
    // middle: <motion.div inherit={false} variants={{}}>; grandchild as above → stays 0.5
    test("descendants of a plain inherit={false} node do not follow the outer parent", ...)
    // middle: <motion.div inherit={false}> (no variants) → grandchild stays 0.5
    test("child does not follow parent gesture variants", ...)
    // parent: animate="rest" whileHover="hover"; child inherit={false}
    //   variants rest 0.2 / hover 0.8, style opacity 0.5 → hover parent → child stays 0.5
})
```

Read the full source with
`git -C ~/Github/motion show 24febe178 -- packages/framer-motion/src/motion/__tests__/variant.test.tsx`.

### Our channels (`src/lib/html/_MotionContainer.svelte`)

Animate-label channel (around lines 930–960):

```ts
    const parentVariantStore = getVariantContext()
    ...
    let initialInheritedVariant: string | undefined = undefined
    if (parentVariantStore) {
        parentVariantStore.subscribe((v) => (initialInheritedVariant = v))()
    }
    ...
    let inheritedVariant = $state<string | undefined>(initialInheritedVariant)
    $effect(() => {
        if (!parentVariantStore) {
            inheritedVariant = undefined
            return
        }
        const unsubscribe = parentVariantStore.subscribe((v) => (inheritedVariant = v))
        return () => unsubscribe()
    })
    const effectiveAnimate = $derived(
        declarativeAnimateProp ??
            (variantsProp ? (inheritedVariant ?? initialInheritedVariant) : undefined)
    )
```

The node publishes to its children with `setVariantContext(localVariantStore)`
(~line 989). It sets the store from `effectiveAnimate` (~line 1158), or
`undefined` when it has no `variants`.

Initial-label channel (~lines 1003–1020):

```ts
    const inheritedInitialVariant = getInitialVariantContext()
    setInitialVariantContext(
        untrack(() => {
            const isControllingVariantLabels = isControllingVariants({ ... } as MotionNodeOptions)
            if (!isControllingVariantLabels) return inheritedInitialVariant
            return isVariantLabel(initialProp) ? (initialProp as string | string[]) : undefined
        })
    )
```

First-paint values (`src/lib/utils/visualElementCore.ts` ~380–392) already skip
context when `inherit === false`:

```ts
    if (
        context &&
        variantNode &&
        !controllingVariants &&
        (props as { inherit?: boolean }).inherit !== false
    ) {
        if (initial === undefined) initial = context.initial
        if (animate === undefined) animate = context.animate
    }
```

Prop types: `src/lib/types.ts` declares motion props such as `variants?: Variants`
(~line 544) and `custom?: unknown` with JSDoc. Add `inherit` next to them.

### Conventions

- Variant test pages live in `src/routes/tests/variants/<name>/+page.svelte`, and
  specs in `e2e/variants/<name>.spec.ts`. Exemplar: `e2e/variants/inherited-initial.spec.ts`
  (ROUTE with `?@isPlaywright=true`, reading opacity via `getComputedStyle`).
- Index links go in `src/routes/+page.svelte` with the other `/tests/variants/*` entries.
- Human-reviewed pages carry a `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`).
- Docs: `docs/src/routes/docs/variants/+page.svx`.

## Commands you will need

| Purpose   | Command                                                            | Expected  |
| --------- | ------------------------------------------------------------------ | --------- |
| e2e (new) | `pnpm exec playwright test e2e/variants/inherit-false.spec.ts`     | all pass  |
| e2e (all variants) | `pnpm exec playwright test e2e/variants`                  | all pass  |
| Units / types | `pnpm test:only` ; `pnpm check`                                | pass ; 0 errors |
| Package   | `pnpm package`                                                     | publint "All good!" |
| Docs      | `pnpm --dir docs check`                                            | 0 errors  |
| Lint      | `trunk fmt <files>` then `trunk check --no-fix <files>`            | no issues |

Port 4198: never kill it. If it is busy, report e2e as blocked.

## Scope

**In scope:** `src/lib/types.ts` (the `inherit` prop), `src/lib/html/_MotionContainer.svelte`
(the two inheritance channels only), `src/routes/tests/variants/inherit-false/+page.svelte`
(create), `e2e/variants/inherit-false.spec.ts` (create), one index link in
`src/routes/+page.svelte`, `docs/src/routes/docs/variants/+page.svx`,
`.changeset/variants-inherit-false.md` (create), and the README status row.

**Out of scope:** `LayoutGroup`'s own `inherit` prop (a different feature), motion-dom,
`visualElementCore.ts` (it already honors `inherit` for first paint, so leave it), and
custom-value inheritance (`getCustomContext`). Upstream's change doesn't touch `custom`.

## Steps

### Step 1: Red — port the four upstream tests as e2e

Create the page with four isolated scenarios mirroring upstream (use
`transition={{ type: false }}` and `style={{ opacity: 0.5 }}` exactly as upstream
does). Use buttons to switch each parent's variant `a`→`b`, and use a hoverable
parent for scenario 4. Use `data-testid`s `child-1`, `grandchild-2`, `grandchild-3`,
and `child-4`. The spec asserts opacity `0.5` before and after the switch or hover
(poll for 300ms after the trigger to make sure nothing animates). Also add a
**control scenario** without `inherit={false}`, whose child must go to `0.8`.

**Verify**: run the spec. At least scenarios 1 and 3 should FAIL, with opacity
`0.8` or `0.2` instead of `0.5`, because our stores still feed inherited labels.
Record exactly which fail. If all four already pass, STOP and report: the bump
alone may be sufficient, and the advisor should re-scope.

### Step 2: Type and document the prop

In `src/lib/types.ts`, add `inherit?: boolean` beside `variants` with JSDoc:
"Set to `false` to stop this element from inheriting variant changes from its
parent; its descendants then follow it instead. Matches Framer Motion's `inherit`."
Remove the cast at `visualElementCore.ts:388` only if the type now makes it
unnecessary **and** removing it touches nothing else. Otherwise leave that file alone.

**Verify**: `pnpm check` → 0 errors.

### Step 3: Make both store channels honor `inherit={false}`

In `_MotionContainer.svelte`, read the `inherit` prop. When it is `false`:

- Treat the parent animate-label store as absent: don't read
  `initialInheritedVariant`, and keep `inheritedVariant` `undefined`.
- In `setInitialVariantContext`, for a node that isn't controlling variant
  labels, publish `undefined` instead of `inheritedInitialVariant`. Children
  below an `inherit={false}` node must not get the outer initial label.
- The node's own `localVariantStore` keeps publishing its **own** labels, so its
  descendants follow it, as upstream does.

Keep the change minimal and comment it with a citation to motion `b63833cb0`.

**Verify**: `pnpm exec playwright test e2e/variants/inherit-false.spec.ts` → all
pass, including the control. Then `pnpm exec playwright test e2e/variants` → all pass.

### Step 4: Docs, link, changeset

- Add an "Opting out with `inherit={false}`" subsection to the variants docs, with
  a short example.
- Link the page from the index as `Variants: inherit={false}`.
- Create `.changeset/variants-inherit-false.md` (patch):
  "`inherit={false}` on a motion element now stops it, and its descendants, from
  following the parent's variant changes, matching Motion 13.5.1."

**Verify**: `pnpm --dir docs check` → 0 errors; trunk is clean on touched files.

### Step 5: Full gate

`pnpm test:only`, `pnpm check`, `pnpm package`, and `pnpm exec playwright test e2e/variants e2e/animate-presence` → all pass.

## Test plan

- Red first (Step 1): the ported upstream scenarios fail on our stores before
  Step 3, which proves the store channel is the gap and not the VisualElement tree.
- The control scenario guards against over-blocking (normal inheritance must still work).
- The existing `e2e/variants` and `e2e/animate-presence` suites guard against regressions.

## Done criteria

- [ ] Page + spec + link exist; the four ported scenarios + control pass; Step 1's failures recorded
- [ ] `inherit?: boolean` typed with JSDoc; docs subsection added; changeset added
- [ ] `e2e/variants` and `e2e/animate-presence` all pass; units, check, and package are green
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- The dependency check fails (motion-dom < 13.5.1).
- All four scenarios already pass at Step 1.
- Fixing it seems to need changes to motion-dom, `LayoutGroup`, or `custom` inheritance.
- Any pre-existing variants or presence e2e fails after Step 3.

## Maintenance notes

- Our label stores duplicate part of motion-dom's variant context. If a future
  Motion version moves label inheritance fully into VisualElement, revisit
  whether these stores are still needed.
- Reviewers: check that the plain `inherit={false}` node (no `variants`) still
  blocks its descendants (scenario 3). That is the case most likely to regress.
