# Guard report — 009-reorder-keyboard

**Recommendation: PASS** — every done criterion reproduced green by guard; the revised focus design is implemented as written. Pending the maintainer's eye test of `/tests/reorder/keyboard`.
**Reviewed at** `fbe6d337` (lane/1460-reorder) · 2026-10-26 19:05 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`; revised before dispatch)
**Integrated** — not yet: batch convention is one branch, one PR. The PR opens after the batch's final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| `e2e/reorder/keyboard.spec.ts` (12 ported + 2 Svelte-specific) and `keyboard.component.spec.ts` pass | met | `PW_PORT=4203 … e2e/reorder` → 39/39 (includes the 14 keyboard tests); `vitest run src/lib/components/Reorder` → 88/88 |
| `e2e/reorder` passes; `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0 | met | 39/39; 0 errors; 92 files, 1178 tests; build exit 0 (executor, and the Playwright web server rebuilt it) |
| `tabindex={0}` once, before `{...rest}` | met | `Item.svelte:180` / `:181` |
| Docs `## Keyboard`, `Keyboard.svelte` demo, example section, changeset | met | reorder +page.svx, demos/Keyboard.svelte, examples FIG-005, .changeset/reorder-keyboard.md; `pnpm --dir docs check` 0 errors |
| Test page linked; no out-of-scope files | met | `src/routes/+page.svelte`; diff cd3192bd..fbe6d337 lists only in-scope files |

## Spirit

Reorder items are keyboard-reorderable with no opt-in, like Motion 14.6.0: Space grabs and drops, arrows along the axis move the item (Left/Right swap in RTL), and Escape restores the order from the grab. The Svelte-specific risks the adversarial review found are handled. The snapshot is a shallow copy, so in-place `$state` mutation can't corrupt Escape. Refocus is keyed on the grab state when the key was pressed, so Escape keeps focus. Refocus runs from an `$effect` on `values`, so the 120 ms deferred consumer keeps focus and the grab (new e2e case). Move-blurs don't reach the consumer's `onblur`. The red runs showed 12 e2e and 22 unit failures before the implementation.

## Scope & conduct

- In scope. `types.ts` untouched: `onkeydown`/`onblur` are narrowed locally in `Item.svelte`, because `HTMLElementProps` only has an `unknown` index signature.
- Requested addition: a guided `TesterPanel` on the keyboard test page (7 steps, live focused/grabbed/order readout and a "focus kept" verdict), hidden under `@isPlaywright`.
- Test adaptation (reviewed, accepted): in "arrows scroll until Space grabs…", a poll waits for Chromium's smooth keyboard scroll to settle before `scrollTo(0, 0)`. Upstream doesn't need it (the dev app has no smooth scroll); no assertion changed, and it is labeled a Svelte-port addition.
- An `open()` helper waits for a page-set `data-ready` marker before pressing keys (hydration).
- The docs build regenerated tracked `docs/static/r/animated-tabs.json`; the executor restored it, so it is not in the diff.
- No STOP fired.

## Residual risk / follow-ups

- Maintainer eye test of `/tests/reorder/keyboard` is still owed (sign-off before PR).
- Known edge, recorded in the plan: a click on non-focusable background while a deferred move is pending doesn't drop the grab until the next `values` change or keydown.
- No ARIA / live-region announcements (upstream has none either).
