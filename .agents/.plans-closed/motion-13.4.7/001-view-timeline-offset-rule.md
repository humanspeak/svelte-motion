# Plan 001: `useScroll` decides ViewTimeline acceleration with upstream's 13.4.7 offset rule

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.4.7/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat ae938824..HEAD -- src/lib/utils/scroll.svelte.ts src/lib/utils/scroll.svelte.spec.ts src/lib/utils/viewTimelineRange.ts src/lib/utils/viewTimelineRange.spec.ts .changeset`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (pure function swap behind an existing boolean. Every offset accelerated today stays accelerated; see "Why this matters")
- **Depends on**: none
- **Category**: migration (upstream parity)
- **Planned at**: commit `ae938824`, 2026-09-30

## Why this matters

`useScroll({ target, offset })` asks our own function `canAccelerateScroll`
whether the progress values can run on a native CSS `ViewTimeline`. That runs on
the compositor thread and stays smooth when the main thread is busy. Our
function uses a hand-copied four-preset table from framer-motion ≤13.4.6.
Motion 13.4.7 (tag `v13.4.7`, motion PR #3842) replaced that table with a
general rule, `offsetToViewTimelineRange` in
`packages/framer-motion/src/render/dom/scroll/utils/offset-to-range.ts`. The
new rule accelerates any two-point offset whose container edges are `start`/`end`
and whose lengths are proportional (no px/vw/vh). The most common offset in real
apps, `["start end", "end start"]` ("while the element is in view"), now
accelerates upstream but NOT with us. Upstream's function is not exported from
any package, so bumping `motion` alone will never fix this. We must port it.

Safety: the new rule accepts a strict superset of our current four presets. The
advisor evaluated Enter, Exit, Any, and All against it, and all four still map. So no
offset that accelerates today stops accelerating.

## Current state

### `src/lib/utils/scroll.svelte.ts` (the only runtime file you change)

The file-local helpers to REMOVE (none are referenced outside this file:
`grep -rn "VIEW_TIMELINE_PRESETS\|parseStringOffset\|normaliseOffset\|matchesPreset\|offsetToViewTimelineRange\|ProgressIntersection\|ViewTimelineRange" src`
only hits `scroll.svelte.ts`):

- `type ProgressIntersection = [number, number]` (line ~48)
- `type ViewTimelineRange = { rangeStart: string; rangeEnd: string }` (line ~57)
- `const VIEW_TIMELINE_PRESETS` (line ~64), a table of entry/exit/cover/contain
- `const PROGRESS_BY_STRING` and `const parseStringOffset` (line ~94–110)
- `const normaliseOffset` (line ~115) and `const matchesPreset` (line ~132)
- `const offsetToViewTimelineRange` (line ~148):
  ```ts
  const offsetToViewTimelineRange = (offset?: ScrollOffset): ViewTimelineRange | undefined => {
      if (!offset) return { rangeStart: 'contain 0%', rangeEnd: 'contain 100%' }
      for (const [preset, name] of VIEW_TIMELINE_PRESETS) {
          if (matchesPreset(offset, preset)) {
              return { rangeStart: `${name} 0%`, rangeEnd: `${name} 100%` }
          }
      }
      return undefined
  }
  ```

The code that STAYS and becomes the only caller (line ~163):

```ts
const canAccelerateScroll = (target?: ElementOrGetter, offset?: ScrollOffset): boolean => {
    if (typeof window === 'undefined') return false
    return target
        ? supportsViewTimeline() && !!offsetToViewTimelineRange(offset)
        : supportsScrollTimeline()
}
```

Only the truthiness of `offsetToViewTimelineRange(...)` is used. The actual native
range setup happens inside motion's `scroll()` (called from `makeAccelerateConfig`,
line ~203), which is not part of this plan.

Also keep the public-ish `type ScrollOffset = Array<[number | string, number | string]> | string[]`
(line ~46) unchanged. Widening the public type is out of scope.

### Upstream source to port (tag `v13.4.7`, all read-only)

Read these with `git -C ~/Github/motion show v13.4.7:<path>`:

- `packages/framer-motion/src/render/dom/scroll/offsets/edge.ts`: `namedEdges`, `resolveEdge`
- `packages/framer-motion/src/render/dom/scroll/offsets/offset.ts`: `resolveOffset`
- `packages/framer-motion/src/render/dom/scroll/offsets/presets.ts`: `ScrollOffset` presets (Enter/Exit/Any/All)
- `packages/framer-motion/src/render/dom/scroll/utils/offset-to-range.ts`: `toIntersection`, `toRange`, `offsetToViewTimelineRange`
- Tests to mirror: `.../offsets/__tests__/edge.test.ts`, `.../offsets/__tests__/offset.test.ts`, `.../utils/__tests__/offset-to-range.test.ts`

If `~/Github/motion` has no `v13.4.7` tag, run `git -C ~/Github/motion fetch --tags` first.

The core of the new rule (verbatim from upstream, for reference):

```ts
const toIntersection = (o: ScrollOffset[number]) => {
    if (/v/u.test(o as string)) return []
    const px = resolveOffset(o, 0, 0, 0)
    return [resolveOffset(o, 0, 1, 0) - px, px - resolveOffset(o, 1, 0, 0), px]
}

const toRange = ([t, c, px]: number[]) =>
    !px && (c === 0 || c === 1) && `${c ? "entry" : "exit"}-crossing ${t * 100}%`

export function offsetToViewTimelineRange(offset: ScrollOffset = presets.All): ViewTimelineRange | undefined {
    if (offset.length !== 2) return
    const [start, end] = offset.map(toIntersection)
    const points = [toRange(start), toRange(end)]
    const a = end[0] - start[0]
    const b = start[1] - end[1]
    if (points[0] && points[1] && (a || b)) {
        return { points: points as string[], a, b, cover: !start[0] && a === 1 && b === 1 }
    }
}
```

### Conventions to match

- New utils are camelCase `.ts` files with a sibling `.spec.ts`, e.g.
  `src/lib/utils/transformComposer.ts` + `transformComposer.spec.ts`.
- Exported helpers use `export const name = (...) => {}` arrow syntax with
  Google-style JSDoc (`@param`, `@returns`) on every export. Comments cite the
  upstream file path they mirror (see `scroll.svelte.ts:196-201`,
  "Mirrors framer-motion's `makeAccelerateConfig` 1:1").
- Plain `*.spec.ts` files run in the **node** Vitest project. A spec that needs
  `document` starts with this docblock, as `src/lib/utils/svg.spec.ts` does:
  ```ts
  /**
   * @vitest-environment jsdom
   */
  ```
- `useScroll` behavior tests live in `src/lib/utils/scroll.svelte.spec.ts`.
  They mock `supportsViewTimeline` via `supportsViewTimelineMock.mockReturnValue(true)`
  and use `inRoot(() => useScroll({ target, offset }))`. See the existing tests at
  lines ~223–257 ("sets accelerate when target is provided…" and
  "does not set accelerate when target offset does not match a named range").
- Changesets: one file per change in `.changeset/`, patch level, e.g.
  `.changeset/motion-13-4-5.md`:
  ```md
  ---
  '@humanspeak/svelte-motion': patch
  ---

  Update the upstream Motion dependency to 13.4.6 and retain motion-dom at 13.4.5.
  ```
  Never bump the package version or add minor/major labels. Versions mirror upstream.

## Commands you will need

| Purpose              | Command                                                                  | Expected on success          |
| -------------------- | ------------------------------------------------------------------------ | ---------------------------- |
| New module tests     | `pnpm exec vitest run src/lib/utils/viewTimelineRange.spec.ts`           | all pass                     |
| useScroll tests      | `pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts`               | all pass                     |
| Unit (full)          | `pnpm test:only`                                                         | all pass                     |
| Typecheck            | `pnpm check`                                                             | 0 errors                     |
| Package              | `pnpm package`                                                           | exit 0, publint "All good!"  |
| Consumer + tree-shake | `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` | 3 "…passed." lines, exit 0 |
| Lint / format        | `trunk fmt <files>` then `trunk check --no-fix <files>`                  | no issues                    |

Use Trunk (`.trunk/trunk.yaml`), not `pnpm lint`/prettier/eslint. If
`pnpm exec vitest` complains about `tsconfig.json`, run `pnpm exec svelte-kit sync` once.

## Scope

**In scope** (the only files you should modify or create):

- `src/lib/utils/viewTimelineRange.ts` (create): the port
- `src/lib/utils/viewTimelineRange.spec.ts` (create): mirrored upstream tests
- `src/lib/utils/scroll.svelte.ts`: delete the old helpers, import the new function
- `src/lib/utils/scroll.svelte.spec.ts`: new `useScroll` integration cases
- `.changeset/use-transform-scroll-acceleration.md` (create)
- `.agents/.plans/motion-13.4.7/README.md`: status row only

**Out of scope** (do NOT touch):

- `package.json` / `pnpm-lock.yaml`: the Motion 13.4.7 bump is plan 002.
- `makeAccelerateConfig`, the JS `scroll()` callback path, and everything else in
  `scroll.svelte.ts` besides the helpers listed above.
- The `ScrollOffset` type alias (public surface).
- `src/lib/index.ts`: the new module is internal. Do NOT export it.
- Docs pages and e2e: those land with plan 002, once native attachment actually works.

## Git workflow

- Branch: stay on `chore/upstream-delta-2026-09-30` (or the worktree branch the operator gives you).
- Conventional commits, e.g. `feat: accelerate more useScroll target offsets via ViewTimeline`.
- Do NOT commit, push, or open a PR unless the operator instructs it.

## Steps

### Step 1: Write failing `useScroll` tests (red)

In `src/lib/utils/scroll.svelte.spec.ts`, next to the existing accelerate tests,
add one `it.each` (or several `it`s) using `supportsViewTimelineMock.mockReturnValue(true)`
and a `document.createElement('div')` target. Assert `scrollYProgress.accelerate`
is **defined** for offsets that upstream 13.4.7 accelerates but our table does not:

- `['start end', 'end start']`: cover, the key case
- `[[0, 1], [1, 0]]`: cover, numeric form
- `['center end', 'center start']`
- `[[0.25, 1], [0.75, 0]]`
- `['start start', 'end end']`: All, string form (check whether this already passes; see the Verify note)
- `['end end', 'start start']`

Also add regression guards asserting it is **undefined** (these should already pass):

- `['start center', 'end start']`: container edge other than start/end
- `['100px end', 'end start']` and `['start end', 'end 50vh']`: absolute lengths
- `['start start', 'start start']`: identical points
- `['start end', 'center center', 'end start']`: not exactly two points

Keep the two existing tests unchanged. `[[0.1, 0.9], [0.9, 0.1]]` stays rejected
under the new rule.

**Verify**: `pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts` → at least
the `['start end', 'end start']`, `[[0, 1], [1, 0]]`, `['center end', 'center start']`,
and `[[0.25, 1], [0.75, 0]]` cases FAIL with `expected undefined to be defined`
(or equivalent). All "undefined" guards and all pre-existing tests pass. Some
string forms of the old presets may already pass, because our old parser handled
`start`/`end` strings. That's fine; note which ones in your report. If
`['start end', 'end start']` PASSES, STOP: the gap is already closed.

### Step 2: Port the rule into `src/lib/utils/viewTimelineRange.ts`

Port 1:1 from the upstream files listed above, adapted only to repo style
(arrow functions, Google JSDoc, 4-space indent via `trunk fmt`). Include:

- `namedEdges` and `resolveEdge(edge, length, inset = 0)`, from `edge.ts`, including the px/%/vw/vh branches
- `resolveOffset(offset, containerLength, targetLength, targetInset)`, from `offset.ts`
- the `ScrollOffset` presets needed for the default (`All: [[0, 0], [1, 1]]`)
- `offsetToViewTimelineRange(offset = All)`, returning `{ points, a, b, cover } | undefined`, from `offset-to-range.ts`

Export `resolveEdge`, `resolveOffset`, and `offsetToViewTimelineRange` (so the spec
can test each), plus the `ViewTimelineRange` interface. Use permissive local
types for inputs:
`type Edge = string | number`,
`type OffsetEntry = Edge | readonly [Edge, Edge]`, and
`offset?: ReadonlyArray<OffsetEntry>`. That lets our narrower public
`ScrollOffset` be passed without casts. Put a module JSDoc at the top citing the
four upstream paths and "motion v13.4.7 (motion#3842)".

**Verify**: `pnpm exec vitest run src/lib/utils/viewTimelineRange.spec.ts` can't
run yet (no spec). Instead run `pnpm check` → 0 errors.

### Step 3: Mirror upstream's unit tests in `src/lib/utils/viewTimelineRange.spec.ts`

Start the file with the `@vitest-environment jsdom` docblock (the vw/vh edge tests
need `document`). Port every case from upstream's `edge.test.ts`,
`offset.test.ts`, and `offset-to-range.test.ts` at `v13.4.7`, keeping the same
expected values. Where upstream passes a form our types don't model (e.g.
`offsetToViewTimelineRange([0, 1])`), the permissive input type from Step 2
should accept it. Otherwise use a narrow `as` cast in the test only.

**Verify**: `pnpm exec vitest run src/lib/utils/viewTimelineRange.spec.ts` → all pass.
The case count should match upstream's test cases, so report the number.

### Step 4: Switch `useScroll` to the ported rule

In `src/lib/utils/scroll.svelte.ts`: `import { offsetToViewTimelineRange } from './viewTimelineRange.js'`
(the repo imports siblings with `.js` suffixes, e.g. `'./dom.js'`). Delete the
helpers listed under "Current state". Leave `canAccelerateScroll`'s body as is,
so it now calls the imported function. Update the doc comments that mention "named
presets" / "preset table" so they describe the new rule and cite
`offset-to-range.ts` at motion v13.4.7.

**Verify**: `pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts` → all pass,
including every Step 1 case. Then run
`grep -n "VIEW_TIMELINE_PRESETS\|matchesPreset\|normaliseOffset\|parseStringOffset" src/lib/utils/scroll.svelte.ts`
→ no matches.

### Step 5: Changeset for the `useTransform` acceleration already on this branch

This branch already carries `useTransform` scroll acceleration (commit `4cf008fd`,
`feat: accelerate useTransform values derived from scroll progress`) without a
changeset. Create `.changeset/use-transform-scroll-acceleration.md` (patch):

> `useTransform` values mapped from `useScroll` progress now run as native
> ScrollTimeline/ViewTimeline animations when the browser supports them,
> matching Motion 13.4.7 (including its clamped end values). Chained
> transforms, `clamp: false`, function transformers, and input stops outside
> ascending 0–1 stay on the JavaScript path.

Do NOT write a changeset for this plan's offset change. Plan 002 writes one
together with the dependency bump, because the offsets only attach natively
once Motion 13.4.7 is installed.

**Verify**: `head -3 .changeset/use-transform-scroll-acceleration.md` → the
`'@humanspeak/svelte-motion': patch` frontmatter.

### Step 6: Full gate

**Verify**, all of:

- `pnpm test:only` → all pass
- `pnpm check` → 0 errors
- `pnpm package` → exit 0, publint clean
- `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` →
  three "…passed." lines. The tree-shaking check must stay green: the new module
  is imported only by `scroll.svelte.ts`.
- `trunk fmt` + `trunk check --no-fix` on every touched file → no issues
- `git status --porcelain` → only in-scope files

## Test plan

- **Red first (Step 1)**: new-offset cases fail against the preset table with
  `accelerate` undefined, then pass after Step 4. Rejection cases are permanent
  guards that the port didn't over-accept.
- **Upstream parity (Step 3)**: every upstream case for `resolveEdge`,
  `resolveOffset`, and `offsetToViewTimelineRange` at v13.4.7, with the same
  expectations, so a future upstream change shows up as a diff against these.
- Patterns: `src/lib/utils/scroll.svelte.spec.ts` (integration),
  `src/lib/utils/svg.spec.ts` (jsdom docblock in a plain spec).

## Done criteria

- [ ] `src/lib/utils/viewTimelineRange.ts` and `.spec.ts` exist; the spec passes with all upstream cases ported
- [ ] Step 1 cases exist in `scroll.svelte.spec.ts`; `['start end', 'end start']` failed before Step 4 and passes after
- [ ] `grep -n "VIEW_TIMELINE_PRESETS\|matchesPreset" src/lib/utils/scroll.svelte.ts` → no matches
- [ ] `grep -n "viewTimelineRange" src/lib/index.ts` → no matches (internal only)
- [ ] `.changeset/use-transform-scroll-acceleration.md` exists (patch)
- [ ] `pnpm test:only`, `pnpm check`, `pnpm package`, and the consumer suite all pass
- [ ] `trunk check` has no issues on touched files; only in-scope files changed
- [ ] README status row updated

## STOP conditions

- The drift check shows `scroll.svelte.ts` no longer matches the excerpts.
- `['start end', 'end start']` already accelerates at Step 1.
- `~/Github/motion` has no `v13.4.7` tag after `fetch --tags`, or the upstream
  files differ materially from the "core of the new rule" excerpt.
- Any pre-existing `scroll.svelte.spec.ts` test fails after Step 4. That would
  mean the port rejects something the old table accepted, which contradicts
  this plan's safety claim.
- The consumer tree-shaking check fails after your change.
- Making it work seems to need changes to `package.json`, the public
  `ScrollOffset` type, or `src/lib/index.ts`.

## Maintenance notes

- This is a port of non-exported upstream code. On every Motion bump, diff
  `packages/framer-motion/src/render/dom/scroll/utils/offset-to-range.ts` and
  `offsets/*` between tags, and re-sync `viewTimelineRange.ts` and its spec.
- Until plan 002 installs Motion 13.4.7, newly accepted offsets get an
  `accelerate` config, but 13.4.6's `scroll()` can't map them to a native range.
  It falls back to JS-driven observation, which is visually correct, just not
  compositor-driven. Ship plans 001 and 002 in the same PR.
- Reviewers: check that `resolveEdge`'s vw/vh branch is ported (for fidelity),
  even though `toIntersection` rejects those units before calling it.
