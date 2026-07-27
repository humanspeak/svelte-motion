# Spike report 001 — choosing the mechanism for real-node exits

**Deliverable of** `.agents/.plans/clone-exit-migration/001-exit-mechanism-spike.md`
**Executed at** branch `clone-exit-migration`, commits `4776d0e` (candidate A
prototype) and `e3760da` (candidate B prototype), 2026-07-26.
**Environment** svelte `5.56.4`, Chromium via Playwright against `pnpm dev`,
`src/lib` untouched (`git diff --stat -- src/lib` empty).

## Recommendation, in one line

**Candidate B (data-driven children: `items` + `{#snippet child(item)}`)**, with
Candidate A refuted by experiment and Candidate C kept only as the fallback if
the API change is judged unacceptable.

---

## 1. What was prototyped

| Candidate | Prototype                                                                                                                                           | Route                                  |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A         | `src/routes/tests/_spike-clone-exit/spikeExitTransition.ts`, `SpikeExitBoxGlobal.svelte`, `SpikeExitBoxLocal.svelte`, `SpikeConsumerWrapper.svelte` | `/tests/_spike-clone-exit/candidate-a` |
| B         | `src/routes/tests/_spike-clone-exit/SpikeAnimatePresenceList.svelte`, `SpikeExitProbe.svelte`                                                       | `/tests/_spike-clone-exit/candidate-b` |
| C         | none (written assessment, §5)                                                                                                                       | —                                      |

Both routes carry the measured answers in their header comments; every number
below is reproducible from those routes plus `window.__spike.dump()`
(`spike-log.ts`). Prototypes are THROWAWAY and additive: nothing under
`src/routes/tests/_spike-clone-exit/` ships.

## 2. The finding that reframes the whole batch

**A `motion.*` child of the shipped `PresenceChild` does not exit today.**

Measured with product code only (`candidate-b` §5, and §6 with a simultaneous
motion-prop change as a control): with
`<AnimatePresence><PresenceChild present={false}><motion.div exit={…} />`, the
node stays at `opacity: 1` and is never removed — the wrapper holds it forever
because `safeToRemove` is never called.

Cause, in three citations:

- `ExitAnimationFeature.update()` (`src/lib/utils/visualElementCore.ts:182`) is
  invoked only from `VisualElement.updateFeatures()`
  (`node_modules/motion-dom/dist/es/render/VisualElement.mjs:317-345`);
  `VisualElement.update()` (`:370-393`) assigns
  `prevPresenceContext`/`presenceContext` but runs no features.
- the container calls `updateFeatures()` exactly once, in its mount effect
  (`src/lib/html/_MotionContainer.svelte:2076`).
- the props-sync effect calls `visualElement.update(next, buildPresenceContext())`
  inside `untrack()` (`:2120-2124`), so the presence flip is read untracked and
  re-runs nothing. Upstream runs both calls on every render
  (`framer-motion/src/motion/utils/use-visual-element.ts:147-148`).

So the "real-node path already exists and is VE-wired" premise in plan 001's
Current state holds for the _key-change_ exit (which the container drives
directly) and for consumer-driven exits via `usePresence`, but NOT for a
`motion.*` child's `exit` prop inside `PresenceChild`. Plan 004's unit specs pass
because they call `ve.updateFeatures()` explicitly
(`src/lib/utils/visualElementCore.spec.ts:202,251,282,291,315`), and no e2e
covers `PresenceChild` + a `motion.*` `exit`.

`SpikeExitProbe.svelte:54-72` emulates the missing two lines. That is the ONLY
new machinery Candidate B needed — everything else is existing code, which is
exactly the bar Step 2 set.

## 3. Candidate A — Svelte `out:` transition bridge: REFUTED

Answers to the plan's sub-questions, all with working code:

**(a) Can a motion component attach an outro to its own root element from the
inside? YES, trivially.** The element is created by the component's own
template, so `out:fn` is ordinary syntax — no compiler contract, no
`dispatchEvent` interplay. Shapes 1-8 all animate the REAL node (`opacity`
0.85 → 0.35 → 0.09 on `[data-spike-box]`, no `[data-clone]` node exists) and
Svelte defers removal until the outro ends (`outroend` and `onDestroy` both at
~402ms for a 400ms exit). Free bonus: Svelte sets `element.inert = true` for the
outro (`svelte/src/internal/client/dom/elements/transitions.js:270`) — measured
`inert: true` on every exiting box.

**(b) Does the outro fire when a PARENT block is destroyed? Only for some
nesting shapes, and neither modifier matches upstream.**

| Nesting shape (candidate-a)                   | local `out:` | global modifier   |
| --------------------------------------------- | ------------ | ----------------- |
| 1 component directly inside `{#if}`           | fires        | fires             |
| 2 plain element between `{#if}` and component | fires        | fires             |
| 3 keyed `{#each}`, item removed               | fires        | fires             |
| 8 consumer component + snippet in between     | fires        | fires             |
| 7 **nested `{#if}`**, outer one flips         | **NEVER**    | fires             |
| 6 ancestor of the whole boundary destroyed    | n/a          | fires (**wrong**) |

Mechanism: `pause_children(effect, transitions, true)` recurses with
`local = false` through any non-transparent child block
(`svelte/src/internal/client/reactivity/effects.js:636-667`); component and
snippet effects are `EFFECT_TRANSPARENT`, `{#if}`/`{#each}`/`{#key}` blocks are
not. In shape 7 `s7-local` stayed at `opacity: 1.00`, emitted no `outrostart`,
and was destroyed silently — a _silent_ fidelity failure in an extremely common
markup shape. `|global` covers it, but then shape 6 delays an ancestor's own
removal by the full 412ms exit, where upstream drops children instantly when the
boundary unmounts (`framer-motion/src/components/AnimatePresence/index.tsx:176-235`
renders nothing for a removed boundary). There is no API to distinguish the two
cases from inside the transition function.

**(c) Can `onExitComplete` end the outro exactly? Not with documented APIs.**
Measured in candidate-a shape 5:

| Strategy         | Exit `finished` | Node removed | Verdict                                                                                                                                                              |
| ---------------- | --------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fixed` (1000ms) | 412ms           | 997ms        | 585ms of an invisible node holding layout — unusable                                                                                                                 |
| `duration-match` | 412ms           | 397ms        | removed ~15ms EARLY; also presumes the exit duration is knowable at outro start (false for interrupted / velocity-seeded springs)                                    |
| `finish-hack`    | 412ms           | 430ms        | exact, but calls `.finish()` on the WAAPI animation Svelte creates at `transitions.js:465`, found by diffing `element.getAnimations()` — undocumented runtime output |

Per the plan's STOP condition, the `finish-hack` result is recorded as a
refutation, not a shipping mechanism.

**Two further disqualifiers, both measured:**

- **Effects are frozen during the exit.** `pause_effect` flips the subtree INERT
  (`effects.js:609-613`): zero `effect-run` entries for `s1-global` between
  `outrostart` (1ms) and resume (201ms) despite a 50ms interval mutating
  `$state`. Motion's rAF-driven animation still runs, but nothing `$effect`-driven
  does — including `ve.update(props, presenceContext)`, i.e. the exact call the
  VE architecture depends on.
- **Reversal is broken.** Hide, then re-show after 200ms: the node resumes but
  sits at the exit end state (`opacity: 0`, `transform: matrix(0.5,…)`,
  `inert: false`) with no signal to the component — `in()` only aborts the outro
  (`transitions.js:233-240`), no `introstart` is dispatched, and no reactive
  dependency changed, so nothing replays the enter. The clone path handles this
  today (`presence.ts:711` tears the placeholder down on re-registration).

Candidate A is therefore refuted: it needs runtime internals for exactness, it
silently misses a common nesting shape (or over-fires and delays teardown), it
freezes the VE's update channel for the duration of the exit, and it cannot
reverse.

## 4. Candidate B — data-driven children: WORKS on real nodes

`SpikeAnimatePresenceList.svelte` owns an internal array that lags the
consumer's `items`; removed keys stay rendered inside the shipped
`<PresenceChild>` until the exit reports completion. That is upstream's model
made explicit (`index.tsx:99-151` keeps `renderedChildren` behind
`presentChildren`; `:146-147` renders ONLY exiting children in `wait`).

Measured on `/tests/_spike-clone-exit/candidate-b`:

- **sync** — real node `b-item-a` animated `opacity` 0.73 → 0.24 with no
  `[data-clone]` node anywhere; `onExitComplete` → `safeToRemove` fired at 504ms
  for a 500ms exit (**exact**, no duration guessing), then the list dropped the
  entry (`list-dropped {rendered:"b,c"}`). Re-adding the key remounts and plays
  the enter (0.26 → 0.92).
- **wait** — stage-0 exited (0.72 → 0.22) while stage-1 was held invisible;
  `item-exit-complete` at 408ms, then stage-1 entered (0.26 → 0.84 → 1.00). No
  new coordination code: `PresenceChild`'s own accounting
  (`PresenceChild.svelte:92-109,164,206`) and the shared `inFlightExits` counter
  did it. One deviation to fix in the build plan: the incoming node is mounted
  (invisible) during the exit and so occupies layout, where upstream renders only
  exiting children. The list owns the array, so withholding it is ~5 lines.
- **popLayout** — the REAL node went `position: absolute` via the already
  exported, clone-agnostic helpers `measurePopLayoutSnapshot` /
  `resolvePopLayoutStyles` (`presence.ts:125-176`), and the surviving siblings
  collapsed immediately (`pop-item-p2` x 713 → 627) — same visual result as the
  clone column with no placeholder and no clone. Upstream does exactly this
  (`PopChild.tsx:126` `position: absolute !important`).
- **stateful content** — clone canvas pixel read back `[0,0,0,0]` (bitmap lost by
  `cloneNode(true)`, `presence.ts:897`) and focus dropped to `<body>`; the
  real-node exit kept the painted pixel `[34,197,94,255]`, the live input value,
  and keyboard focus (`document.activeElement` still the exiting `<input>` at
  `opacity: 0.36`).
- **SSR** — `curl` of the route server-renders every list item and zero
  `data-clone` nodes.
- **coexistence** — the route runs the list API and the clone path in one
  document with no interference: the container registers the clone path only when
  `!inPresenceChild` (`_MotionContainer.svelte:652`), and both paths already share
  one `inFlightExits` counter (`presence.ts:622,668,691` vs
  `notifyExitStart`/`notifyExitComplete`), so `mode='wait'` coordinates across a
  mixed tree. What can NEVER coexist is both mechanisms on the same element —
  and that is structurally impossible, since `inPresenceChild` excludes it.

**Ergonomics** (question a). Today vs the list API:

```svelte
<!-- today -->                                <!-- candidate B -->
<AnimatePresence>                             <AnimatePresence items={todos} getKey={(t) => t.id}>
  {#each todos as todo (todo.id)}                 {#snippet child(todo)}
    <motion.div key={todo.id} exit={…} />           <motion.div exit={…} />
  {/each}                                         {/snippet}
</AnimatePresence>                            </AnimatePresence>
```

- Lists get _better_: the `key={…}` prop duplication disappears (the depth-0 key
  requirement exists only because the clone path needs a registry key), and the
  `(todo.id)` each-key moves into `getKey`.
- Single conditional children get _worse_: `{#if visible}` becomes
  `items={visible ? [item] : []}`, and a `{#key stage}` swap becomes
  `items={[{ id: stage }]}`. This is the real ergonomic cost, and the reason
  §7's outline keeps a thin sugar layer (`present`/`when` prop) on the roadmap.
- Nesting is unchanged — it is just components, and `PresenceChild` already bumps
  `presenceDepth` (`PresenceChild.svelte:40-42`) so inner `motion.*` elements do
  not trip the depth-0 key check.

## 5. Candidate C — status-quo-plus (written assessment)

If B's API change is rejected, the smallest set of clone-path improvements that
closes the worst gaps found above, in value order:

1. **Fix the `PresenceChild` exit gap from §2** (2 lines + a spec + an e2e).
   Independent of the mechanism decision, and it should land regardless: today a
   documented public component silently never exits its `motion.*` child. This is
   the one item that is worth doing _even if B ships later_.
2. **`inert` on the clone.** Svelte gives Candidate A this for free; the clone
   currently duplicates a whole subtree into the a11y tree while it animates
   out. `clone.inert = true` (plus `aria-hidden`) removes a real, shipping a11y
   defect for ~2 lines (`presence.ts` clone construction, `:823-1035`).
3. **Canvas/iframe/media carve-out.** `cloneNode(true)` cannot copy bitmaps,
   media state, or shadow roots (measured: `[0,0,0,0]`). Detect
   `canvas|iframe|video|audio` in the subtree and skip the clone (remove
   immediately) rather than show a visibly blank ghost.
4. **Exit `custom` resolution timing.** The clone resolves the exit definition
   via `resolveExit(custom)` captured at registration
   (`presence.ts:185,1023,1036-1059`); upstream resolves it at exit time from
   `presenceContext.custom` (`animation-state.mjs`). Re-resolving inside
   `unregisterChild` from the context's _current_ `getCustom()` closes the
   divergence for late `custom` writes.

What stays permanently different from upstream under C: the exiting element has
no VisualElement and no projection node, so exit variants that depend on VE state
(velocity handoff, layout/projection during exit, gesture state, `MotionValue`
subscriptions), event handlers on the exiting element, focus retention, and
reversible exits are all out of reach — plus ~546 lines of style-copying
heuristics stay on the maintenance ledger and the library keeps its last legacy
`animate()` call (`presence.ts:1061-1062`).

## 6. Comparison matrix

Legend: ✅ works (measured) · ⚠️ works with a caveat · ❌ broken/impossible ·
📄 inferred from code/citation, not directly measured.

| Criterion                              | A — `out:` transition bridge                                                                                         | B — data-driven children (`items` + snippet)                                                                                                                                                                                                                                                       | C — status-quo-plus (clones)                                                                        |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `mode="sync"`                          | ✅ real node exits, removal deferred (candidate-a shape 1: 402ms for a 400ms exit)                                   | ✅ real node, exact completion at 504ms/500ms (candidate-b §1)                                                                                                                                                                                                                                     | ✅ shipping today (clone at `opacity` 0.74 → 0.25, candidate-b §1 right column)                     |
| `mode="wait"`                          | ⚠️ no mechanism of its own; would still need the presence gate, and the exiting node's effects are frozen (§3)       | ✅ existing `PresenceChild` gate, measured 408ms hand-off; ⚠️ incoming node currently mounted invisible (upstream withholds it)                                                                                                                                                                    | ✅ shipping today                                                                                   |
| `mode="popLayout"`                     | ⚠️ possible (prototype applies absolute styles in the transition fn) but shares A's completion/reversal defects      | ✅ real node absolute via existing exported helpers; siblings collapse (x 713 → 627)                                                                                                                                                                                                               | ✅ shipping today (clone + placeholder)                                                             |
| Nested `AnimatePresence`               | ❌ local outros silently skip a nested-block removal (shape 7); `\|global` over-fires on boundary teardown (shape 6) | ✅ plain component nesting; `presenceDepth` already handled 📄 (`PresenceChild.svelte:40-42`)                                                                                                                                                                                                      | ⚠️ works, pinned by `e2e/animate-presence/nested-keys.spec.ts`                                      |
| exit `custom`                          | ⚠️ resolvable in the transition fn, but the VE cannot be updated during the outro (effects frozen)                   | ✅ carried by the existing `buildPresenceContext()` `custom: resolvePresenceCustom()` 📄 (`_MotionContainer.svelte:379`) — upstream's own source (`animation-state.mjs`)                                                                                                                           | ⚠️ resolved at registration, not at exit time (`presence.ts:185,1023`) — divergence, fixable (§5.4) |
| Layout/projection during exit          | ❌ VE update channel frozen for the exit's duration (measured)                                                       | ✅ node keeps its live VisualElement while exiting (measured: `visualElementStore.get(node)` returned a mounted VE mid-exit)                                                                                                                                                                       | ❌ impossible — the clone is detached and has no VE/projection node                                 |
| Stateful content (canvas/iframe/focus) | ✅ real node, nothing copied                                                                                         | ✅ measured: canvas pixel `[34,197,94,255]` kept, input value kept, focus kept                                                                                                                                                                                                                     | ❌ measured: canvas `[0,0,0,0]`, focus → `<body>`                                                   |
| SSR / hydration                        | ✅ transitions are client-only, no SSR surface 📄                                                                    | ✅ `curl` renders every item, zero clones                                                                                                                                                                                                                                                          | ✅ shipping today                                                                                   |
| a11y                                   | ✅ Svelte sets `inert` on the outroing node (measured)                                                               | ⚠️ real node stays focusable/announced while exiting (measured focus retention) — needs `inert` on the held child                                                                                                                                                                                  | ❌ clone duplicates the subtree in the a11y tree; focus lost at flip (both measured)                |
| Reversible exit (exit → enter)         | ❌ node stuck at exit end state, no signal (measured)                                                                | ✅ `ExitAnimationFeature` re-entry path exists (`visualElementCore.ts:191-224`); prototype re-add replayed the enter (0.26 → 0.92)                                                                                                                                                                 | ⚠️ handled by placeholder teardown on re-registration (`presence.ts:711`)                           |
| Consumer-facing API change             | none (invisible mechanism swap) — its only virtue                                                                    | **breaking-ish**: `items` + `child` snippet; `{#if}`/`{#each}` markup must migrate (deprecation window is viable, §4)                                                                                                                                                                              | none                                                                                                |
| Implementation effort                  | n/a — refuted                                                                                                        | **L**: new `AnimatePresence` list mode, `PresenceChild onExitComplete` prop, `popLayout` inside `PresenceChild`, `updateFeatures` fix, docs + e2e for both APIs                                                                                                                                    | **M**: four independent fixes in §5                                                                 |
| Deletion payoff in `presence.ts`       | 0 (would _add_ a transition layer)                                                                                   | **~546 of 1238 lines** clone-only (44%), plus ~150 lines of container clone feed (`_MotionContainer.svelte:652,674-701,731-800`) and the library's last legacy `animate()` (`:1061-1062`); the 564 shared coordination lines and the 103-line popLayout measurement helpers survive and are reused | 0 (adds ~30)                                                                                        |

## 7. Recommendation and implementation outline

**Recommend Candidate B**, staged so the API change lands behind an additive
door and the clone path is deleted only after parity is pinned.

Evidence summary: B is the only candidate that gets all three modes onto the real
node with _exact_ completion, preserves stateful content and focus, keeps a live
VisualElement (the prerequisite for layout/projection during exit), matches
upstream's actual algorithm one-for-one, and pays for itself with ~44% of
`presence.ts` deleted. Its costs are an API addition and worse ergonomics for
single conditional children — both mitigable. A is refuted on four independent
grounds, three of which are silent-failure modes. C buys real but small wins and
leaves the deviation permanent.

Outline for build plan 002 (each step is a gate: `pnpm check`, `pnpm test:only`,
`pnpm test:e2e e2e/animate-presence` must stay green):

1. **Fix the `PresenceChild` exit gap (§2) first, standalone.** Re-run
   `updateFeatures()` and hand a fresh presence context whenever the wrapper's
   `isPresent` flips (upstream `use-visual-element.ts:147-148`). Red-first: an
   e2e on `<PresenceChild present={false}>` + `motion.div exit` — it fails today.
   Ship this even if the rest of the plan slips.
2. **Add `onExitComplete` to `PresenceChild`** (upstream `PresenceChild.tsx`
   has it) so a parent can learn per-item completion without the spike's context
   proxy. Keep `safeToRemove` semantics intact for `usePresence` consumers.
3. **Add `popLayout` to `PresenceChild`** (upstream's `PopChild`), reusing
   `measurePopLayoutSnapshot`/`resolvePopLayoutStyles` unchanged plus
   `anchorX`/`anchorY`.
4. **Add the list API to `AnimatePresence`**: `items` + `getKey` + a `child`
   snippet, an internal lagging array, and — for `mode="wait"` — render only
   exiting entries (`index.tsx:146-147`). Both APIs coexist; the clone path is
   untouched in this step. Gate: new e2e mirroring `e2e/animate-presence/*` for
   the list API, plus docs pages under `docs/src/routes/docs/animate-presence`.
5. **Mark `inert` (and `aria-hidden`) on held children** so the exiting node
   leaves the a11y/tab order — the one place Candidate A was better.
6. **Migrate the repo's own test/demo/docs pages** to the list API; keep at least
   two clone-path pages as the deprecation characterization pin.
7. **Deprecate, then delete.** One release with a console deprecation warning on
   snippet-children usage inside `AnimatePresence`, then delete the clone
   machinery (the 546 clone-only lines, the container feed, the legacy
   `animate()`), leaving the shared coordination intact — the `inFlightExits` /
   `enterBlocked` / `seenKeys` / `exitedKeys` coupling table in §8 is the
   checklist.

Open risks for 002 to own: `seenKeys`/`exitedKeys` are written only by the clone
path today (`presence.ts:711,721,812`) while `shouldAnimateEnter` reads them, so
the list API must write them; `isEnterBlocked` computes blocking siblings from
the clone-path `children` map (`:473-474,543`), which never sees PresenceChild
children — that asymmetry must be resolved before the clone path is removed.

## 8. Evidence index

Prototype files (all under `src/routes/tests/_spike-clone-exit/`):
`spike-log.ts`, `spikeExitTransition.ts`, `SpikeExitBoxGlobal.svelte`,
`SpikeExitBoxLocal.svelte`, `SpikeConsumerWrapper.svelte`,
`candidate-a/+page.svelte` (shapes 1-8 + measured answers a/b/c),
`SpikeAnimatePresenceList.svelte`, `SpikeExitProbe.svelte`,
`candidate-b/+page.svelte` (sections 1-7 + measured results).

Product code read (unmodified): `src/lib/utils/presence.ts`,
`src/lib/components/AnimatePresence.svelte`,
`src/lib/components/PresenceChild.svelte`, `src/lib/html/_MotionContainer.svelte`,
`src/lib/utils/visualElementCore.ts`.

Svelte runtime: `svelte/src/internal/client/dom/elements/transitions.js:193-296`
(transition manager, local/global flag), `:233-240` (`in()` aborts an outro),
`:270` (`inert`), `:328-340` (zero-duration = synchronous removal), `:465`
(the outro's WAAPI animation); `svelte/src/internal/client/reactivity/effects.js:609-667`
(`pause_effect`/`pause_children`, locality recursion).

motion-dom: `dist/es/render/VisualElement.mjs:317-345` (`updateFeatures`),
`:370-393` (`update`).

Upstream framer-motion (`~/Github/motion/packages/framer-motion/src/components/AnimatePresence/`):
`index.tsx:99-151` (lagging `renderedChildren`), `:146-147` (`wait` renders only
exiting children), `:176-235` (`PresenceChild` per child with `isPresent` +
`onExitComplete`), `PresenceChild.tsx:14-40` (`onExitComplete` prop),
`PopChild.tsx:126` (`position: absolute !important`).

Line accounting for the deletion payoff was produced by a read-only pass over
`presence.ts` (1238 lines → 546 clone-only / 564 shared / 128 ambiguous) and the
container's presence regions; the coupling points a migration must untangle are
`inFlightExits` (`presence.ts:622,668,691,1100`), `enterBlocked` +
`notifyEnterUnblocked` (`:665-667,694-697`), the `children` map used by
`isEnterBlocked` (`:473-474,543`), `exitedKeys`/`seenKeys` (`:711,721,812`, read
at `:417`), and `shouldRegisterPresenceExit`
(`_MotionContainer.svelte:652`, which also gates the key-change branch at
`:2744`).
