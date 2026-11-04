# Plan 004: Preserve resting drag origins when ref constraints resize

> Executor: follow the steps in order, record red and green evidence, and update this batch's README status when finished unless a reviewer owns the index. Do not claim DONE from unit tests alone when a browser or package gate is listed.
>
> Drift check first: run `git diff --stat 6f0085ef..HEAD -- src/lib/utils/drag.ts src/lib/utils/drag.spec.ts src/routes/tests/drag/element-ref-resize/+page.svelte e2e/drag/element-ref-resize.spec.ts .changeset/drag-origin-resize.md`. Compare the excerpts below against live code. Expected predecessor changes are described below; unrelated drift requires reconciliation before edits.

## Status

- Priority: P1
- Effort: S
- Fix risk: MED
- Confidence: HIGH
- Depends on: 001-docs-verification.md for the shared verification baseline
- Category: bug
- Audit finding: 02
- Planned at: commit 6f0085ef, 2026-09-24
- State: DONE — f1393887; independently reviewed; user visual checkpoint pending

## Why this matters

A responsive container can move an untouched draggable away from its authored position. The existing centered demo masks the defect because symmetric bounds preserve zero. Adapt upstream's origin-preservation fix while retaining the existing nonzero drag and inertia resizing behavior.

## Current state and conventions

src/lib/utils/drag.ts:567:
~~~ts
const progressX = calcConstraintProgress(applied.x, oldBounds.minX, oldBounds.maxX)
const progressY = calcConstraintProgress(applied.y, oldBounds.minY, oldBounds.maxY)
~~~
Later nextX/nextY remap every enabled axis, even applied=0. With container [0,400], card [40,120], x=0, old bounds [-40,280] yield progress .125. Shrinking to [0,200] yields [-40,80], so current code writes x=-25. A read-only probe invoking actual attachDrag and its ResizeObserver reproduced translateX(-25px).

updateOptions already synchronizes freshly measured constraintsBase to applied when idle. Preserve that earlier fix. The current route uses display:grid;place-items:center, and its two browser tests exercise resizing after a drag.

Unit convention: src/lib/utils/drag.spec.ts imports attachDrag, uses MotionValues and registerStubNode through motion-dom.visualElementStore, and has controlled pointer/frame helpers. Add ResizeObserver capture using vi.stubGlobal and restore it during cleanup.

Upstream reference: motiondivision/motion commit 78fca61b7, packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts:645:
~~~ts
if (!shouldDrag(axis, drag, null) || !axisValue.get()) return
~~~
Reuse the reasoning, adapting to Svelte's applied offset and authored-transform ownership. No private React import.

This is @humanspeak/svelte-motion, a Svelte 5 library using motion/motion-dom as its animation engine. Keep upstream public API reuse; do not import private React modules or introduce another animation engine. Match existing TypeScript, single quotes, four-space indentation, Svelte runes, and Google-style JSDoc for public API additions. Trunk is the formatting/lint authority.

## Commands you will need

Run from the repository root unless a command specifies another directory. Use Node 24 and pnpm 11.24.0 from package.json. Check with `node --version` and `pnpm --version`; if the installed pnpm differs, the exact fallback is `npm exec --yes --package=pnpm@11.24.0 -- pnpm <arguments>`. Do not update the lockfile to accommodate a local tool mismatch.

| Purpose | Command | Expected |
| --- | --- | --- |
| Frozen setup, if needed in an isolated checkout | pnpm install --frozen-lockfile | Exit 0, no manifest/lockfile drift |
| Root types | pnpm check | Exit 0, no errors |
| Build package/declarations | pnpm package | Exit 0; inspect declaration diagnostics too |
| Docs types after package build | pnpm --dir docs check | Exit 0 after plan 001 |
| Complete root unit suite | pnpm test:only | All pass |
| Format changed source/config files | trunk fmt <changed in-scope files> | Only intended formatting changes |
| Lint | trunk check | Exit 0 |
| Patch integrity | git diff --check | Exit 0 |
| Drag units | pnpm test:only src/lib/utils/drag.spec.ts src/lib/utils/dragMath.spec.ts src/lib/utils/dragInertia.spec.ts | All pass |
| Resize and composition browser regressions | pnpm exec playwright test e2e/drag/element-ref-resize.spec.ts e2e/drag/while-drag-transforms.spec.ts e2e/drag/axis-handoff.spec.ts --project=chromium | All pass |

Fresh root prerequisite: run `pnpm package` before the root typecheck so consumer fixtures resolve local declarations; complete SvelteKit sync before units. Pin Node 24.18.0 and pnpm 11.24.0 with npm exec if needed.

Fresh-checkout prerequisite discovered during execution: docs types import ignored generated demo loaders, registry data, and GitHub stats. Run the existing `pnpm --dir docs build` once after `pnpm package` and before the first docs typecheck in a fresh execution checkout. This reuses existing generators; never copy caches or environment files from another worktree. A successful build does not replace `pnpm --dir docs check`. Normal docs build does not deploy or enable the IndexNow submission mode.

Root Playwright uses port 4198 and builds the root app/package before starting preview. Do not terminate a user's running server. Run browser gates in an isolated checkout with that port available, or deliberately reconfigure an isolated verification instance; do not silently reuse a stale preview. PW_REUSE_SERVER=1 is allowed only after proving the running server serves the current checkout. If a full e2e run fails, open each affected route in the in-app browser and review the behavior with the user before changing assertions or code.

## Scope

Only modify these paths (plus this plan's README status):
- src/lib/utils/drag.ts
- src/lib/utils/drag.spec.ts
- src/routes/tests/drag/element-ref-resize/+page.svelte
- e2e/drag/element-ref-resize.spec.ts
- .changeset/drag-origin-resize.md

Out of scope: observer target replacement (plan 005), inertia engine rewrite, coordinate-transform contracts, axis-handoff semantics, root demo navigation, and new API surface. Extend the existing resize route; do not duplicate it.

## Git workflow

Use a fresh branch named fix/upstream-drag-origin-resize in an isolated checkout from freshly fetched origin/main. The audited baseline includes reviewed commits 31657b14, 207dd870, and 6f0085ef; before execution verify that main already contains them or integrate those reviewed changes into the isolated branch. Do not cherry-pick commits already present; do not reset, pop stashes, or overwrite the user's working tree. Apply required predecessor plans before starting. Record the actual execution base and any reconciliation in the index.

Use a conventional commit such as "fix(drag): preserve resting origin on constraint resize". Do not push, merge, publish, or open a PR as part of this plan unless separately instructed.

## Steps

### Step 1: Reproduce idle drift through attachDrag
Add a describe block named 'resting constraint resize'. Stub ResizeObserver to capture its callback, supply the exact asymmetric rects above, attach x drag, then shrink only the container before invoking the observer. Assert x remains zero using the actual writer (MotionValue/latestValues or rendered transform), not the internal progress helper. Include a zero-x/nonzero-y case and a nonzero-x characterization. Restore globals and detach observers after each test.
**Verify:** pnpm test:only src/lib/utils/drag.spec.ts -t 'resting constraint resize' fails with the zero position shifted (approximately -25 in the fixture).

### Step 2: Preserve the origin per axis
In scalePositionWithinConstraints retain remeasurement, constraints/base updates, and necessary inertia stopping. Skip remapping for axes whose effective drag offset is zero; independently remap active nonzero axes. Do not return before refreshing constraints, and do not skip y merely because x=0. Determine effective origin from the existing applied/bound/owned-axis model, not an arbitrary computed CSS transform.
**Verify:** the new regression passes and the drag unit command above remains green. Add coverage for authored baseline x/rotation/scale and bound MotionValues; assert the composed transform is retained, not replaced with translate-only output.

### Step 3: Expose the behavior in the existing demo and browser regression
Add a separate asymmetric idle case to the existing element-ref-resize page while preserving current centered-card selectors. Give the new card a stable authored left offset and a clear reset. In Playwright resize the container through DOM/CSS independently of reactive drag option updates, then compare the card's offset relative to the container before/after with subpixel tolerance. Poll for observer delivery; avoid long fixed sleeps. Exercise shrink and grow. Keep the two existing mid-inertia checks.
**Verify:** pnpm exec playwright test e2e/drag/element-ref-resize.spec.ts --project=chromium passes all old/new cases. Visual review URL: http://localhost:4198/tests/drag/element-ref-resize. Untouched card stays in its authored location; a dragged card still remaps with resized bounds.

### Step 4: Complete the compatibility gates
Run the broader drag browser command above, pnpm check, pnpm package, pnpm --dir docs check, pnpm test:only, trunk fmt on changed source, trunk check, and git diff --check. Add a patch changeset explaining responsive resting-position preservation.
**Verify:** all exit 0; no regressions in active-axis handoff or transform composition.

## Test plan

Anchor the bug in real attachDrag with a captured observer. Cover independent axes, untouched asymmetric geometry, already-dragged offsets, authored transforms, bound values, resize during settling, and active-pointer preservation. The browser test must not accidentally mask the defect by first calling updateOptions through a reactive render.

## Done criteria

- [x] The asymmetric idle fixture remains at x=0 through shrink/grow.
- [x] Nonzero dragged positions still remap, and mid-inertia bounds tests pass.
- [x] The existing visual page includes the new case and every added case has browser coverage.
- [x] Final verification commands from the last step pass, with red/green output summarized in the handoff.
- [x] No accidental source, manifest, lockfile, or generated registry changes outside scope: inspect git diff --name-only and git status --short.
- [x] Record commit, commands/results, and any limitations in the batch README; only then set this plan DONE.

## STOP conditions

- The baseline or source contract does not match these excerpts after accounting for the named predecessor plans.
- The red test passes before the fix, fails for an unrelated setup error, or a gate fails twice after a reasonable fix attempt.
- A fix requires files outside scope, a new dependency, a public API redesign, or a private upstream import.
- A zero applied offset cannot be distinguished from an externally authored/bound axis without redesigning drag ownership. Report the ambiguity with a failing case; do not blindly paste upstream's axis-value check.

## Execution reconciliation

Fresh origin/main remains c8fbd7a8 on 2026-09-25; no in-scope drift from the audited baseline or cumulative approved plan 003. Integrate the eight approved commits in origin/main..0f447abe, then snapshot the updated plan 003 approval, this plan, and README into the isolated branch. Preserve all primary-worktree changes and earlier servers (5202, 5203). Use isolated browser verification ports, and start the persistent user-facing production preview only after build/sync gates settle. Development-server SSR controls may be clicked before hydration; production preview is the browser gate. The reviewer will own the persistent preview on port 5204.

## Maintenance notes

Resize logic must refresh measurement even when no position write is necessary. Keep drag's authored transform composition and per-axis ownership separate from resize progress arithmetic. Plan 005 edits nearby observer lifecycle code and must land afterward.


## Authorized release update during execution

The user confirmed Motion 13.4.4 is published and requested the upgrade while 004 was active. npm metadata independently confirms motion 13.4.4 -> framer-motion ^13.4.4 -> motion-dom ^13.4.4; motion-dom 13.4.4 is published. Before final 004 gates, make a separate dependency commit updating root package.json motion and motion-dom ranges to ^13.4.4, scoped pnpm-lock.yaml resolutions, and .changeset/motion-13-4-4.md. This is an explicitly authorized separate deliverable, not an expansion of drag runtime scope. Re-run the focused red proof and final gates against the upgraded dependencies. Avoid unrelated dependency updates or library release versioning.

The user also explicitly authorized committing the plan files and existing .competitive-intel/state.json in the primary chore/motion-upstream-refresh checkout. Plan snapshot 7b91916d now tracks all nine files there; future plan changes must appear as tracked diffs and be committed there as well as in the execution branch. Keep the intel snapshot content unchanged and carry its separate commit into the cumulative execution branch.

## Review outcome

User visual checkpoint complete: the user approved the guided page (5291c8b5) and authorized005. Earlier pending-checkpoint language below is historical.

Implementation f1393887f4f9d233e2519df516ccd591cee58a6d approved after independent review. Separate dependency commit 1ecdd5e1 upgrades motion and motion-dom to 13.4.4. Final gates pass: 923 root units, 50 focused drag tests, 25 targeted Chromium tests, root check, package/publint, docs build/check, formatting, Trunk (no new issues), and diff integrity. Known Reorder declaration diagnostics remain for 006. The batch README records red evidence, fixture reconciliations, primary tracking/intel commits, and verification limits. Production preview: http://localhost:5204/tests/drag/element-ref-resize. Wait for user visual approval before 005.
