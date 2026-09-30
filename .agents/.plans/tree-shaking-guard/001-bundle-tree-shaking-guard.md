# Plan 001: A CI bundle test proves the documented tree-shaking guarantees

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/tree-shaking-guard/README.md` — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 5e9d04a0..HEAD -- tests/consumer-vite6 .github/workflows/run-tests.yml src/lib/index.ts src/lib/html/_MotionContainer.svelte src/lib/vite.ts`
> If `tests/consumer-vite6/verify.mjs` or `tests/consumer-vite6/package.json`
> changed, compare them against the excerpts below before proceeding; on a
> mismatch, treat it as a STOP condition. Changes to `src/lib/index.ts` or
> `_MotionContainer.svelte` are expected churn and fine, as long as the Step 1
> baseline still passes.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (adds a test only; no library code changes)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `5e9d04a0`, 2026-09-30

## Why this matters

The public docs page `docs/src/routes/docs/tree-shaking/+page.svx` promises that
named exports (`MotionDiv`), the `svelteMotionOptimize` Vite plugin, and direct
imports (`@humanspeak/svelte-motion/html/Div.svelte`) all tree-shake: you pay
only for the elements you use, not all ~180 wrappers. Nothing in the repo checks
this. One stray import is enough to break it silently. For example, a hook
module importing a `.svelte` component, a new top-level side effect, or a
barrel re-export: any of these would drag the whole component layer into apps
that only use `animate` or `useTransform`. Upstream Motion added exactly this
kind of guard in motion PR #3864 (`packages/motion/src/__tests__/frameloop-tree-shaking.test.ts`):
bundle the published entry points and assert that marker strings are present
or absent. This plan does the same for our package.

Baseline measured on 2026-09-30 (Vite 6.4.3, `minify: false`, `svelte` external),
bundling through the package's real `exports` map:

| Import                                                    | Output chars | `tag: "circle"`? | `data-is-loaded`? |
| --------------------------------------------------------- | ------------ | ---------------- | ----------------- |
| `export { MotionDiv } from '@humanspeak/svelte-motion'`   | 473,306      | no               | yes               |
| `export { default } from '…/html/Div.svelte'`             | 473,304      | no               | yes               |
| `motion.div` via `import { motion }`                      | 645,828      | **yes**          | yes               |
| `<motion.div>` component + `svelteMotionOptimize()`        | 473,593      | no               | yes               |
| `<motion.div>` component, no plugin                       | 646,111      | **yes**          | yes               |
| all 82 non-component exports together                    | 231,100      | no               | **no**            |

So every guarantee holds today. This plan locks it in.

## Current state

### The consumer fixture (where the test goes)

`tests/consumer-vite6/` is a pnpm workspace package (listed in
`pnpm-workspace.yaml`). It depends on the library as `"@humanspeak/svelte-motion": "workspace:*"`,
so imports resolve through the root `package.json` `exports` map into the built
`dist/`, exactly as a real consumer's would. `tests/consumer-vite6/package.json`:

```json
{
    "name": "@humanspeak/svelte-motion-consumer-vite6",
    "private": true,
    "type": "module",
    "scripts": {
        "test": "node verify.mjs"
    },
    "dependencies": {
        "@humanspeak/svelte-motion": "workspace:*",
        "@sveltejs/vite-plugin-svelte": "5.1.1",
        "svelte": "5.56.10",
        "vite": "6.4.3"
    },
    "packageManager": "pnpm@12.6.0"
}
```

`tests/consumer-vite6/verify.mjs` begins with a side-effect import of a sibling
check module:

```js
import { svelte } from '@sveltejs/vite-plugin-svelte'
import assert from 'node:assert/strict'
import path from 'node:path'
import { createServer } from 'vite'
import './verify-types.mjs'
```

`tests/consumer-vite6/verify-types.mjs` is the exemplar for a self-contained check
module: top-level `node:assert/strict` assertions, then one
`console.log('… checks passed.')` line at the end. Match it.

Existing fixture files in `tests/consumer-vite6/src/`: `OptimizedImport.svelte`,
`RootImport.svelte`, `render-optimized.js`, `render-root.js`, `reorder-types.ts`.
`OptimizedImport.svelte` is the pattern for a component that uses `motion.*`
syntax:

```svelte
<script>
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
</script>
```

### CI already runs it after a build

`.github/workflows/run-tests.yml`, job `unit-tests`:

```yaml
            - name: Run unit tests
              run: |
                  pnpm build
                  pnpm test

            - name: Test Vite 6 consumer compatibility
              run: pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test
```

So a new check imported from `verify.mjs` runs in CI against a fresh `dist/`
with **no workflow change**.

### Marker strings (verified at plan time)

- **Per-element wrapper marker**: each generated wrapper
  (e.g. `dist/html/Circle.svelte`) renders `<MotionContainer bind:ref tag="circle" …>`,
  which compiles to `tag: "circle"`. Match it with the regex `/tag:\s*"circle"/`
  (whitespace-tolerant). Use `circle` and `blockquote`: neither appears in a
  `MotionDiv`-only bundle, and both appear in the `motion` object bundle.
- **Component-layer marker**: the literal `data-is-loaded`. It only appears in
  `src/lib/html/_MotionContainer.svelte:1562` (`'data-is-loaded': isLoaded,`), the
  shared container every motion element renders through. It must never appear
  in a bundle of non-component exports.

### Deriving the export list (don't hand-maintain it)

Bundling `export * from '@humanspeak/svelte-motion'` gives an entry chunk whose
`chunk.exports` array is the package's real runtime export list (259 names at
plan time). Classify each name:

- **Component layer**: exactly `motion`, `m`, `Reorder`, `AnimatePresence`,
  `LayoutGroup`, `LazyMotion`, `MotionConfig`, `PresenceChild`, plus every name
  matching `/^Motion[A-Z]/` **except** `MotionGlobalConfig` and `MotionValueState`
  (those two are plain objects/classes re-exported from `motion`).
- **Everything else** is the non-component surface (82 names at plan time,
  including `animate`, `frame`, `useTransform`, `useScroll`, `mapValue`,
  `domAnimation`, `useAnimate`, …).

### Working Vite build recipe (verified at plan time)

`lib.entry` does not work with a virtual module, because Vite resolves it relative
to the root before plugins run. Use `rollupOptions.input` with an `enforce: 'pre'`
virtual plugin instead, and handle `build()` returning either an array or a
single output:

```js
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { build } from 'vite'

const VIRTUAL_ID = 'virtual:tree-shaking-entry'
const RESOLVED_ID = '\0' + VIRTUAL_ID

const bundle = async (code, { plugins = [svelte()] } = {}) => {
    const result = await build({
        root: import.meta.dirname,
        configFile: false,
        logLevel: 'silent',
        plugins: [
            {
                name: 'tree-shaking-entry',
                enforce: 'pre',
                resolveId: (id) => (id === VIRTUAL_ID ? RESOLVED_ID : null),
                load: (id) => (id === RESOLVED_ID ? code : null)
            },
            ...plugins
        ],
        resolve: { dedupe: ['svelte'] },
        build: {
            write: false,
            minify: false,
            rollupOptions: {
                input: VIRTUAL_ID,
                preserveEntrySignatures: 'strict',
                external: [/^svelte($|\/)/]
            }
        }
    })
    const output = (Array.isArray(result) ? result[0] : result).output
    const chunks = output.filter((item) => item.type === 'chunk')
    return {
        code: chunks.map((chunk) => chunk.code).join('\n'),
        exports: chunks.find((chunk) => chunk.isEntry)?.exports ?? []
    }
}
```

For a real `.svelte` file entry (the optimize-plugin check), pass the file path
as `input` instead of the virtual id. Adapt the helper to accept either. The whole
suite (about 8 bundles) took about 10 s at plan time.

## Commands you will need

| Purpose                     | Command                                                         | Expected on success                                   |
| --------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| Build library (makes dist)  | `pnpm build`                                                    | exit 0                                                |
| Consumer checks (incl. new) | `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`   | exit 0; prints the existing lines plus the new one    |
| Typecheck                   | `pnpm check`                                                    | 0 errors                                              |
| Lint                        | `trunk check`                                                   | no new issues                                         |
| Format                      | `trunk fmt`                                                     | exit 0                                                |

This repo uses **Trunk** (`.trunk/trunk.yaml`) for lint and format. Don't run
`pnpm lint`, `prettier`, or `eslint` directly. Don't run `pnpm install`: the
fixture's dependencies are already installed.

## Scope

**In scope** (the only files you should modify or create):

- `tests/consumer-vite6/verify-tree-shaking.mjs` (create): the check module.
- `tests/consumer-vite6/src/TreeShakeOptimized.svelte` (create): fixture using only `<motion.div>`.
- `tests/consumer-vite6/verify.mjs`: add one line, `import './verify-tree-shaking.mjs'`, next to the existing `import './verify-types.mjs'`.
- `.agents/.plans/tree-shaking-guard/README.md`: status row only.

**Out of scope** (do NOT touch):

- Anything under `src/lib/`. This plan only observes the library. If the new test
  fails on unmodified library code, that is a STOP, not something to fix here.
- `.github/workflows/*`: CI already runs the consumer suite after `pnpm build`.
- `tests/consumer-vite6/package.json`: no new dependencies are needed (`vite` and
  `@sveltejs/vite-plugin-svelte` are already there).
- Byte-size budgets or absolute size thresholds. Use markers plus the **relative**
  comparisons below. Absolute sizes break on every legitimate feature.
- The docs page. Its claims are already correct.

## Git workflow

- Branch: `test/tree-shaking-guard` off `origin/main` (or the branch the operator gave you).
- Conventional commit, matching `git log` style, e.g.
  `test: guard documented tree-shaking in the Vite 6 consumer fixture`.
- Do NOT push or open a PR unless the operator told you to.

## Steps

### Step 1: Confirm the baseline builds

Run `pnpm build`, then `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`.

**Verify**: exit 0, and output contains `Published Reorder consumer type checks passed.`
and `Vite 6 consumer SSR regression checks passed.` If it fails before you
have changed anything, STOP. The fixture is broken independently of this plan.

### Step 2: Add the optimize-plugin fixture

Create `tests/consumer-vite6/src/TreeShakeOptimized.svelte`:

```svelte
<script>
    import { motion } from '@humanspeak/svelte-motion'
</script>

<motion.div animate={{ opacity: 1 }}>tree-shaking fixture</motion.div>
```

It must use ONLY `motion.div`. Any other element would defeat the check.

**Verify**: `test -f tests/consumer-vite6/src/TreeShakeOptimized.svelte && echo ok` → `ok`

### Step 3: Write `verify-tree-shaking.mjs`

Create `tests/consumer-vite6/verify-tree-shaking.mjs`. Start with a short JSDoc
comment explaining its purpose and citing upstream's
`packages/motion/src/__tests__/frameloop-tree-shaking.test.ts` (motion#3864) as
the model. Use the `bundle` helper from "Working Vite build recipe" (JSDoc it,
as `renderWithVite` in `verify.mjs` is documented). Define:

```js
const PKG = '@humanspeak/svelte-motion'
const CONTAINER_MARKER = 'data-is-loaded'
const hasTag = (code, tag) => new RegExp(`tag:\\s*"${tag}"`).test(code)
```

Then make these assertions with `node:assert/strict`. Every assertion message
must say which docs promise broke:

1. **Positive control: the markers work.**
   `motion.div` via `import { motion } from PKG; export const Div = motion.div`
   → `hasTag(code, 'circle')` and `hasTag(code, 'blockquote')` are both `true`.
   (Message: "marker check is broken — the motion object bundle should contain every wrapper".)
2. **Named exports tree-shake.** `export { MotionDiv } from PKG` →
   `hasTag(code, 'div')` is `true`, and `hasTag(code, 'circle')` and
   `hasTag(code, 'blockquote')` are both `false`.
3. **Direct imports tree-shake, and named exports match them.**
   `export { default } from '@humanspeak/svelte-motion/html/Div.svelte'` → no
   `circle`. Then assert
   `Math.abs(named.length - direct.length) / direct.length < 0.01`
   (named `MotionDiv` is within 1 % of the direct import).
4. **The Vite plugin tree-shakes.** Bundle
   `path.join(import.meta.dirname, 'src/TreeShakeOptimized.svelte')` as a
   file entry with plugins `[svelteMotionOptimize(), svelte()]`
   (`import { svelteMotionOptimize } from '@humanspeak/svelte-motion/vite'`,
   as `vite.optimized.config.mjs` already does) → no `circle`, and within 1 % of
   the direct bundle. **Control**: bundle the same file with only `[svelte()]`
   → `hasTag(code, 'circle')` is `true`. That proves the plugin is doing the work.
5. **The non-component surface never pulls in components.**
   a. `const all = await bundle(\`export * from '${PKG}'\`)` → take `all.exports`.
   b. Classify each name with the rules in "Deriving the export list". Assert that
      the non-component list includes `animate`, `frame`, `useTransform`, and
      `useScroll` (a sanity check that the derivation didn't break) and has at
      least 50 names.
   c. Bundle all non-component names in one entry:
      `export { a, b, … } from PKG`. Assert that `code.includes(CONTAINER_MARKER)`
      is `false` and `hasTag(code, 'div')` is `false`.
   d. **Only if (c) fails**: bundle each non-component name alone and collect
      the ones whose output contains `CONTAINER_MARKER`. Put those names in
      the assertion message ("these exports pull in the motion component layer: …").
      The failure is then actionable.

End with `console.log('Tree-shaking consumer checks passed.')`.

**Verify**: `node tests/consumer-vite6/verify-tree-shaking.mjs` (run from the
repo root, or `cd tests/consumer-vite6 && node verify-tree-shaking.mjs`) → exit 0,
prints `Tree-shaking consumer checks passed.`, and finishes in under 60 s.

### Step 4: Prove the guard bites (temporary, do not commit)

This is a net-new guard, so there is no red test against existing behavior (see
Test plan). Prove it can fail instead. Make each temporary change to the
**built** `dist/` only, never `src/`, and rebuild afterwards to restore it:

1. Append these two lines to the end of `dist/utils/arc.js`:
   ```js
   import __Circle from '../html/Circle.svelte'
   globalThis.__svelteMotionLeak = __Circle
   ```
   Run the check. It must FAIL on assertion 5, and the message must name `arc`
   as an offender. Do **not** use a bare `import '../html/Circle.svelte'`. The
   package declares `"sideEffects": ["**/*.css"]`, so bundlers prune an unused
   side-effect import and the guard would (correctly) pass. This was verified at
   plan time: the bare import does not leak, and the used-import form does.
2. Run `pnpm build` to restore `dist/`. Run the check again. It must PASS.

**Verify**: both runs behave as described. Record the failing message in your
report. If step 1 does not fail, the guard is not testing what it claims: STOP.

### Step 5: Wire into the consumer suite

In `tests/consumer-vite6/verify.mjs`, add `import './verify-tree-shaking.mjs'`
on the line after `import './verify-types.mjs'`.

**Verify**: `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → exit 0,
and output includes all three lines: `Published Reorder consumer type checks passed.`,
`Tree-shaking consumer checks passed.`, `Vite 6 consumer SSR regression checks passed.`

### Step 6: Full gate

**Verify**, all of:

- `trunk fmt` then `trunk check` → no new issues in the touched files
- `pnpm check` → 0 errors
- `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` → exit 0
- `git status --porcelain` → only the three in-scope test files plus the README
  (and no `dist/` changes, since `dist` is git-ignored)

## Test plan

- **No red-first test:** this plan adds a regression guard for behavior that
  is already correct (see the baseline table), so no failing test can exist on
  current code. Step 4 replaces that with a deliberate, uncommitted breakage of
  the built output, which proves the guard fails for the right reason and
  names the offending export.
- Assertions 1 and 4-control are positive controls, in the style of upstream's
  "full animate includes the frameloop" case, so a broken marker can't produce a
  false pass.
- Pattern to follow: `tests/consumer-vite6/verify-types.mjs` (module shape) and
  `tests/consumer-vite6/verify.mjs` (`renderWithVite` helper + JSDoc style).

## Done criteria

- [ ] `tests/consumer-vite6/verify-tree-shaking.mjs` and `tests/consumer-vite6/src/TreeShakeOptimized.svelte` exist
- [ ] `grep -n "verify-tree-shaking" tests/consumer-vite6/verify.mjs` → 1 match
- [ ] `pnpm build && pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test` exits 0 and prints `Tree-shaking consumer checks passed.`
- [ ] Step 4's deliberate breakage made the check fail and name `arc` (reported, not committed)
- [ ] `pnpm check` 0 errors, and `trunk check` has no new issues
- [ ] No files outside the in-scope list are modified
- [ ] README status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's baseline fails before you change anything.
- The new check fails on **unmodified** library code. That is a real
  tree-shaking regression in `src/lib/`. Report the offender list. Do not fix
  library code under this plan.
- `export *`'s entry-chunk `exports` comes back empty, or the non-component list
  is missing `animate`, `frame`, `useTransform`, or `useScroll` (the build recipe
  or Vite version changed).
- A new `Motion*`-prefixed export turns out to be a non-component (the check
  fails because of it). Report the name so the classification can be updated
  deliberately.
- Step 4's deliberate breakage does NOT make the check fail.
- The suite takes more than 60 s.

## Maintenance notes

- **New exports**: non-component exports are picked up automatically. A new
  **component** export is covered by the `/^Motion[A-Z]/` rule. A component with
  any other name (like `AnimatePresence`) must be added to the explicit
  component-layer set, and the check fails loudly until it is.
- **Markers**: if `_MotionContainer.svelte` stops emitting `data-is-loaded`, or
  the wrappers stop passing `tag="…"`, the positive controls (assertions 1 and 4)
  fail first. Update the markers there; don't delete the controls.
- **Vite upgrades**: the fixture pins Vite 6.4.3. If it moves to Rolldown-based
  Vite, re-check the build recipe (`output` shape, `chunk.exports`).
- Reviewers: check that no assertion uses an absolute byte size, and that the
  per-export bisection runs only when the combined check fails (so CI time
  stays around 10 s).
- Deferred: a minified-size report comment on PRs (like size-limit). That's nice
  to have, but it's a different tool and needs a workflow change.
