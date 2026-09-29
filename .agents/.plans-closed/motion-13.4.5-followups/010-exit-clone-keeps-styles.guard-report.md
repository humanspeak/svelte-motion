# Guard report — 010-exit-clone-keeps-styles

**Recommendation: PASS** — exit clones keep the element's look (placement in its own slot + string snapshots refreshed on structural change); re-entry mid-exit reverses on one element like upstream
**Reviewed at** 1b5d70dc · 2026-09-29 15:03 · **Plan planned at** 6f3612ab (amended ×2)
**Integrated** — committed on chore/motion-13.4.5 (f34fd411, 1b5d70dc); PR awaits maintainer sign-off

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| Step 1 + Step 5 specs red → green | met | executor red numbers; guard rerun 89/89 |
| no live declaration read after detach | met | grep lastComputedStyle src/lib → 0 |
| animate-presence + full e2e | met | guard 89/89; executor full 508/0 failed; guard full 506/0 on f34fd411 |
| snapshot off per-frame path, cost reported | met | ~0.7–0.9ms/snapshot; structural passes once per frame max |
| unit, check, build; changeset | met | 1020/1020; 0 errors; build ok; .changeset/exit-clone-keeps-styles.md |

## Spirit

Delivers upstream's "the exiting element looks and behaves like itself": correct styles through the whole fade, and re-entry reverses instead of stacking a second copy — both reported by the maintainer from the live page and confirmed on painted pixels.

## Scope & conduct

- Two approved amendments; one existing spec assertion changed to upstream semantics (disclosed). STOPs respected.

## Residual risk / follow-ups

- Transform read-back from computed matrix is lossy for rotate+scale combos during re-entry handoff.
- Snapshot pass cost scales with registered children (~0.9ms each) per structural event.
- Re-entry e2e covers opacity exits only.
