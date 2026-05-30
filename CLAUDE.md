# CLAUDE.md

## Project Overview

`@humanspeak/svelte-motion` — A Framer Motion-compatible animation library for Svelte 5. Spring physics, gestures, layout animations, exit animations, and scroll effects with a familiar declarative API.

- **Package**: `@humanspeak/svelte-motion`
- **Homepage**: <https://motion.svelte.page>
- **Repository**: <https://github.com/humanspeak/svelte-motion>

## Notes

## New feature checklist

When asked to implement a new feature, handle it end-to-end by default:

- Update the core component/API implementation.
- Add 1-3 focused test/demo pages under `src/routes/tests/<feature>/`.
- Link those test/demo pages from `src/routes/+page.svelte`.
- Add public docs pages under `docs/src/routes/docs/<feature>/`.
- Add example page(s) under `docs/src/routes/examples/<feature>/` and reusable demo components under `docs/src/lib/examples/<feature>/`.
- Add focused unit and Playwright e2e coverage when the behavior is testable.
- Create e2e tests for each test/demo page.
- Create unit tests for each new function.
- Ensure public functions, types, components, and exported constants follow Google-style JSDoc.
- Run formatting, checks, package validation, and targeted tests.
- If the user asks to review visually, start the appropriate docs/dev server and leave the example page open in the in-app browser.

## AnimatePresence wait mode

- When enter is deferred in `mode="wait"`, mark the enter animation as already handled
  before flipping `isLoaded` to `ready`. Otherwise the ready-state effects can re-run
  enter and cause a visible "pop" after the deferred animation completes.
- For object-based `animate` props, also set `objectAnimateRanOnMount` and
  `lastAnimatePropJson` when unblocking, to prevent duplicate runs.

## Docs parity: MultiStateBadge example

- Match the motion.dev example: `AnimatePresence mode="sync"` is only used in the label.
- The icon `AnimatePresence` should use default mode (no explicit `mode` prop).

## Failed e2e review workflow

- When a full Playwright/e2e run fails, review failures one at a time.
- For each failure, open the related test/demo page in the in-app browser before changing code.
- Explain what the page is supposed to demonstrate, what the failing test asserted,
  and what is visible on the page.
- Decide with the user whether the behavior is wrong or the test is too tight/stale
  before moving to the next failing page.
