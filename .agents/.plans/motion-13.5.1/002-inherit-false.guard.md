# Guard log: 002 inherit-false

## Checkpoint 1 (2026-10-02 12:28): PLAN AMENDED (defect) + ON TRACK

46dea41b (worktree snapshot) → 11ba3cfc (integrated on `chore/motion-13.5.1`) · final

- Pre-flight: drift baseline moved to 25379974. Excerpts verified present (shifted ~11 lines).
- Red was recorded by the executor: 4 upstream scenarios failed (opacity 0.2 vs 0.5). The control passed (reached 0.8), which proves the 0.5 readings aren't vacuous.
- **Plan defect:** the plan assumed motion-dom would see `inherit`. It was never forwarded into VisualElement props, so motion-dom 13.5.1's variant-tree walk, `makeLatestValues`, and our `visualElementCore.ts:388` check always saw `undefined`. The executor forwarded `inherit: inheritProp` in `buildMotionNodeProps`. That change is in an in-scope file and necessary, so it is accepted.
- **Guard mutation probes:** with forwarding only (stores reverted), the 2 descendant scenarios fail. With stores only (forwarding reverted), all 4 fail. Both halves are necessary and the tests discriminate each.
- Guard reproduced on the integrated branch: units 1104/1104; `pnpm check` 0 errors; build publint All good; docs check 0 errors (the worktree's 71 errors were missing generated files); **full e2e 577 passed, 2 skipped, 0 failed**.
- Verdict: PASS. Awaiting operator eye test; not DONE.
