# Plan 003: Document negative `bounce` (overdamped springs) from Motion 13.5.0

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/motion-13.5.0/README.md` — unless a reviewer dispatched
> you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 9eba7a61..HEAD -- docs/src/routes/docs/use-spring/+page.svx src/lib/utils/spring.svelte.spec.ts`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `9eba7a61`, 2026-10-01

## Why this matters

Motion 13.5.0 (installed since PR #491) lets `spring` accept a **negative**
`bounce`, from `0` to `-1`, to define overdamped springs. These ease into the
target more slowly and never overshoot. Upstream changelog:
"`spring`: Now accepts negative `bounce` (`0`-`-1`) to define overdamped springs."
Our docs still describe the range as 0 to 1, so users won't discover it. We
inherit the behavior for free, since `useSpring`, `springValue`, and
`transition: { type: 'spring' }` all pass options to motion-dom, so this is docs
plus a test that pins the behavior through our public surface.

## Current state

- `docs/src/routes/docs/use-spring/+page.svx` around lines 172–179, the duration-API table:
  ```md
  | `bounce`          | `0.3`   | `0` = no bounce, `1` = very bouncy                                                   |

  Setting `stiffness`, `damping`, or `mass` overrides `duration` / `bounce`.
  ```
- Upstream mapping (`packages/motion-dom/src/animation/generators/spring.ts` at v13.5.0, lines ~49–56):
  ```ts
   * Maps bounce to a damping ratio as SwiftUI does: 0 is critically damped, and
  const bounceToDampingRatio = (bounce: number) =>
      bounce < 0
          ? 1 / Math.max(1 + bounce, springDefaults.minDamping)
          : Math.max(1 - bounce, springDefaults.minDamping)
  ```
- `spring` is re-exported from our package root (`src/lib/index.ts`, the
  `export { ... spring, ... } from 'motion'` line).
- Spring tests: `src/lib/utils/spring.svelte.spec.ts` (jsdom Vitest project).

## Commands you will need

| Purpose   | Command                                                        | Expected  |
| --------- | -------------------------------------------------------------- | --------- |
| Unit      | `pnpm exec vitest run src/lib/utils/spring.svelte.spec.ts`     | all pass  |
| Docs      | `pnpm --dir docs check`                                        | 0 errors  |
| Lint      | `trunk fmt <files>` then `trunk check --no-fix <files>`        | no issues |

## Scope

**In scope:** `docs/src/routes/docs/use-spring/+page.svx`,
`src/lib/utils/spring.svelte.spec.ts`, and the README status row.

**Out of scope:** library source (no code change is needed), other docs pages, and
the changeset (this is docs only).

## Steps

### Step 1: Pin the behavior through our public `spring` export

In `spring.svelte.spec.ts`, add `describe('negative bounce (Motion 13.5.0)')`.
Import `spring` from `'$lib'` (or `'../index.js'`, matching how the file imports
today), then sample the generator:

```ts
const sample = (bounce: number) => {
    const gen = spring({ keyframes: [0, 100], duration: 800, bounce })
    return Array.from({ length: 41 }, (_, i) => gen.next(i * 20).value)
}
```

Assert:

1. `bounce: -0.5` never exceeds 100 and is monotonic non-decreasing.
2. At t = 200ms, `bounce: -0.5` is **below** `bounce: 0` (overdamped is slower).
3. `bounce: 0.5` exceeds 100 at some sample (control).

If `spring` turns out to take `duration` in seconds rather than ms, adjust the
numbers and note it in the report.

**Verify**: the spec passes. This is a net-new pin of inherited behavior, so
there is no red step.

### Step 2: Docs

Update the table row to:
`| \`bounce\` | \`0.3\` | \`1\` = very bouncy, \`0\` = no overshoot, negative values down to \`-1\` = overdamped (slower, never overshoots) |`,
keeping the column alignment `trunk fmt` produces. Add a two-line example under
the table:

```svelte
// Settles gently without overshooting
const gentle = useSpring(0, { duration: 0.6, bounce: -0.4 })
```

**Verify**: `pnpm --dir docs check` → 0 errors; trunk is clean on the two files.

## Done criteria

- [ ] New spec block passes (3 assertions)
- [ ] use-spring docs mention negative bounce, with an example
- [ ] docs check 0 errors; trunk clean; only in-scope files changed; README row updated

## STOP conditions

- `spring({ bounce: -0.5 })` overshoots or throws. That would mean the installed
  motion-dom doesn't have 13.5.0's change: check `node_modules/motion-dom/package.json`.

## Maintenance notes

If Motion changes the bounce range or mapping again, update the table and this spec.
