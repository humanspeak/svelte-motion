# Guard report — 002 tap-prop-press-options

**Recommendation: PASS** — the `tap` prop works like upstream (count, hold, repeat, globalTapTarget, propagate.tap). Red was reproduced, and all criteria are green.
**Reviewed at** 495a30fb · 2026-11-06 14:40 · **Plan planned at** f93a1d92
**Integrated** — committed on `feat/motion-14.10.1`. No PR mid-batch.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `pnpm check` 0 errors | met | 1837 files, 0 errors |
| `pnpm test:only` all pass | met | 1593/1593 |
| tap-options + armed-buttons + rapid-tap e2e | met | 12/12, port 4250 |
| `tap: tapProp` in _MotionContainer | met | :222 |
| exactly one `attachPressGesture` call, own effect | met | grep count 1, separate `$effect` |
| docs build + check | met | exit 0; 0 errors |
| only in-scope files | met | the 14 planned files (docsNav justifiably untouched) |

## Spirit

Double tap, long press and stepper now work on motion components. A half-finished sequence isn't lost to listener churn when props change, which is the reason upstream keeps the options object. The DOM no longer gets a bogus `tap` attribute.

## Scope & conduct

- In scope: yes. STOP respected: none fired. Amendments: none.

## Residual risk / follow-ups

- The press listener now attaches in its own effect, after hover/focus/inView. That matches upstream's order (tap after hover), but it has only been checked through the existing gesture e2e tests.
