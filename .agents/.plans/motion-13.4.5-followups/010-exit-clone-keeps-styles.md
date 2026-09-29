# Plan 010: Exit clones keep the look of the element they replace

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Report results in your final message; the
> reviewer maintains the batch README.
>
> Revision 2026-09-29 (maintainer review of f34fd411, confirmed by guard probe): two gaps. Add **Step 5**.
> **(a) Stale snapshot after a structural change.** Remove Card A, wait for its exit to finish (live Card B becomes
> `:first-child` → blue rgb(43,89,195), 24px), then remove B → B's clone shows the REGISTRATION snapshot (tomato, 12px).
> Snapshots must also refresh when a child's cascade can change without an attribute change: at minimum re-snapshot
> every still-connected registered child after any registration, unregistration, placeholder removal and clone
> removal (exit complete) in the same presence context, and on childList mutations of each child's parent
> (MutationObserver, coalesced to one pass per frame). Keep it off the per-frame path; report cost.
> **(b) Re-entry mid-exit pops.** Hide the solo card, show it again at ~500ms: the re-added element renders at
> opacity 1 immediately while the old clone keeps fading (0.53→0.03). Upstream reverses the exit on the same
> element (the exiting child becomes present again and animates back to its target from its current values).
> Match that: when a key re-registers while its clone is mid-exit, the entering element must start from the
> clone's current animated values (opacity etc.) and animate to its target; the clone is removed at that moment
> (no overlap). First check whether this already fails at 61a58d35 (pre-010) and say so. Cite upstream
> (`AnimatePresence/index.tsx` + `PresenceChild`) for the re-entry behavior.
> Fixture: give the solo card and the list cards `initial={{ opacity: 0 }} animate={{ opacity: 1 }}` so enter is
> visible, and add TesterPanel steps for (a) "remove A, then B — B fades out blue" and (b) "hide, then show again
> mid-fade — it fades back in from where it was".
> Red first for both (e2e: B clone look equals live B look at removal; re-entry opacity is continuous — no
> frame-to-frame jump > 0.15 on the visible card, and never two visible solo cards at once). Paint-level checks
> via screencast region pixels. Scope additions: `src/lib/components/AnimatePresence.svelte`,
> `src/lib/components/PresenceChild.svelte`, `src/lib/html/_MotionContainer.svelte` (presence hunks), the repro page
> (fixture props + tester text), `e2e/animate-presence/*.spec.ts`. STOP if (b) requires changing how enter
> animations are scheduled for all elements, or if existing re-entry specs (key-change, owned-child) regress.
>
> **Drift check (run first)**: `git diff --stat 6f3612ab..HEAD -- src/lib/utils/presence.ts src/lib/utils/presence.spec.ts src/lib/html/_MotionContainer.svelte src/routes/tests/animate-presence e2e/animate-presence`
> Any change → compare with the excerpts; on mismatch STOP.

## Status

- **Priority**: P1 (before the Motion 13.4.5 PR — maintainer, 2026-09-29)
- **Effort**: M
- **Risk**: HIGH (every AnimatePresence exit uses the clone; `e2e/animate-presence` is the regression net)
- **Depends on**: 009 (DONE)
- **Category**: bug (upstream parity)
- **Planned at**: commit `6f3612ab`, 2026-09-29

## Why this matters

svelte-motion animates exits on a **clone** of the leaving element, because Svelte
removes the real node before we can animate it. Upstream (React) keeps the *real*
element in place until the exit finishes, so it looks exactly as before throughout.
Our clone doesn't, in two independent ways (both confirmed on the repro page):

1. **Frozen styles are empty.** For an element Svelte already detached (keyed `{#each}`
   and `{#if}` both detach before `unregisterChild`), the freeze loop copies from
   `child.lastComputedStyle` — a *live* `CSSStyleDeclaration` that reads `''`/length 0
   after detach — so nothing is frozen (clones carried only ~14 inline props, all ones
   `unregisterChild` sets itself). `originalDisplay` also reads `''`.
2. **The clone moves to a different structural spot.** It's appended to
   `positioningParent` (outside AnimatePresence's `display: contents` container), so
   selectors that depend on position re-match differently.

Measured on `/tests/animate-presence/clone-parent-styles` (headless Chromium):

| Variant | Live card | Exit clone, every frame |
|---|---|---|
| `{#each}` Card A (`.cards .card:first-child`, blue) | bg rgb(43,89,195), radius 24px | bg rgb(255,99,71), radius 12px — wrong from frame 1 |
| `{#each}` Card B (control, `.cards .card`) | tomato, 12px | tomato, 12px — kept |
| `{#if}` solo (`.solo .card:first-child`) | tomato, 12px, white 600 text | transparent, 0px, dark 400 text — unstyled |

Also observed: `.animate-presence-container > .card` styles are lost on the clone, and
`.cards > .card` (never matched the live card) *does* match the clone — styles appear
that the element never had.

## Current state

`src/lib/utils/presence.ts` (at `6f3612ab`):

- `:30-45` child record — `lastComputedStyle: CSSStyleDeclaration` (live), and 009's
  `lastLayoutStyle` string snapshot (`snapshotLayoutStyle`, `:74-112`) — **the pattern to
  follow**.
- `:816` registration sets `lastComputedStyle: initialStyle`; `:832-841` `updateChildState`
  refreshes it (called from `_MotionContainer.svelte:727-728` every frame *while the element
  animates*, and `:845-852`).
- `:905-911` in `unregisterChild`:
  ```ts
  const computedStyle = elementIsLive ? getComputedStyle(child.element) : child.lastComputedStyle
  const computed = elementIsLive ? snapshotLayoutStyle(computedStyle) : child.lastLayoutStyle
  ```
- `:976-991` clone + freeze:
  ```ts
  const clone = child.element.cloneNode(true) as HTMLElement
  if (clone.id) clone.removeAttribute('id')
  try {
      for (let i = 0; i < computedStyle.length; i += 1) {
          const prop = computedStyle[i]
          if (/transform/i.test(prop)) continue
          const value = computedStyle.getPropertyValue(prop)
          const priority = computedStyle.getPropertyPriority(prop)
          if (value) clone.style.setProperty(prop, value, priority)
      }
      resetTransforms(clone)
  } catch { /* Ignore */ }
  ```
- `:1036-1037` `parent = positioningParent`; `const originalDisplay = computedStyle.display`.
- `:1040-1086` positioning (absolute, top/left relative to `parentRect` + scroll), margin 0,
  box-sizing, z-index above siblings.
- `:1097` `parent.appendChild(clone)`.
- Placeholder insertion (009) uses `resolvePlaceholderAnchor(child)` / `insertionParent` to land
  in the element's real DOM slot — reusable for the clone.

Existing guards: `e2e/animate-presence/clone-fidelity.spec.ts` (+ page), `grid-exit`, `modes`,
`scroll-stress`, `layout-button`, `owned-child` etc.; `src/lib/utils/presence.spec.ts`.

## Design (implement this)

**D1 — Structural placement like upstream.** Insert the clone into the element's original DOM
slot — `insertionParent`, before the resolved anchor (the same slot 009's placeholder uses; the
clone goes immediately before the placeholder when there is one) — instead of appending to
`positioningParent`. Keep `position: absolute`; compute `top/left` against the clone's actual
containing block (nearest positioned ancestor — which is what `positioningParent` already
resolves to) so the visual position is unchanged. Result: ancestor, child-combinator and
structural selectors (`:first-child`, `> .card`) match the clone as they matched the element.
If a structural selector would now be thrown off by the placeholder sitting next to the clone,
place the clone where it restores the element's original sibling index (verify on the repro page).

**D2 — Freeze from a string snapshot, not a live declaration.** Replace `lastComputedStyle`
reads after detach with a `Record<string, {value, priority}>` (or equivalent) captured while
connected. Capture at registration and when the element's styling can change *without* a
layout/animation signal — e.g. a `MutationObserver` on the element's `class`/`style` attributes
(event-driven), plus the existing settle frame in `updateChildState`. **Do not serialize all
computed properties on every animation frame** — measure: the per-frame capture loop in
`_MotionContainer.svelte:~712-737` already calls `updateChildState` each animating frame; if the
snapshot runs there, show its cost (ms/frame on the repro page) and keep it < 0.5ms or throttle it
to the settle frame. `originalDisplay` comes from the snapshot too.

With D1 in place, D2 still matters for styles that depend on state that changed at removal time
(e.g. a parent class toggled in the same update); keep both.

## Commands you will need

| Purpose       | Command | Expected |
| ------------- | ------- | -------- |
| Unit          | `npx vitest run src/lib/utils/presence.spec.ts`, then `npx vitest run` | pass |
| Typecheck     | `pnpm check` (via shim; build first) | 0 errors |
| Presence e2e  | `npx playwright test -c <private config> e2e/animate-presence --project=chromium` | pass |
| Full e2e      | `npx playwright test -c <private config> --project=chromium` | pass (known flakes: animate-presence/modes.spec.ts:114, motion/ai-glow-border frame budget — verify in isolation) |
| Lint/format   | `trunk check` / `trunk fmt` | no new issues |

## Scope

**In scope**: `src/lib/utils/presence.ts`, `src/lib/utils/presence.spec.ts`,
`src/lib/html/_MotionContainer.svelte` (only if the snapshot trigger must be wired there),
`e2e/animate-presence/clone-parent-styles.spec.ts` (create),
`src/routes/tests/animate-presence/clone-parent-styles/+page.svelte` (status text only),
`.changeset/exit-clone-keeps-styles.md`.

**Out of scope**: placeholder logic from 009 (reuse, don't change behavior), popLayout snapshot
math, LayoutGroup/projection code.

## Steps

### Step 1: Red

`e2e/animate-presence/clone-parent-styles.spec.ts` on `/tests/animate-presence/clone-parent-styles?@isPlaywright=true`:
for Card A, Card B, and the `{#if}` solo card — record the live element's computed
`background-color`, `border-radius`, `color`, `font-weight` before removal; then every rAF during
the exit, the `[data-clone="true"]` clone's values must equal them (opacity aside). Plus: the clone
must not gain `.cards > .card` styling (add such a rule to the page only if the page doesn't already
exercise it — status text/fixture edits allowed for that). Paint-level too: `elementFromPoint` at the
clone center is the clone (or descendant) while its opacity > 0.1.
Unit (`presence.spec.ts`): a detached child's clone receives frozen inline values from the snapshot
(e.g. `background-color`), not `''`.

**Verify**: Card A and solo cases FAIL with the numbers in the table above; Card B passes; unit fails.

### Step 2: D2 snapshot · Step 3: D1 placement

Implement, running the Step 1 specs after each. Then `e2e/animate-presence` (all specs) and
`clone-fidelity` specifically.

### Step 4: Gate

Status text on the repro page → "Passes on this build." Changeset (patch): "AnimatePresence exit
clones now keep the exact look of the element they replace — including styles from ancestor and
structural selectors — for the whole exit, even after Svelte has detached the element."
Then `trunk fmt`, `trunk check`, `pnpm check`, `npx vitest run`, `pnpm build`, full e2e.
Also capture painted frames (CDP screencast) of the repro page during Card A's exit and report
that every frame shows the blue card fading (no tomato frame).

## Done criteria

- [ ] Step 1 specs red before, green after (3/3)
- [ ] no read of `lastComputedStyle` (or any stored live declaration) after detach — grep evidence
- [ ] `e2e/animate-presence` all pass; full e2e passes (known flakes verified in isolation)
- [ ] snapshot cost reported; no full-style serialization per animation frame
- [ ] unit, check, build pass; changeset exists

## STOP conditions

- D1 changes any existing presence spec's positions (clone visually moves) and the cause isn't an
  obvious offset bug.
- A structural selector can't be preserved without also moving the placeholder — report options.
- Snapshot cost can't be kept off the per-frame path.
- Any `e2e/animate-presence` spec regresses.

## Maintenance notes

- Never keep a live `CSSStyleDeclaration` across a detach; snapshot strings.
- The clone lives where the element lived; code that queries `[data-clone]` under
  `positioningParent` must look under the original parent now.
