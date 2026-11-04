# Spike 011 report: an `m` without loaded LazyMotion features

Lane `lane/1471-lazy`, after plan 010 and the merge of `feat/motion-14.7.1` (`84fe1006`).

- Red tests: `44939354` `test(lazy-motion): featureless m without LazyMotion features (spike 011)` (lane).
- Prototypes, on the throwaway branch `spike/1471-featureless-m` (never merge):
  - `de5bed92` Prototype A (upstream model, variant **A1**). Its parent is `44939354`.
  - `325953d9` Prototype B (keep the node, suppress features). Its parent is `de5bed92`, but its **tree is
    `44939354` plus B only**. Diff it with `git diff 44939354 325953d9`, not against A.
  - Both prototypes add `src/lib/components/featurelessM.divergence.spec.ts` and
    `__tests__/FeaturelessDivergenceProbe.svelte`. These are spike-only probes for the divergences listed in §3.4.

Line numbers below are on the lane at `44939354`, in `src/lib/html/_MotionContainer.svelte` unless another file is
named.

## 1. Results

### 1.1 Red anchors on the lane (before any prototype)

To see real failures, the specs were run with the markers removed (a `sed` copy). The committed files keep
`it.fails` / `test.fail`.

| Case | Result | Failing assertion |
| --- | --- | --- |
| unit: `an m outside LazyMotion has no VisualElement` | FAIL (red) | `visualElementStore.get(box)` is an `HTMLVisualElement` (`featurelessM.spec.ts:49`) |
| unit: `an m outside LazyMotion keeps the prop-derived attributes` (guard) | PASS | n/a |
| unit: `an m waiting on an async bundle has no VisualElement, then animates from initial` | FAIL (red) | node exists while pending (`:83`) |
| unit: `a late parent reaches its children` | FAIL (red) | node exists while pending (`:117`, the precondition) |
| unit: sync LazyMotion guard | PASS | n/a |
| e2e: `a bare m keeps initial and ignores hover` | FAIL (red) | opacity samples `0.71, 0.92, 1, 1, …` (want 0.4 throughout) |
| e2e: `an m in an async LazyMotion waits for its bundle, then animates in` | FAIL (red) | opacity `0.67, 0.92, 1, …` before `load` |
| e2e: control card (guard) | PASS | n/a |
| consumer SSR: bare `m` = `m` in LazyMotion = `motion` (guard) | PASS | n/a (see note) |

Notes:

- **SSR**: the three markups are equal only after the optimized-appear ids are normalised. The ids are
  per-instance counters (`svelte-motion-s1`, `-s2`, `-s3`). `verify.mjs` now replaces `svelte-motion-s\d+`
  before comparing.
- **Late-parent precondition**: the late-parent case asserts that neither node exists while the bundle is
  pending. Without that check it would pass today, because both nodes are created at init.
- **Async-case rewrite**: the first draft of the async case recorded `animateMotionValue` calls through a
  `vi.mock('motion-dom')`. Those calls are never seen: motion-dom calls its own internal module, not the
  mocked entry point. The committed case watches the node instead. It requires `latestValues.opacity === 0`
  when the node is created and at `AnimationStart`, and `1` after the frames have been flushed.
- **Marked runs**: with the markers in place, `vitest run src/lib/components/featurelessM.spec.ts` gives
  2 passed and 3 expected fail. `PW_PORT=4220 playwright test e2e/lazy-motion/featureless-m.spec.ts` gives
  3 passed.

### 1.2 After Prototype A (`de5bed92`)

| Case | Result |
| --- | --- |
| unit: no VisualElement outside LazyMotion | **green** |
| unit: prop-derived attributes (guard) | green |
| unit: async (no node while pending; enter animation starts from opacity 0; settles on 1) | **green** |
| unit: late parent (child `parent` is the box node; child is in `variantChildren`) | **green** |
| unit: sync guard | green |
| e2e: bare card | **green**, but only once A also stops emitting the optimized-appear script for a featureless `m` (see §3.5). Without that gate the card still read `0.64, 0.88, 1, …` |
| e2e: async card | **green** (same condition as the bare card) |
| e2e: control card (guard) | green |
| consumer SSR equality (guard) | **FAILS**, by design of the appear gate. The bare `m` has no `data-framer-appear-id` or `<script>`; `motion` and the sync-LazyMotion `m` still have both. The element markup is otherwise identical (`verify.mjs:103`) |
| divergence: `motion` child of a featureless `m` has `parent === undefined` | green (matches upstream) |
| divergence: style MotionValue on a featureless `m` does not reach the DOM | red (diverges; see §3.4) |

Regressions:

- `pnpm test:only` (1342 tests): 9 failed. These are the 3 `it.fails` markers that now pass, the style
  MotionValue divergence probe, and 5 `LazyMotion.spec.ts` cases. All 5 assert
  `hasAttribute('tabindex') === false` (`LazyMotion.spec.ts:50, 68, 83, 93, 113`), which is the
  `tabindex`-as-feature-proxy this plan expected to break.
- `PW_PORT=4220 playwright test e2e/lazy-motion e2e/layout e2e/layout-id e2e/animate-presence e2e/variants`,
  run before the appear gate: 272 passed, 12 skipped, 2 failed. Both failures are `tabindex` proxies:
  `e2e/lazy-motion/basic.spec.ts:12` and `:27` (`toBeNull()`, received `"0"`). No `layout`, `layout-id`,
  `animate-presence` or `variants` spec failed.
- After the appear gate, `e2e/lazy-motion` was run again: the same 2 proxy failures, and the two `test.fail`
  cards now report "expected to fail, but passed".
- No `motion.*` test changed result. `pnpm check` gave 0 errors.

### 1.3 After Prototype B (`325953d9`)

| Case | Result |
| --- | --- |
| unit: no VisualElement outside LazyMotion | **green** (see below: the plan predicted it would stay red) |
| unit: prop-derived attributes / sync guard | green |
| unit: async | **green** |
| unit: late parent | **green** |
| e2e: bare card / async card | **red**: opacity `0.60, 0.83, 1, …`. B has no appear gate, so the SSR WAAPI script animates the card |
| e2e: control card | green |
| consumer SSR equality | green (B emits the same SSR markup as today) |
| divergence: `motion` child of a featureless `m` has no parent | **red**: the child's `parent` is the featureless, unmounted VisualElement |
| divergence: style MotionValue does not reach the DOM | red (same as A) |

Regressions: the full unit run had 10 failures (the same 5 `tabindex` proxies, the 3 markers, and 2 divergence
probes). The guard e2e run gave 273 passed, 12 skipped, 4 failed: the 2 `basic.spec.ts` `tabindex` proxies plus
the 2 unmarked red cards. B was run with an unmarked copy of the featureless-m spec. No `motion.*` test changed
result. `svelte-check` gave 0 errors.

**Why "no VisualElement" turned green under B.** The plan assumed B would mount the node. It can't, given B's
other constraints. `VisualElement.mount()` (motion-dom `render/VisualElement.mjs:179-210`) does four things:

- it writes `visualElementStore`;
- it mounts `this.projection`, which the adapter constructor has already attached (`motionDomProjection.ts`
  constructor, `this.visualElement.projection = this.projection`);
- it joins the parent's `variantChildren`;
- it binds every value and renders it.

So "don't let the adapter mount or write styles" and "don't render from `latestValues`" only hold if the node
also stays unmounted. B therefore leaves `visualElementStore` empty. The node still exists in memory and is
reachable through the parent context, which is where B diverges (§3.4).

## 2. Audit (Step 2)

Classes:

- **(a)** inside a `$effect` or `$derived` (re-runs when a reactive value changes);
- **(b)** inside a closure created once at init (reads the current value when it is called);
- **(c)** an init-time statement;
- **(d)** TypeScript narrowing that is lost once the binding becomes a `let` / `$state.raw`. This was measured by
  running `svelte-check` after the A conversion: 12 errors at the rows marked "d".

Totals: `visualElement` 49 lines, `motionDomProjection` 51, `animationState` 38, `visualElementForRelatives` 3,
and 2 each for the four context getters and setters.

| Enclosing statement (line) | Class | Ref lines | Identifiers | A changed | B changed |
| --- | --- | --- | --- | --- | --- |
| `let visualElementForRelatives` (442) | c | 442 | visualElementForRelatives | – | – |
| `resolveRelativeAnimate` (467) | b | 490 | visualElementForRelatives | – | – |
| `measureLayoutRect` (702) | b | 708 | motionDomProjection | – | – |
| `$effect` (818) | a | 820 | motionDomProjection | – | – |
| style MotionValue fallback `$effect` (983) | a | 984 | visualElement | – | gate `&& !featureless` |
| `const visualElementParent = getVisualElementParent()` (1165) | c | 1165 | getVisualElementParent | getter | – |
| `const visualElement = …createMotionVisualElement` (1170) | c | 1170 | visualElement | `$state.raw` + `createNodes()` | – |
| `if (visualElement) { … setVisualElementParent }` (1217) | c | 1217-1231 | visualElement, visualElementForRelatives, setVisualElementParent | moved into `createNodes()`, setter takes a getter | – |
| `isDragActive` (1239) | b | 1240 | visualElement | – | – |
| `const motionDomProjectionParent` (1242) | c | 1243 | getMotionDomProjectionParent | getter | – |
| `const motionDomProjection = new …Adapter` (1244) | c | 1244, 1249 | motionDomProjection, visualElement | `$state.raw`, built in `createNodes()` | – |
| `if (motionDomProjection) setMotionDomProjectionParent` (1253) | c | 1253-1254 | setMotionDomProjectionParent | getter, set unconditionally | – |
| `const reentryHandoff` (1336) | c | 1337 | visualElement | – (init-only; see STOP risk 3) | – |
| `if (visualElement && reentryHandoff)` (1340) | c, **d** | 1340-1358 | visualElement | local `reentryNode` | – |
| `readAnimationStateStyleSlot` (1530) | b | 1531, 1555 | visualElement | – | – |
| `renderedInlineStyle` (1585) | a | 1595 | visualElement | – (null node → SSR branch, reactively) | `visualElement && !featureless` |
| `runAnimateChanges` (1700) | b | 1701-1707 | visualElement, animationState | – | – |
| `releaseWaitLayoutHold` (1753) | b | 1765 | motionDomProjection | – | – |
| `runAnimation` (1836) | b | 1848 | visualElement, animationState | – | – |
| adapter options `$effect` (1937) | a | 1938, 1943 | motionDomProjection | local `adapter` (cosmetic) | – |
| adapter mount `$effect` (1968) | a, **d** | 1969-2009 | motionDomProjection | local `adapter` | gate `featureless` |
| VE mount `$effect` (2022) | a, **d** | 2023-2071 | visualElement | local `node` | gate + `manuallyAnimateOnMount` |
| `shouldSkipAnimations` `$effect` (2084) | a | 2085-2086 | visualElement | – | gate |
| props `$effect` (2098) | a, **d** | 2099-2132 | visualElement, motionDomProjection | local `node` | gate |
| `$effect.pre` (2266) | a | 2278, 2289 | motionDomProjection | – | – |
| `runReactiveCommit` (2350) | b | 2392, 2410 | motionDomProjection | – | – |
| `$effect` (2413), `$effect.pre` (2467), `$effect` (2477) | a | 2422, 2474, 2482 | motionDomProjection | – | – |
| `consumeLayoutIdHandoffAfterSwitch` (2523) | b | 2524-2526 | motionDomProjection | – | – |
| `$effect.pre` (2533), `$effect` (2548), `$effect` (2594) | a | 2535-2599 | motionDomProjection | – | – |
| `suppressObservedLayoutCommit` (2619) | b | 2625-2642 | motionDomProjection | – | – |
| layout observer `$effect` (2650) | a | 2677-2926 (10) | motionDomProjection | – | – |
| `consumeLayoutIdHandoff` (2976) | b | 2982-2983 | motionDomProjection | – | – |
| `$effect` (2985) | a | 2997 | motionDomProjection | – | – |
| gestures `$effect` (3020) | a | 3021-3022 | visualElement | – | – |
| controls `$effect` (3071) | a | 3074 | visualElement | – | – |
| key-change `$effect` (3186) | a | 3236-3280 | visualElement, animationState | – | – |
| mount/enter lifecycle `$effect` (3325) | a | 3349 | animationState | gate on `visualElement` | gate on `featureless` |

Sites outside the table:

- **Render-time attributes**: the drag default style (1503-1507) and `tabindex` in `derivedAttrs` (1647-1654).
  Both prototypes drop the `hasDragFeatures` / `hasGestureFeatures` gate on them.
- **`activeFeatures` block** (265-273). A makes `activeFeatures` optional and derives `featureless` from it.
  B adds `featureless` and `startedFeatureless`.
- **Optimized appear** (`renderedOptimizedAppearScript`, 1421-1425). Only A gates it on `featureless`.

Consumers elsewhere in `src/lib`:

- `visualElementTree.context.ts:22-37` and `motionDomProjection.context.ts:11-20`. `_MotionContainer.svelte` is
  their only caller (`grep -rn` over `src/lib`).
- `Reorder/Item.svelte:119` calls `visualElementStore.get(element)?.animationState?.setActive(...)`. It is
  already optional-chained, so it is safe in both prototypes.
- `MotionDomProjectionAdapter` reads `options.parent` only in its constructor (`motionDomProjection.ts`, the
  constructor at about line 393). A late adapter therefore needs nothing more than the parent getter.

## 3. Answers

### 3.1 Can the adapter be created late? A1, not A2

**Yes, with A1 and no change to `motionDomProjection.ts`.** The VisualElement and the adapter are
`$state.raw` bindings filled by `createNodes(late)`:

- at init when the component has features (so `motion.*` and sync-LazyMotion `m` behave exactly as before);
- otherwise from an `$effect.pre` the first time `featureless` turns false.

Svelte's `$state.raw` is the holder object read through getters that A1 describes.

The adapter is built late, with the real node and the parent that exists at that moment. Two properties make
this cheap:

- Every effect that reads `visualElement` / `motionDomProjection` now tracks them, so effects that early-return
  on a null node re-run once the node exists. They run in declaration order, which keeps the existing
  "adapter mounts before the VE mount effect" ordering (1968 before 2022).
- For a component that has nodes from init, those bindings never change, so no effect re-runs. This is why no
  `motion.*` test moved.

A2 (an adapter without a VisualElement, handed one later) was not needed. It would also cost more: it makes
`readonly visualElement` / `projection` mutable, and the projection node is built from
`visualElement.latestValues` in the constructor.

### 3.2 Getter-backed parents and late variant inheritance

`setVisualElementParent(() => visualElement)` and `setMotionDomProjectionParent(() => motionDomProjection)` now
store getters, and the matching getters return a reader that is resolved inside `createNodes()`.

Variant inheritance through a late parent works. Measured by the unit case:

- the child's `parent` is the box node;
- the child is in `box.variantChildren`.

Pre-effects run parent-first, so a parent and child that become non-featureless in the same tick create their
nodes in tree order. Both are marked `manuallyAnimateOnMount = true`, as upstream does when `hasMountedOnce` is
already true (`use-visual-element.ts:84-86`). motion-dom then lets a late child animate an inherited label itself
(`animation-state.mjs:88-91`).

A `motion.*` child created at init under a featureless `m` keeps `parent === undefined`, which matches upstream.
Upstream creates `visualElementRef` once and never re-parents it.

### 3.3 Site count and touch list

**A**: 80+ / 67− lines in `_MotionContainer.svelte` (33 hunks), plus `LazyMotion.svelte` (6/5),
`lazyMotion.context.ts` (5/2), `visualElementTree.context.ts` (10/4), `motionDomProjection.context.ts` (10/4)
and `LazyMotionContextProbe.svelte` (1/1).

Changes to existing audit sites in `_MotionContainer.svelte`:

- 6 init (c) sites restructured into `createNodes()`;
- 4 (d) blocks given a local capture;
- 1 lifecycle gate.

Changes outside the audit list:

- the `activeFeatures` / `featureless` block;
- 2 attribute sites (drag default style, `tabindex`);
- the appear-script gate.

No (b) closure needed a change.

**B**: 17+ / 10− lines in `_MotionContainer.svelte` (11 hunks) and no other source file. It gates 6 effects and
the `renderedInlineStyle` / style fallback sites, and changes the same 2 attribute sites.

### 3.4 How far B diverges from upstream

Measured by `featurelessM.divergence.spec.ts` on the spike branch and by the e2e run:

1. **The node exists while featureless.** It isn't mounted, so `visualElementStore.get(el)` is `undefined`. It is
   reachable as the `parent` of any child created at init, though. A `motion.div` child of a featureless `m` gets
   `parent` = the unmounted, featureless node (probe red under B). Upstream gives it `parent === undefined`. At
   mount, that child joins the featureless node's `variantChildren` (`VisualElement.mjs:196-207`). From then on
   it relies on a parent that never propagates anything, and it won't animate inherited labels itself, because
   `manuallyAnimateOnMount` is false for a child whose parent has `current === undefined`.
2. **MotionValues are bound to the node** from init: `createMotionVisualElement` scrapes `style` and SVG
   MotionValues into `latestValues`. A user can see this through `useMotionValue` subscribers, because the
   values are attached to a node upstream doesn't create.
3. **`window.MotionIsMounted`**: B gates the lifecycle, so it isn't set by a featureless `m`. This matches
   upstream, but only because of the gate.
4. **The optimized-appear SSR script still animates a featureless `m` on the client.** B leaves the e2e cards red
   (opacity reaches 1 within about 200 ms). B needs the same gate as A, and then has the same SSR trade-off (§3.5).
5. **The adapter exists unmounted** and is the projection parent of any child adapter created at init. A child
   `layout` element under a featureless `m` gets a projection parent that has no instance. Upstream gives it the
   root.
6. **Style MotionValues still reach the DOM.** Both prototypes share this, so it isn't a B-only cost. Upstream
   `use-props.ts:9-19` (`copyRawValuesOnly`) skips MotionValues and renders them once from `visualState`, with
   no subscription. Here, `serializedStyleProp` (line 345, `serializeMotionStyle(styleProp)`) reads the
   Svelte-augmented MotionValue reactively, so `x.set(50)` re-renders `translateX(50px)`. Gating the style
   fallback effect (983) alone was tried on A and was not enough. It was reverted, and the probe stays red.

### 3.5 Shared finding: the optimized-appear script

svelte-motion emits an SSR WAAPI appear script for any element that has `initial` and `animate`. That is a
svelte-motion extension; upstream needs `startOptimizedAppearAnimation` to be called explicitly. Without a node
to hand off to, the script animates a featureless `m` to its `animate` target on its own.

Upstream SSR markup is the same for the three kinds, so a featureless `m` there renders `initial` and stays
there. To match the client behaviour, a featureless `m` must not emit the script. `featureless` can be decided on
the server: an `m` outside LazyMotion, or inside an async one, is featureless at SSR. Its server markup then
differs from `motion`'s by the appear attribute and the script only.

The build plan should keep the SSR guard but compare element markup with the appear attribute and the
`<script>` stripped. It should also add a positive assertion that the bare and async `m` emit no script.

## 4. Recommendation

**Build A, variant A1.** The maintainer's rule is to adopt upstream, and A gets there:

- every red anchor is green, including the e2e cards once the appear gate is in;
- the only regressions are the `tabindex` proxies the plan predicted;
- no `motion.*` result changed;
- the adapter needs no change.

B is smaller (27 lines against about 147 in the container), but it is not upstream: divergences 1, 2 and 5 in
§3.4 can be observed, and B still needs A's appear gate. The size difference doesn't justify keeping them.

## 5. Build-plan inputs (option A1)

### Files and regions (lane at `44939354`)

- `src/lib/components/lazyMotion.context.ts:9`: `getFeatures: () => FeatureBundle | undefined`, with JSDoc.
- `src/lib/components/LazyMotion.svelte:3, 30-31, 54, 64`:
  - publish `undefined` while pending and after a rejection (upstream only calls
    `features().then(...)`, so a rejected bundle never sets a renderer: `LazyMotion/index.tsx:59-63`);
  - drop the `domMin` import.
- `src/lib/components/visualElementTree.context.ts:22-37` and `motionDomProjection.context.ts:11-20`: setters
  take getters, and getters return readers. Update the JSDoc examples.
- `src/lib/html/_MotionContainer.svelte`:
  - 265-273: `activeFeatures` becomes optional; add `featureless`.
  - 1157-1255: `createNodes(late)`, the `$state.raw` nodes, the getter contexts and the `$effect.pre`. Keep the
    existing comments, re-indented.
  - 1340-1368: local `reentryNode`.
  - 1421-1425: appear-script gate.
  - 1503-1507 and 1647-1654: prop-derived attributes. Upstream also adds `tabindex` for `onTap` / `onTapStart`
    (`use-props.ts:76-81`). Today only a resolved `whileTap` adds it, so the build plan should port that too.
  - 1937-2011, 2022-2074, 2098-2140: local captures.
  - 3325-3326: lifecycle gate on the node.
  - Optional, for divergence 6: make `serializedStyleProp` (345) skip MotionValues on the client while
    `featureless`, as `copyRawValuesOnly` does. Needs its own red case; the spike's probe can be ported.
- `src/lib/components/__tests__/LazyMotionContextProbe.svelte:20`: `getFeatures()?.gestures`.

### Tests to rewrite from `tabindex` to behaviour

`LazyMotion.spec.ts`:

| Line | Test | Assert instead |
| --- | --- | --- |
| 47 | domMin, no gesture affordance | `whileTap` does not run (node has no `whileTap` active / scale stays) |
| 61 | upgrades async | no node while pending, node with gestures after |
| 76 | rejects | stays featureless: no node |
| 87 | stale loader | the node's gesture behaviour follows the latest bundle |
| 106 | motion vs m in `domMin` | the `motion` tap animates and the `m` tap doesn't |

`e2e/lazy-motion/basic.spec.ts`:

| Line | Assert instead |
| --- | --- |
| 12 | hover / tap scale per bundle, not `tabindex` |
| 27 | opacity stays at `initial` until the bundle loads, then animates (same shape as `featureless-m.spec.ts`) |

Remove the `it.fails` / `test.fail` markers in `featurelessM.spec.ts` and `e2e/lazy-motion/featureless-m.spec.ts`.
Update the page's `TesterPanel` status line, and narrow the `verify.mjs` featureless guard as described in §3.5.

### Docs and changeset

- `docs/src/routes/docs/lazy-motion/+page.svx`:
  - intro, lines 22-24: an `m` outside `LazyMotion` renders its `style` and `initial` and does nothing else;
  - `## Async loading`, line 52: replace "renders with `domMin` first" with "renders `initial` until the bundle
    resolves, then animates in";
  - `## Reorder with LazyMotion`, line 80: the `./m` Reorder needs a `LazyMotion` (`domMax`) or it does nothing.
- Changeset (patch, behaviour change):
  > `m` components now match Motion's `LazyMotion`. Without a `LazyMotion` above them, or while an async
  > `features` bundle is loading, they render `style`, `initial`, `tabindex` and the drag styles and run no
  > animation, gesture, drag or layout. When the bundle loads they animate in from `initial`. Previously an `m`
  > outside `LazyMotion` had every feature, and a pending async bundle gave it `domMin`.

### Effort and risk

- **Effort**: M. The source work is about 1 session (the prototype diff is about 150 lines and lifts nearly
  as-is). Add about half a session each for the test rewrites and docs, and the full gate.
- **Risk**: MEDIUM. The change is user-visible for anyone using `m` without `LazyMotion`, which used to get full
  features. For `motion.*` the risk is low: the nodes are created at init exactly as before, and the guard suites
  were unchanged.
- **Release**: it can ship in 2.7.0. It is upstream parity and has no new dependencies. The behaviour change for
  bare `m` belongs in the release notes.

### STOP risks for the build

1. A `motion.*` result changes. That would mean a `$state.raw` read in an effect that writes the same binding,
   or an ordering change in the 1968 → 2022 mount pair.
2. The appear-gate SSR trade-off is rejected by the maintainer. The alternative is dropping auto-appear for
   every `m`, which is a larger product change.
3. A featureless `m` inside `AnimatePresence`. The re-entry handoff (1336-1368) is init-only, so a late node
   skips it, and `mode="wait"` deferral was not exercised by the spike. Add a red case, or document the case,
   before relying on it.
4. A featureless SVG `pathLength` element stays in `isLoaded === 'mounting'`, so the `visibility:hidden` hold
   (1509) applies until features load. Upstream shows it. Not measured; check it in the build.

### Guard suites

- `pnpm check`
- `pnpm test:only`
- `PW_PORT=<lane> pnpm exec playwright test e2e/lazy-motion e2e/layout e2e/layout-id e2e/animate-presence e2e/variants`
- `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`
- Then the batch's full gate.
