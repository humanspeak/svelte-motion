# Guard log — 002 tap-prop-press-options

## Checkpoint 1 — 2026-11-06 14:40 — ON TRACK

495a30fb · final close-out (Opus executor in worktree t3-d8901b21)

- The diff mirrors upstream `press.ts`/`hover.ts` at v14.10.1:
  - one `pressOptions` object for the component's lifetime, synced in place by `$effect.pre`;
  - a separate press `$effect`, gated on a derived `hasTapGesture` (upstream `definitions.ts` tap list);
  - getter-backed callbacks read at event time;
  - `onRepeat` fires onTap without `setActive`.
- The props are destructured, so they no longer reach `rest` or the DOM.
- Red reproduced by guard (worktree, old gestures.ts, _MotionContainer.svelte and types.ts): 7 fail — 6 attachPressGesture option cases plus the attribute-leak probe.
- Green reproduced on the branch:
  - `pnpm check` 0 errors; `pnpm test:only` 1593/1593.
  - `PW_PORT=4250 … tap-options, armed-buttons, rapid-tap, hover-and-tap` 12/12.
  - `pnpm build` + docs build exit 0; docs check 0 errors.
  - Greps: `tap: tapProp` at :222; one `attachPressGesture(` call.
- Deviations reviewed:
  - No `docsNav` entry. Justified: there is no new docs page, only a section on `/docs/gestures`.
  - `Object.keys` loop instead of `for…in`, to satisfy the guard-for-in lint rule. Same behaviour.
- The executor's full e2e had 1 failure, `pop-layout-scroll-siblings:909`. That is the same load-induced frame-capture flake already logged under 001.
- The commit was blocked once by grype DB cache corruption (parallel trunk runs). Guard rebuilt the cache; this is an environment issue.
- Action: README → DONE.
