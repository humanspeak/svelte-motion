# Guard report — 008 reorder-board-docs

**Recommendation: PASS** — Reorder.Board has a docs page and two working demos, and all docs gates are green on the branch.
**Reviewed at** 17c0a300 · 2026-11-06 15:14 · **Plan planned at** f93a1d92 (drift note amended 2026-11-06)
**Integrated** — committed on `feat/motion-14.10.1`. No PR mid-batch.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| reorder-board docs page + example page exist | met | `docs/src/routes/docs/reorder-board/+page.svx`, `docs/src/routes/examples/reorder-board/+page.svelte` |
| reorder-board in docsNav and examplesIndex | met | 1 match each |
| docs build / check / test / geo-seo / browser | met | exit 0 / 0 errors / 11 / exit 0 / 12 |
| only in-scope files | met | 8 docs files |

## Spirit

The new public component is documented to the repo's feature checklist, with clearer guidance than upstream's JSDoc-only docs: the two onReorder calls, the "update from latest state" note, canMove semantics, and scrolling.

## Scope & conduct

- In scope: yes. STOP respected: none fired. Amendments: pre-flight drift note.

## Residual risk / follow-ups

- The maintainer must try `/examples/reorder-board` and `/docs/reorder-board` before the PR.
