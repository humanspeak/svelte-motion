# Guard log: plan 003 (`onLayoutMeasure` runs untracked)

## Rounds

1. **2026-11-21, STOP.** Step 2 broke `e2e/reorder/keyboard-grid` 3/3. It also changed which code path committed in `reorder.component.spec` "projects each newly displaced sibling…". The maintainer chose to fix this in this release. Step 2b added an internal `__layoutRemeasureKey` from `Reorder.Item`.
2. **STOP.** Step 2b fixed both, but `e2e/reorder/basic` "keeps a held item pinned…" (`axis="y"`) drifted about 19px, 3/3. The old leak only restarted items in groups without an `axis` prop, because `updateDetectedAxis` reads `values` only then. Step 2b item 5 keys only those groups, through `context.detectsAxis`.
3. **STOP.** `basic` passed 21/21, but the `axis: 'x'` unit spec failed on the commit's second argument only (`{ ownSubtreeChanged: false }`); the rect was correct. The maintainer chose to loosen that spec to assert the rect (Step 2c).

## 2026-11-21, final: PASS

- **Red, executor-reported (round 1):** on unmodified code, `measure-state` test 1 collected `effect_update_depth_exceeded`, and test 2 added 3005 measures on one toggle.
- **Diff read in full:**
  - The subscription effect calls the consumer through `untrack` on both the seed and the listener.
  - The internal prop is declared, destructured and read at the top of the layout observer effect.
  - `Group.svelte`/`context.ts` add the `detectsAxis` getter and its type.
  - `Item.svelte` adds the derived key (`undefined` in axis-locked groups) and passes it.
  - The spec changes its two assertions to `mock.calls.map(([rect]) => rect)` / `toContainEqual`.
- **Executor-reported gate (final round, first run, no re-runs):**
  - Reorder unit 172/172, plus projection and layout 359/359;
  - `e2e/reorder e2e/layout e2e/layout-id e2e/projection` 237/237, twice;
  - `pnpm build` ok, `pnpm check` 0 errors, `pnpm test:only` 1760/1760;
  - `measure-state` 2/2;
  - Trunk no new issues.
- **Verified in the batch's full run:** the combined branch is verified as a whole in the batch-level full run that follows integration.
- **Needs maintainer sign-off:** `/tests/layout/measure-state` is a new tester page.
- **Integrated:** `33ebe824` on `fix/2.14.1`.
