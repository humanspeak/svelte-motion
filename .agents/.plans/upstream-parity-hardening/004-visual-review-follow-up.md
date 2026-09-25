# Plan 004 visual review follow-up

Planned at: 12a7bf5a in /Users/jasonkummerl/Github/svelte-motion-upstream-004, branch fix/upstream-drag-origin-resize. Clean baseline verified. Parent 004 implementation is DONE; user visual approval remains pending. No plan 005 work.

## Why
The current page has weak hierarchy and unstyled controls. Make the intended click sequence, expected behavior, and measured results easy to understand.

## Scope
- src/routes/tests/drag/element-ref-resize/+page.svelte
- A colocated ResizeMetrics.svelte component if needed.
- e2e/drag/element-ref-resize.spec.ts
- This plan and reviewer-owned README evidence (copy only when reviewer supplies it).
No library code, dependency changes, global CSS, public API or other pages.

## Implementation
1. Create one responsive page wrapper, readable headings and numbered blue/orange sections, clear buttons/focus states, concise ordered test instructions and expected-result callouts. Blue resting-origin test comes first. Preserve the 400/200 px container fixture, 80 px cards, blue authored left/top 40 px, border geometry, all existing test IDs and existing resize-btn text. Keep stages fixed in geometry with local horizontal scrolling on narrow screens; no document overflow.
2. Blue instructions: Reset, Shrink, Grow without dragging; expect inner-left inset 40 px and change from reset 0 px. Then drag and resize; nonzero offset remaps. Make intentional dragged movement clearly different from unexpected untouched drift.
3. Orange instructions: drag/release then resize while moving; expect card inside resized bounds after settling. Expose existing ?slow mode with normal/slow navigation, preserve query handling and existing transition physics. Add an orange Reset control that restores size/card.
4. Add readable live metrics: measured content width, card inner-left inset, change from reset, overflow/bounds as appropriate. Label units and tolerance; transient overflow while dragging/settling is not a final failure. Metrics must read actual DOM geometry, be border-aware, update during animation, and reset baselines when cards remount. Instrumentation is observational only: do not write geometry/MotionValues or feed reactive measurements to page drag props. Prefer an isolated child component with its own throttled state and cleanup. Keep blue resizeIdle DOM-only; no reactive width refactor that masks ResizeObserver behavior.
5. Preserve all 5 existing e2e tests and tolerances. Add focused tests for displayed metrics matching geometry, button-driven shrink/grow/reset, orange reset, and narrow layout if practical. Do not weaken assertions. Avoid unnecessary helper abstractions or tests that mirror implementation.

## Verification and done criteria
- Run scoped trunk fmt, trunk check, git diff --check.
- Run root check (known baseline 0 errors/35 warnings), production vite build, targeted resize Chromium spec including existing tests. Use project pinned toolchain: npm exec --yes --package=node@24.18.0 --package=pnpm@11.24.0 -- pnpm ...
- Existing package declaration issue is plan 006; no need repeat full package/docs/full unit release gates for presentation-only scope.
- Reviewer uses T3 collaborative browser for desktop/narrow visual inspection and controls. Do not run standalone browser automation for visual inspection. Existing project Playwright test runner is allowed for the targeted spec.
- Confirm no new errors, no source outside scope, all old regression checks pass, clear metrics and controls render.
- Commit source in the existing isolated 004 worktree with normal hooks; do not merge/push/publish. Root owns persistent preview port 5204; don't kill it or unrelated servers. Build output may be rebuilt, tell reviewer when ready.
- Evidence and final plan status must be committed in primary checkout and isolated worktree at handoff, as explicitly requested by user.

## STOP conditions
Stop/report if unrelated work appears, library change/new dependency is needed, test instrumentation affects drag options, or repeated gate failure cannot be resolved within scope. Explain any justified small reconciliation before proceeding.

## Status
DONE — implementation independently approved; user visual approval of plan 004 remains pending.

## Review evidence

- Source commit: 5291c8b5 (`test(drag): guide resize review with live metrics`). Normal hooks passed with the pinned Node 24.18.0 / pnpm 11.24.0 toolchain; an initial unpinned attempt stopped at the local pnpm binary identity check without creating a commit.

- Scope: existing resize page, isolated read-only ResizeMetrics component, existing resize browser spec. No runtime library, dependency, global style, or other page changes.
- Guided blue/orange sections retain fixture geometry and DOM-only blue resizing. Both cases expose reset controls; orange slow reset remounts the entire fixture to restore its starting geometry immediately.
- Live DOM readings report inner width, left inset, horizontal movement from reset, maximum edge overflow, and a bounds label with 0.5 px tolerance. The child samples at most every 80 ms, updates changed values only, and cancels its animation frame on teardown. Its state cannot update parent drag props.
- Independent reviewer verification: eight targeted Chromium tests passed (12.7 seconds), including all five original regressions; root check passed with zero errors and 35 existing warnings; production Vite build passed; Trunk reported no new issues and one existing issue; diff check passed. Logs: isolated worktree .temp/plan-004/reviewer-ui-*.log.
- Desktop T3 review confirmed blue shrink produces width 200, inset 40, reset delta 0; orange slow-mode reset restores inner width 396, inset 158, reset delta 0, overflow 0. Numbered steps, focus styles and explanatory border copy are visible.
- Native T3 viewport resizing timed out twice. Responsive visual inspection instead used the actual page in a temporary 375 px same-origin iframe in T3; the project Playwright test additionally verified a real 375 px viewport, local stage scrolling and stable relative measurements. The temporary browser DOM was restored afterward.
- Two narrowly documented Svelte accessibility warning exceptions preserve keyboard focus for named horizontal scroll regions. No warnings were hidden elsewhere. Existing full runtime/release gates from parent 004 remain recorded; this presentation follow-up used focused verification.
- User review URL remains http://localhost:5204/tests/drag/element-ref-resize. Reviewer-owned production preview session 89261 remains running. No plan 005 execution, push, merge, publication, or deployment.
