# Guard log — 009-presence-placeholder-and-handoff

## Checkpoint 1 — 2026-09-29 11:22 — ON TRACK

9a3a8df5 · final close-out

- Red reproduced by executor: #b tops 160,160,120… during the exit (40px hop); unit placeholder margin '' vs '20px'. Root cause confirmed in-browser: stored CSSStyleDeclaration is live and empties after detach.
- Fix: string snapshot (lastLayoutStyle) captured while connected; placeholder reads it when detached. No existing assertion removed (diff -w).
- Step 3 parity tripwire: handoff starts at painted pre-shift position (≤0.01px), 3/3. Fixture uses ease-in [0.9,0,1,1] so the start check measures position, not elapsed time — accepted by guard (assertions unchanged).
- Guard rerun: vitest 1008/1008; check 0 errors; unmount + shift-swap ×3 15 passed; full e2e 500 passed / 2 skipped / 1 flaky (ai-glow-border frame budget, known).
- Open: executor reported the same detached-live-style bug in the exit-clone style freeze (presence.ts:980-985) and originalDisplay (:1037) — out of scope per STOP rule; reported to operator.
- Action: reported.
