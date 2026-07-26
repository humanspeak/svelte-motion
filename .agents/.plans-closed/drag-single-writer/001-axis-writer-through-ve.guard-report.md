# Guard report — drag-single-writer 001

**Recommendation: PASS** — drag's transform writes flow through the
VisualElement's axis values; the coalescing spec was hardened BEFORE the swap
and validated non-vacuous against the legacy writer; the one architectural
fork (authored raw transform strings) was resolved by parity ruling with
every #401 assertion preserved verbatim.
**Reviewed at** `c8f1c56` · 2026-07-25 20:45 · **Plan planned at** `04418be`
(re-stamped post-squash; drag-surface files byte-identical to `7eba0bd`)
**Integrated** — not pushed; batch continues (002–005); PR at batch close
after operator sign-off.

## Done criteria

| Criterion                                                                                       | Result | Evidence (guard-reproduced)                                                                                                         |
| ----------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check` exits 0; `trunk check` no new issues                                               | met    | 0 errors; hooks green on all landed commits                                                                                         |
| `pnpm test:only` exits 0                                                                        | met    | **801 passed** (guard re-run; 799 → 801 = new VE-path unit pins)                                                                    |
| Five-suite gate exits 0, matching baseline                                                      | met    | Guard re-run: **178 passed / 2 skipped / 0 failed** (baseline 177/2/0; +1 is the new raw-string parity pin)                         |
| Forbidden-trio grep clean (`svelteMotionDragTransform`, triple write, `startTransformComposer`) | met    | no matches                                                                                                                          |
| `svelteMotionDragActive` still present (plan 002's target)                                      | met    | `drag.ts:512/514`                                                                                                                   |
| Coalescing spec: style-attribute measurement + anti-vacuity floor, budget unchanged             | met    | `MIN_COMPOSES = 15` floor; validated against the LEGACY writer at 1.00 composes/frame before the swap                               |
| Step-4 mirror no-op result recorded                                                             | met    | INERT, not merely mismatch-free: 0 writes/0 mismatches across four pages; probe self-validated on legacy (350/116, 66/20, 2/2, 0/0) |
| README status row updated                                                                       | met    | 001 → DONE                                                                                                                          |

## Spirit

Delivered, upstream-shaped: `node.getValue('x'\|'y', base)` + `.set()` +
synchronous `node.render()`, with bound axes proven identical to the node's
values and whileDrag channels coalescing through `scheduleRender()`'s
per-frame de-dup (preserving the budget the spec measures). The blocker was
the process working: the executor BLOCKED rather than improvise when the VE
could not express an authored RAW transform string; guard verified upstream
drops them identically; the ruling re-expressed #401's base in channel form
with ZERO removed assertions (guard-audited: no `expect` deletions in the
spec diff) plus stronger base-preservation additions, a raw-string parity
pin annotated to #458, and the post-1.x enhancement ledgered with its
WAAPI-acceleration cost recorded.

## Scope & conduct

- In-scope only, including the ruling's three scope amendments; the
  container and plan file untouched by the executor.
- STOP conditions respected: one BLOCKED (correct), zero improvisation; the
  attempt was preserved on a side branch that made the ruling cheap.
- Measurement discipline exemplary: the coalescing re-measure landed BEFORE
  the swap and was validated against the legacy writer; the mirror probe was
  self-validated in both directions; a false-negative in the new parity pin
  (below-the-fold card silently missing pointer coordinates) was caught and
  fixed with `scrollIntoViewIfNeeded`.
- Superseded BLOCKED docs commit left in history (correct — no resets past
  guard commits).

## Residual risk / follow-ups

- **Plan 002's license is banked**: the container mirror is measured INERT —
  deletion is a no-op by evidence, not assumption.
- The dataset-active flag and gestures.ts guard remain (002's subject).
- #458: authored raw transform strings during channel animation (post-1.x).
- The no-VisualElement fallback path (standalone `attachDrag`/jsdom) keeps a
  single composed write — used by unit specs; if a future plan removes it,
  those specs must move to stub nodes.
