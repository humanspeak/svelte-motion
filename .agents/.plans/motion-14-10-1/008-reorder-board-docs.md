# Plan 008: Document `Reorder.Board` and add a kanban example

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report; do not improvise. Do not edit the batch `README.md`, because the dispatcher maintains it.
>
> **Drift check (run first)**: `git diff --stat f93a1d92..HEAD -- docs/src/routes/docs/reorder docs/src/routes/docs/reorder-board docs/src/routes/examples/reorder-board docs/src/lib/examples/reorder-board docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts docs/src/lib/compare-data.ts`
> Expected changes: plan 003 (the Keyboard section of `docs/src/routes/docs/reorder/+page.svx`), plan 002 (one `examplesIndex.ts` entry for tap-options, a subsection of `docs/gestures/+page.svx`, and a `docs/src/routes/examples/tap-options` route) and plan 005 (the drag docs and the vanilla-drag example). Nothing else. On a surprise, STOP.
>
> Revision 2026-11-06 (guard pre-flight): updated the drift note to what plans 002, 003 and 005 actually changed (002 added no `docsNav.ts` entry). Plan 006 merged as `5011a60a`, and `Reorder.Board` is exported from `Reorder` in both `src/lib/reorder.ts` and `src/lib/m.ts`.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (docs only)
- **Depends on**: 006 (the `Reorder.Board` API must exist for the demo to build). It can run in parallel with 007. The demo still works pointer-only until 007 merges, and the docs text describes the keyboard behaviour that 007 lands.
- **Wave**: 3
- **Category**: docs
- **Planned at**: commit `f93a1d92`, 2026-11-06

## Why this matters

`Reorder.Board` is a new public component (plan 006). The repo's feature checklist (`CLAUDE.md`, "New feature checklist") requires public docs pages under `docs/src/routes/docs/<feature>/`, an example page under `docs/src/routes/examples/<feature>/`, and reusable demo components under `docs/src/lib/examples/<feature>/`. Upstream documents Board only in JSDoc (`Board.tsx:442-473`). Our docs can be the clearer reference.

## Current state

- **API** (from plan 006; read `src/lib/components/Reorder/Board.svelte` and `src/lib/components/Reorder/types.ts` `ReorderBoardProps` to confirm):
  - `<Reorder.Board canMove={(value, from, to) => boolean}>` wraps any number of `Reorder.Group`s and renders no element.
  - When a dragged item's centre crosses into another group, the group it left calls `onReorder(without, moved)` and the group it joins calls `onReorder(with, moved)`. The drag continues in the new group.
  - Values must be unique across groups.
  - Inside a Board, items drag on both axes and auto-scroll the containers around the groups.
  - Groups nested inside each other's items never exchange items.
  - `canMove` runs before either `onReorder`, every frame while the item is over a refused group, so keep it fast and side-effect free. Escape ignores it.
  - Keyboard (plan 007): with an item grabbed, arrows across the axis (or along it past either end) move it to the nearest group that way; Escape returns it to the group and slot it was grabbed from; Home/End stay within the group.
- **Upstream references** (local clone `~/Github/motion`, tag `v14.10.1`):
  - the JSDoc in `packages/framer-motion/src/components/Reorder/Board.tsx:21-40` (`canMove`) and `:442-473` (component);
  - the demos `dev/react/src/tests/reorder-board.tsx` and `dev/react/src/tests/reorder-board-scroll.tsx` (scrolling page with columns).
- **Our docs**:
  - `docs/src/routes/docs/reorder/+page.svx`: sections `## Usage` (`:44`), `## Keyboard` (`:187`), `## With LazyMotion` (`:223`), `## Props` (`:242`) and `## Related` (`:268`).
  - `docs/src/lib/docsNav.ts:74` `{ title: 'Reorder', href: '/docs/reorder', icon: ArrowUpDown }`.
  - `docs/src/lib/examplesIndex.ts:186-200` has the `reorder` entry; copy its shape.
  - `docs/src/routes/examples/reorder/+page.svelte` builds `ExampleSection`s with `demoCodeSample` (copy it). Demos live in `docs/src/lib/examples/reorder/demos/*.svelte`.
  - `docs/src/lib/compare-data.ts` holds the "vs" comparison tables. Check whether it lists Reorder capabilities: `grep -n -i "reorder" docs/src/lib/compare-data.ts`.
- **Conventions**:
  - Docs import with `#lib/....js` specifiers, never `$lib`.
  - The SEO block (`seo.title`, `seo.description`, `ogFeatures`, `ogSlug`) is required on example pages; copy `docs/src/routes/examples/transition-mixer/+page.svelte:14-31`.
  - Docs pages use `.svx` with frontmatter `title`/`description`, like the existing `reorder/+page.svx`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Build library | `pnpm build` | exit 0 |
| Docs build | `pnpm --dir docs build` | exit 0 |
| Docs types | `pnpm --dir docs check` | 0 errors |
| Docs units | `pnpm --dir docs test` | all pass |
| Docs SEO | `pnpm --dir docs test:geo-seo` | all pass |
| Docs browser | `pnpm exec playwright test --config docs/playwright.config.ts` | all pass |
| Format / lint | `trunk fmt <files>` then `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, and never use `git stash`.

## Scope

**In scope:**
- `docs/src/routes/docs/reorder-board/+page.svx` (create)
- `docs/src/routes/docs/reorder/+page.svx` (a short `## Moving items between groups` section linking to the Board page, plus a `Reorder.Board` row under `## Props`)
- `docs/src/routes/examples/reorder-board/+page.svelte` (create; plus `+page.ts` if `examples/reorder` has one)
- `docs/src/lib/examples/reorder-board/demos/Kanban.svelte` and `docs/src/lib/examples/reorder-board/demos/LimitedColumn.svelte` (create)
- `docs/src/lib/docsNav.ts` (one entry, after Reorder)
- `docs/src/lib/examplesIndex.ts` (one entry)
- `docs/src/lib/compare-data.ts` (only if it enumerates Reorder features; add Board parity)

**Out of scope:**
- Any `src/lib` code. If the demo exposes a Board bug, STOP and report it.
- `docs/static/r/*.json` (generated; revert any build changes).

## Git workflow

- Lane branch `lane/14101-board-docs`, cut from `feat/motion-14.10.1` after 006 is merged.
- Use a conventional commit, for example `docs(reorder): Reorder.Board page and kanban example`.
- End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Demos

1. `Kanban.svelte`: three columns (To do / Doing / Done) in one `$state` record of arrays, inside `<Reorder.Board>`. Each column is a `Reorder.Group axis="y"`, and each card a `Reorder.Item` with `whileDrag={{ scale: 1.04, boxShadow: … }}`. Update state from the latest value in each `onReorder`, per the "values must be unique / update from latest state" note. Make the columns scroll vertically when tall, as in upstream's `reorder-board-scroll.tsx`.
2. `LimitedColumn.svelte`: the same layout with `canMove={(card, from, to) => to.length < 3}` on a "Doing" column. Show a visible "WIP limit 3" label.
3. Both demos must work with a keyboard: tabbable cards and visible focus styles.

**Verify**: `pnpm build && pnpm --dir docs check` → 0 errors.

### Step 2: Docs page

Create `docs/src/routes/docs/reorder-board/+page.svx`. Copy the frontmatter and SEO block of `docs/src/routes/docs/reorder/+page.svx`. Sections:
- intro;
- `## Usage` (a minimal two-group example);
- `## Moving between groups` (the two `onReorder` calls and the "update from latest state" note);
- `## canMove` (semantics, every-frame caveat, Escape ignores it);
- `## Keyboard` (key table: Space, arrows across the axis or past either end, Escape, Home/End stay in the group);
- `## Scrolling` (both axes; the containers around the columns scroll, not the column);
- `## Notes` (unique values; nested groups never exchange items; virtualized groups drop by visible items);
- `## Props` (`canMove`);
- `## Related` (Reorder, Drag).

Credit Motion 14.10 as the origin. In `docs/src/routes/docs/reorder/+page.svx`, add `## Moving items between groups` before `## Notes` (two sentences and a link), and add `Reorder.Board` under `## Props`.

### Step 3: Example page and registration

Create `docs/src/routes/examples/reorder-board/+page.svelte` with two `ExampleSection`s (Kanban, LimitedColumn), copying `docs/src/routes/examples/reorder/+page.svelte`. Add the nav entry (`{ title: 'Reorder.Board', href: '/docs/reorder-board', icon: … }`, using an existing lucide icon such as `Columns3` if it's available, otherwise `ArrowUpDown`) and the `examplesIndex.ts` entry. If `compare-data.ts` enumerates Reorder capabilities, add a Board row marked as matching Motion.

**Verify**: `pnpm build && pnpm --dir docs build && pnpm --dir docs check && pnpm --dir docs test && pnpm --dir docs test:geo-seo` → all pass. Then `pnpm exec playwright test --config docs/playwright.config.ts` → all pass. Revert `docs/static/r/animated-tabs.json` if the build changed it.

### Step 4: Format

Run `trunk fmt` and `trunk check` on the changed files.

**Verify**: no new issues.

## Test plan

This plan is docs only, so there is no red-first test: there is no runtime behaviour here. The gates are the docs build, the typecheck, the docs unit tests (including SEO title policy), the geo-seo check and the docs browser projects.

## Done criteria

- [ ] `docs/src/routes/docs/reorder-board/+page.svx` and `docs/src/routes/examples/reorder-board/+page.svelte` exist
- [ ] `grep -n "reorder-board" docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts` → a match in each
- [ ] Docs build, check, test, test:geo-seo and browser projects all pass
- [ ] Only in-scope files changed

## STOP conditions

- `Reorder.Board` isn't exported from the built package (plan 006 isn't merged).
- A demo misbehaves in the dev server in a way that points to a library bug (an item duplicated across columns, a drag that stops at the column edge).
- The SEO title policy test (`docs/src/lib/seo-title-policy.spec.ts`) rejects the new pages, and the fix isn't a title tweak.

## Maintenance notes

- If plan 007 hasn't merged when this lands, the docs' Keyboard section describes behaviour that isn't shipped yet. The dispatcher should merge 007 before releasing.
- Per the maintainer's sign-off rule, the demo pages go to the maintainer for live sign-off before any PR.
