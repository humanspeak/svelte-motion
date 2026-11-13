# Plan 002: A sign-off page, e2e and docs for springs that carry velocity through an interrupt

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Never use `git stash`.**
>
> **Port rule**: this lane's Playwright port is **4262**. Prefix every Playwright command with `PW_PORT=4262`. Never use or kill port 4198. Never set `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 82bf6e74..HEAD -- src/routes/tests/motion src/routes/+page.svelte e2e/motion docs/src/routes/docs/use-spring docs/src/routes/docs/gestures`
> The only expected changes are plan 001's (none of them are in these paths). If any listed path changed, compare the "Current state" excerpts against the live code. On a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (a new page, a new spec, two docs paragraphs)
- **Depends on**: 001-bump-motion-14-12-0.md (the behaviour only exists on motion-dom 14.12.0)
- **Wave**: 2
- **Category**: tests
- **Planned at**: commit `82bf6e74`, 2026-11-12

## Why this matters

Motion 14.12.0 changed how a spring set with `visualDuration` (and `bounce`) behaves when it interrupts a running animation: it now starts with the interrupted animation's velocity. Before, it started from rest, so reversing mid-flight looked like hitting a wall. This applies to every such spring in every app, so it needs a page the maintainer can drive by hand, a browser test ported from upstream, and a docs note. Plan 001 already pins the change with unit tests; this plan adds the browser-level proof and the user-facing explanation.

## Current state

- After plan 001, `node_modules/motion-dom` is 14.12.0. Check with `node -p "require('./node_modules/motion-dom/package.json').version"`.
- **Upstream fixture and spec** (read with `git -C ~/Github/motion show v14.12.0:<path>`):
  - `dev/html/public/playwright/animate/animate-time-spring-velocity.html`: exposes `window.run(transition)`. For each of `opacity` (target 1, back to 0) and `x` (target 1000, back to 0) it creates a 100×100 element, starts `animate(element, { [name]: to }, transition)`, waits 100 ms, reads the value (`before`), starts the reverse animation, waits 32 ms, reads again (`after`), awaits the reverse, reads `final`, and removes the element.
  - `tests/animate/time-spring-velocity.spec.ts`: for the transitions `{ type: 'spring', stiffness: 200, damping: 20 }`, `{ type: 'spring', visualDuration: 0.5, bounce: 0.2 }` and `{ type: 'spring', visualDuration: 0.5, bounce: 0 }` it asserts `after > before` for both values (still moving towards the first target after the reversal) and `final === 0`.
- **Tester page conventions**:
  - Pages live in `src/routes/tests/<area>/<page>/+page.svelte` and import from `$lib`. Specs live in `e2e/<area>/<name>.spec.ts` and load `/tests/<area>/<page>?@isPlaywright=true`.
  - Pages a human reviews use `TesterPanel` (`src/routes/tests/layout/_parity/TesterPanel.svelte`), which hides itself under `?@isPlaywright=true`. Its step type is:
    ```ts
    export type TesterStep = {
        text: string
        expected: string
        action?: { label?: string; run: () => void }
    }
    ```
  - Copy the structure of `src/routes/tests/motion/tap-options/+page.svelte` (script with a `steps: TesterStep[]` array, `<svelte:head><title>`, a `<main>`, then `<TesterPanel eyebrow="…" title="…" {steps}>` with a `{#snippet checks()}` paragraph) and its spec `e2e/motion/tap-options.spec.ts`.
  - Every test page is linked from `src/routes/+page.svelte`. The "Motion" section starts at `:22`; the `tap-options` link is at `:329` and looks like `href={resolve('/tests/motion/tap-options') + searchParams}`. Add the new link directly after that list item, copying its markup.
- **Docs**:
  - `docs/src/routes/docs/use-spring/+page.svx:176`, the options table row:
    ```
    | `visualDuration`  | —       | Visual settle time (overrides `duration` when set); easier to coordinate with tweens |
    ```
  - `docs/src/routes/docs/gestures/+page.svx:137-141`, the section "### Interrupts carry momentum". Its last paragraph is: "There is nothing to configure — it applies to every `whileHover`/`whileTap` interrupt. See it (and feel it) on the [velocity interrupts example](/examples/velocity-interrupts)."
  - Docs are `.svx` (mdsvex). Do not use `$lib` in docs files.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Types | `pnpm check` | `0 ERRORS` |
| One e2e file | `PW_PORT=4262 pnpm exec playwright test --project=chromium e2e/motion/spring-velocity.spec.ts` | all pass |
| Docs | `pnpm build && pnpm --dir docs build && pnpm --dir docs check` | exit 0, 0 errors |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

## Scope

**In scope:**
- `src/routes/tests/motion/spring-velocity/+page.svelte` (create)
- `e2e/motion/spring-velocity.spec.ts` (create)
- `src/routes/+page.svelte` (one link, after the `tap-options` link)
- `docs/src/routes/docs/use-spring/+page.svx` (the `visualDuration` row plus one sentence)
- `docs/src/routes/docs/gestures/+page.svx` (one sentence in "Interrupts carry momentum")

**Out of scope:**
- Any file under `src/lib`. The behaviour arrives with the pin; if the page does not show it, that is a STOP.
- `docs/src/lib/examples/velocity-interrupts/**`. Do not retune the existing example.
- Any other e2e spec.

## Git workflow

- Lane branch `lane/14120-spring`, cut from `feat/motion-14.12.0` after plan 001 is merged.
- Conventional commits, for example `test(motion): spring velocity through an interrupt (page + e2e)` and `docs: visualDuration springs carry velocity`.
- Do not push.

## Steps

### Step 1: The tester page

Create `src/routes/tests/motion/spring-velocity/+page.svelte`.

1. **Automation hook.** In `onMount`, define `window.run = async (transition) => { … }` as a port of upstream's `window.run`, using `animate` from `$lib` on plain `document.createElement('div')` elements appended to a `data-testid="stage"` container. Keep upstream's timings (100 ms, then 32 ms) and the returned shape `{ opacity: { before, after, final }, x: { before, after, final } }`. Delete `window.run` on unmount.
2. **Human controls.** Three rows, one per transition, labelled "Physics (stiffness 200, damping 20)", "visualDuration 0.5, bounce 0.2" and "duration 0.8". Each row has a 60×60 box on a 600 px track (its `x` animated with `animate` from `$lib`), a "Go right" button (`data-testid="go-<id>"`, animates `x` to 500) and a "Reverse" button (`data-testid="reverse-<id>"`, animates `x` to 0), with ids `physics`, `visual`, `duration`.
3. **Live verdict.** After each "Reverse" click, sample the box's `x` on the next two animation frames and show, per row, "kept moving right" or "turned back at once" (`data-testid="verdict-<id>"`). Expected: `physics` and `visual` say "kept moving right"; `duration` says "turned back at once".
4. **`TesterPanel`** with `eyebrow="time-spring-velocity.spec.ts"`, a title "Springs carry velocity through an interrupt", and steps:
   - "Click 'Go right' on the visualDuration row, then 'Reverse' while it is still moving fast." Expected: "The box keeps drifting right for a moment, then curves back. Verdict: kept moving right."
   - "Do the same on the physics row." Expected: "Same feel as the visualDuration row."
   - "Do the same on the duration row." Expected: "The box turns back at once: a duration spring starts from rest so it ends exactly on time. Verdict: turned back at once."
   In the `checks` snippet, state that before Motion 14.12 the visualDuration row behaved like the duration row.

**Verify**: `pnpm check` → 0 errors.

### Step 2: The e2e spec

Create `e2e/motion/spring-velocity.spec.ts`. Its header comment cites upstream `tests/animate/time-spring-velocity.spec.ts` at v14.12.0. Load `/tests/motion/spring-velocity?@isPlaywright=true`, wait for `window.run` to exist (`page.waitForFunction`), and for each of upstream's three transitions call `page.evaluate((t) => window.run(t), transition)`. Assert, as upstream does: `opacity.after > opacity.before`, `x.after > x.before`, `opacity.final === 0`, `x.final === 0`.

Add one more test for the guard: with `{ type: 'spring', duration: 0.8 }`, `x.after` is less than `x.before`.

**Verify**: `PW_PORT=4262 pnpm exec playwright test --project=chromium e2e/motion/spring-velocity.spec.ts` → 4 tests PASS. If the two `visualDuration` cases fail while the physics case passes, check `node_modules/motion-dom` is 14.12.0; if it is, STOP.

### Step 3: Link the page

In `src/routes/+page.svelte`, add a list item directly after the `tap-options` one (`:329`), with `href={resolve('/tests/motion/spring-velocity') + searchParams}` and the text "Spring velocity through an interrupt (Motion 14.12)".

**Verify**: `pnpm check` → 0 errors, and `grep -n "spring-velocity" src/routes/+page.svelte` → one match.

### Step 4: Docs

1. `docs/src/routes/docs/use-spring/+page.svx`: extend the `visualDuration` row's description with "; carries the velocity of the animation it interrupts". Below the options table add one short paragraph: a spring set with `duration` starts from rest so it ends exactly at its duration, while springs set with `visualDuration` or with `stiffness`/`damping` inherit velocity (Motion 14.12).
2. `docs/src/routes/docs/gestures/+page.svx`, section "Interrupts carry momentum": before the final paragraph, add one sentence saying this holds for `stiffness`/`damping` springs and, from Motion 14.12, for `visualDuration`/`bounce` springs; a `duration` spring starts from rest.

**Verify**: `pnpm build && pnpm --dir docs build && pnpm --dir docs check` → exit 0, 0 errors. Revert any change to `docs/static/r/animated-tabs.json`.

### Step 5: Gate

Run `pnpm check`, the new spec once more, then `trunk fmt` and `trunk check` on the changed files.

**Verify**: 0 errors; 4 e2e tests pass; trunk reports no new issues.

## Test plan

- No red-first test here: this plan adds no runtime change. The red-first proof is plan 001's `src/lib/utils/springVelocity.spec.ts`.
- New e2e: `e2e/motion/spring-velocity.spec.ts`, 4 tests (three ported, one duration guard), modelled on `e2e/motion/tap-options.spec.ts` for file layout.

## Done criteria

- [ ] `PW_PORT=4262 pnpm exec playwright test --project=chromium e2e/motion/spring-velocity.spec.ts` → 4 passed
- [ ] `pnpm check` → 0 errors
- [ ] `pnpm --dir docs build && pnpm --dir docs check` → exit 0
- [ ] `git diff --name-only <lane base>..HEAD` lists only in-scope files
- [ ] The page has `TesterPanel` steps with an `expected` for each row and live verdicts

## STOP conditions

- `node_modules/motion-dom` is not 14.12.0 (plan 001 has not landed in your base).
- The `visualDuration` cases do not carry velocity on 14.12.0.
- Making the page work appears to need a change under `src/lib`.

## Maintenance notes

- Sign-off needs an upstream twin with the same three rows and buttons (React + Motion 14.12.0). The dispatcher builds it; see the batch README.
- The 100 ms and 32 ms waits are upstream's. On a loaded machine the 32 ms sample can land late; re-run alone before treating a failure as real.
