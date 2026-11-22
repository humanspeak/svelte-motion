# Plan 002: Writing to a motion value inside `$effect` no longer subscribes the effect to that value

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4665b907..HEAD -- src/lib/utils/augmentMotionValue.svelte.ts src/lib/utils/augmentMotionValue.svelte.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: MED (touches every motion value the hooks return)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `4665b907`, 2026-11-13

## Why this matters

Every motion value the Svelte hooks return (`useMotionValue`, `useSpring`,
`useTransform`, `useScroll`, `toMotionValue`, …) is "augmented": its `current`
field is replaced by an accessor backed by Svelte `$state`, so templates can
read `mv.current` reactively. motion-dom's own `set()` reads `this.current`
internally before it writes. That read now happens through the `$state`
accessor, so a plain write such as

```svelte
$effect(() => {
    x.set(target)
})
```

makes the effect depend on `x` itself. This is the direct Svelte translation of
the upstream idiom `useEffect(() => x.set(target), [target])`, and the repo's
own docs demos use it. The consequence: whenever anything else changes `x`
(an `animate(x, …)`, a drag, a spring follower ticking), the effect re-runs and
writes `target` back. An audit probe on Svelte 5.57.2 and motion-dom 14.12.0
saw the effect run twice on mount, and an external `set(50)` was overwritten
back to the effect's value. For a `useSpring` value the effect re-runs on every
frame of the spring. After this plan, write methods do not create a dependency;
reads through `.current` and `.get()` stay reactive.

## Current state

- `src/lib/utils/augmentMotionValue.svelte.ts`: the augmentation. The relevant
  part of `augmentMotionValue` (lines 142–160):

  ```ts
  export const augmentMotionValue = <T>(
      value: MotionValue<T>,
      dispose: VoidFunction = () => undefined
  ): AugmentedMotionValue<T> => {
      // motion-dom's `.get()` returns `NonNullable<V>`, ...
      let current = $state<T>(value.get() as T)
      Object.defineProperty(value, 'current', {
          get: () => current,
          set: (v: T) => {
              if (v !== current) current = v
          },
          enumerable: true,
          configurable: true
      })

      const originalDestroy = value.destroy.bind(value)
      let destroyed = false
      value.destroy = () => {
          if (destroyed) return
          destroyed = true
          dispose()
          originalDestroy()
      }
  ```

  The function already wraps one instance method (`destroy`) by rebinding it.
  Follow that pattern for the write methods.

- Upstream motion-dom, the code whose internal read becomes tracked
  (`~/Github/motion`, tag `v14.12.0`,
  `packages/motion-dom/src/value/index.ts`). Read it with
  `git -C ~/Github/motion show v14.12.0:packages/motion-dom/src/value/index.ts`:
  - `set(v)` at line 332 calls `this.updateAndNotify(v)` (directly, or through
    an attached passive effect).
  - `updateAndNotify` at lines 388–421 does `this.prev = this.current`
    (line 400), then `this.setCurrent(v)`, then
    `if (this.current !== this.prev)` (line 405) and notifies subscribers.
  - `setWithVelocity(prev, current, delta)` at line 338 and
    `jump(v, endAnimation)` at line 349 go through the same paths.
  - `setPrevFrameValue(prevFrameValue = this.current)` at line 193 also reads
    `current`.

- The library already knows about this hazard on the read side:
  `src/lib/utils/style.ts:240` wraps a read in `untrack` so "the caller does
  not subscribe":

  ```ts
  const latest: unknown = isMotionValue(value) ? untrack((): unknown => value.get()) : value
  ```

- Call sites that hit the bug today (do not edit them; they are the evidence):
  - `src/lib/utils/toMotionValue.svelte.ts:52-56`:
    `$effect(() => { bridge.set(getter()) })`
  - `docs/src/lib/examples/pan/demos/CardItem.svelte:55-63`:
    `$effect(() => { ySpring.set(depthY) })` and two more.
- Existing spec: `src/lib/utils/augmentMotionValue.svelte.spec.ts`. Because
  the file name ends in `.svelte.spec.ts`, runes (`$state`, `$effect.root`)
  work inside it. `src/lib/utils/toMotionValue.svelte.spec.ts` shows the
  pattern for rune state plus `flushSync` in a spec:

  ```ts
  import { flushSync } from 'svelte'
  ...
  it('tracks rune state through a getter', () => {
      let progress = $state(0)
      const value = toMotionValue(() => progress / 100)
      expect(value.get()).toBe(0)
  ```

## Commands you will need

| Purpose             | Command                                                                  | Expected on success |
| ------------------- | ------------------------------------------------------------------------ | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`            | exit 0              |
| Build (needed once) | `pnpm build`                                                             | exit 0              |
| Typecheck           | `pnpm check`                                                             | 0 errors            |
| One unit file       | `pnpm exec vitest run src/lib/utils/augmentMotionValue.svelte.spec.ts`   | see steps           |
| All unit tests      | `pnpm test:only`                                                         | all pass            |
| e2e (own port)      | `PW_PORT=4212 pnpm exec playwright test <paths> --project=chromium`      | all pass            |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                           | no issues           |

Notes:

- Run `pnpm build` once before the first `vitest` run on a fresh checkout.
- Trunk is the lint and format authority; do not use `pnpm lint` or `prettier`.
- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it. Always pass `PW_PORT=4212` (or another free port) to Playwright.
- Never use `git stash`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/augmentMotionValue.svelte.ts`
- `src/lib/utils/augmentMotionValue.svelte.spec.ts`
- `.changeset/motion-value-set-untracked.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/utils/toMotionValue.svelte.ts` and the docs demos. They become
  correct through this fix; do not add `untrack` at call sites.
- `src/lib/utils/animationControls.svelte.ts`: a similar accidental dependency,
  fixed by plan 004.
- motion-dom itself (`node_modules`). No patches.
- The `.current` getter and `.get()`: reads must stay tracked. Templates and
  `$derived` depend on that.

## Git workflow

- Branch: `advisor/002-motion-value-set-untracked` from `origin/main`.
- Conventional commits, for example
  `fix(values): do not track the caller when a motion value is written`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing specs for the accidental dependency

Add a `describe('utils/augmentMotionValue: writes are untracked', …)` block to
`src/lib/utils/augmentMotionValue.svelte.spec.ts` with these cases. Each
creates `const mv = augmentMotionValue(motionValue(0))`, runs its effect inside
`$effect.root(() => { $effect(() => { … }) })`, calls `flushSync()` after every
action, and disposes the root at the end.

1. **`set` in an effect does not re-run on an outside write.** The effect does
   `runs += 1; mv.set(10)`. After the first flush expect `runs` to be `1`. Then
   call `mv.set(50)` outside the effect and flush. Expect `runs` still `1` and
   `mv.get()` to be `50`.
2. **`jump` in an effect**: same shape with `mv.jump(10)`.
3. **`setWithVelocity` in an effect**: same shape with
   `mv.setWithVelocity(0, 10, 16)`.
4. **Reads stay tracked** (guards against over-fixing): an effect that does
   `seen.push(mv.current)` re-runs after an outside `mv.set(5)`; expect `seen`
   to equal `[0, 5]`. Add the same check for an effect that reads `mv.get()`
   only if the current code already re-runs for `.get()`; if it does not, leave
   `.get()` out and say so in a comment.
5. **A change subscriber's reads are not attributed to the writer**: register
   `mv.on('change', () => { void other.current })` where `other` is a second
   augmented value. An effect that only does `mv.set(n)` (with `n` a `$state`
   it reads) must not re-run when `other` is set from outside.

**Verify**:
`pnpm exec vitest run src/lib/utils/augmentMotionValue.svelte.spec.ts`
→ cases 1, 2, 3 and 5 FAIL (for case 1: `runs` greater than 1, or `mv.get()`
equal to 10). Case 4 PASSES.

If cases 1–3 pass on the unmodified code, the reproduction is wrong: STOP and
report. If only `set` fails but `jump` or `setWithVelocity` pass, keep the
passing ones as regression guards and note it in the commit message.

### Step 2: Run the write methods under `untrack`

In `augmentMotionValue`, after the `current` accessor is defined, rebind the
three public write methods so their bodies run inside Svelte's `untrack`. Shape
(adapt types as needed; `untrack` comes from `'svelte'`):

```ts
// motion-dom reads `this.current` inside its write paths (`updateAndNotify`:
// `this.prev = this.current`). With `current` backed by `$state`, a write
// made inside an `$effect` would otherwise subscribe that effect to this value.
const set = value.set.bind(value)
value.set = (v) => untrack(() => set(v))
const jump = value.jump.bind(value)
value.jump = (v, endAnimation) => untrack(() => jump(v, endAnimation))
const setWithVelocity = value.setWithVelocity.bind(value)
value.setWithVelocity = (prev, next, delta) => untrack(() => setWithVelocity(prev, next, delta))
```

Rules:

- Keep each method's signature and return value exactly as motion-dom declares
  them. `jump`'s second parameter is optional; pass it through unchanged
  (do not default it yourself).
- Do not wrap `get`, `getPrevious`, `getVelocity`, `on`, or the `current`
  getter.
- Do not change the same-value check in the `current` setter.
- Update the JSDoc block above `augmentMotionValue` (the numbered list of
  "affordances"): add one item saying write methods run untracked and why, in
  the same style as the existing items. Public functions in this repo carry
  Google-style JSDoc.

**Verify**:
`pnpm exec vitest run src/lib/utils/augmentMotionValue.svelte.spec.ts`
→ all cases PASS, including case 4.

### Step 3: Check the hooks built on top

Run the specs of every module that augments values:

```bash
pnpm exec vitest run src/lib/utils/toMotionValue.svelte.spec.ts \
  src/lib/utils/motionValue.svelte.spec.ts src/lib/utils/spring.svelte.spec.ts \
  src/lib/utils/followValue.svelte.spec.ts src/lib/utils/transform.svelte.spec.ts \
  src/lib/utils/vanillaValues.svelte.spec.ts src/lib/utils/hookVanillaParity.svelte.spec.ts \
  src/lib/utils/velocity.svelte.spec.ts src/lib/utils/scroll.svelte.spec.ts \
  src/lib/utils/willChange.svelte.spec.ts
```

**Verify**: all pass. If a spec fails because it relied on the accidental
re-run (an effect that only writes a value and was expected to run again when
that value changed elsewhere), STOP and report the spec name and assertion; do
not edit that spec.

### Step 4: Changeset

Create `.changeset/motion-value-set-untracked.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

Calling `set()`, `jump()` or `setWithVelocity()` on a motion value inside `$effect` no longer makes that effect depend on the value. An effect such as `$effect(() => x.set(target))` now re-runs only when `target` changes, so it no longer overwrites an animation or drag that moves `x`.
```

### Step 5: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, then the e2e directories that
exercise motion values:

```bash
PW_PORT=4212 pnpm exec playwright test e2e/utilities e2e/motion --project=chromium
```

then `trunk fmt` and `trunk check` on the three in-scope files, then
`git diff --check`.

**Verify**: every command exits 0. For an e2e failure, re-run that one spec
alone once. If it fails again, do not edit the spec: STOP and report it (the
repo reviews e2e failures with the maintainer one page at a time).

## Test plan

- Red first: Step 1 cases 1–3 and 5 fail on current code and pass after
  Step 2. Case 4 passes before and after.
- All new tests live in `src/lib/utils/augmentMotionValue.svelte.spec.ts`.
- Pattern for rune state and `flushSync` in a spec:
  `src/lib/utils/toMotionValue.svelte.spec.ts`.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/augmentMotionValue.svelte.spec.ts` exits 0 with the five new cases
- [ ] `grep -n "untrack" src/lib/utils/augmentMotionValue.svelte.ts` shows the import and three wrapped methods
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `PW_PORT=4212 pnpm exec playwright test e2e/utilities e2e/motion --project=chromium` exits 0
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the three in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 cases 1–3 pass on unmodified code.
- Case 4 (reads stay tracked) fails after Step 2.
- Any existing unit spec or e2e spec fails after Step 2 and passes without it.
  That means something depended on the accidental re-run; the maintainer
  decides, not the executor.
- motion-dom's `set` / `jump` / `setWithVelocity` signatures differ from the
  description above (the Motion 14.14.0 bump may have landed). Compare with the
  installed `node_modules/motion-dom` types and adapt only the parameter
  lists; if a write path was added or removed, STOP.

## Maintenance notes

- The Motion 14.14.0 bump touches motion-dom. If a later motion-dom adds a new
  public write method on `MotionValue`, it needs the same wrapper; the Step 1
  spec will not catch a method it does not name.
- Subscribers registered with `mv.on('change', …)` now run untracked when the
  write came from an effect. That matches how they run when the write comes
  from an animation frame.
- Reviewer: check the wrappers preserve `this` (they use `bind`) and return
  values, and that nothing on the read side was wrapped.
- Deferred: `useMotionValueEvent` only supports `'change'` (upstream supports
  `animationStart`, `animationComplete`, `animationCancel`). Recorded in the
  batch README.
