# Guard report — 003-reorder-on-reorder-moved

**Recommendation: PASS** — every done criterion reproduced green by guard; the diff serves the plan's intent.
**Reviewed at** `cd3192bd` (lane/1460-reorder) · 2026-10-26 17:05 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`)
**Integrated** — not yet: batch convention is one branch, one PR. Merges into `feat/motion-14.6.0` per the README order; the PR opens after the batch's final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Reorder unit specs pass | met | `vitest run src/lib/components/Reorder` → 61/61 |
| `onReorder` type and `commit` helper present | met | `types.ts:37`, `Group.svelte:119` (`commit(order, newOrder, value)`) |
| `pnpm check` 0 errors | met | 0 errors, 33 warnings (pre-existing) |
| `pnpm test:only` passes | met | 91 files, 1151 tests |
| `PW_PORT=4203 … e2e/reorder` passes | met | 25/25 |
| Docs row + changeset | met | docs/reorder +page.svx, .changeset/reorder-on-reorder-moved.md |

## Spirit

`onReorder(newOrder, moved)` matches upstream's `commit`: it passes the moved value and only fires when the order really changed. The guard on unchanged orders is what plan 009's Escape-without-moving relies on.

## Scope & conduct

In scope. The plan expected the line-640 assertion to change, but it goes through `ClickAfterDragHarness.svelte` (out of scope), which only forwards one argument. It still passes unchanged, so the executor correctly left it. The harness type change was committed after the red commit so the pre-commit svelte-check could pass; red results are unaffected (type-only). Guard snapshot-committed Steps 2-4 as cd3192bd.

## Residual risk / follow-ups

- `isReordering` is still set before `commit`, as upstream does, so an order that changes but maps back to identical `values` would hold the swap guard until `values` changes. Same as upstream. Plan 009 continues on this lane and changes `commit` to return a boolean.
