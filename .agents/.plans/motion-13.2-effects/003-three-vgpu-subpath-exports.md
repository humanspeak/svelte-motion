# Plan 003: Re-export Motion's `three` and `vgpu` effect adapters as package subpaths

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/motion-13.2-effects/README.md`) — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Revision 2026-09-03** (guard, after plan 001 passed at `7d09c0d`): drift
> baseline re-stamped `47b7149` → `7d09c0d` because 001 legitimately changed
> `src/lib/utils/effects.ts` (the `propEffect` intersection re-type this plan
> copies) and the 13.2.0 bump changed `package.json`. Both now match the
> "Current state" excerpts below.
>
> **Drift check (run first)**:
> `git diff --stat 7d09c0d..HEAD -- package.json src/lib/utils/effects.ts src/lib/vite.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Precondition**: Plan 001 is DONE (its `typeof x & (…)` re-typing pattern
> and `EffectValues` export are reused here) and `node_modules/motion/dist/es/three.mjs`
> exists (Motion ≥ 13.2.0).

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001-effect-registry-public-api.md
- **Category**: migration
- **Planned at**: commit `7d09c0d`, 2026-09-03 (re-baselined; originally `47b7149`)

## Why this matters

Motion 13.2.0 ships two ready-made effects as separate entrypoints:
`motion/three` (`threeEffect` — Three.js objects, materials, shader uniforms,
TSL uniform nodes) and `motion/vgpu` (`vgpuEffect` — vgpu bindings, scene
nodes, cameras, lights). They are duck-typed (`isObject3D`, `isMaterial`,
uniform shape) and import **nothing** from `three` or `vgpu` at runtime, so
they cost nothing to expose. Today a Svelte consumer would have to add `motion`
as a second dependency to reach them, which breaks the "one dependency"
promise of this package and risks duplicate `motion-dom` copies (and a split
effect registry / frameloop). Exposing `@humanspeak/svelte-motion/three` and
`/vgpu` closes that gap with two small files and two `exports` entries.

## Current state

- `package.json:69-90` — the `exports` map. Only `.`, `./vite`, and four
  `./html/*.svelte` shims exist:

```json
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "svelte": "./dist/index.js"
        },
        "./vite": {
            "types": "./dist/vite.d.ts",
            "default": "./dist/vite.js"
        },
        "./html/Map.svelte": {
            "svelte": "./dist/html/HtmlMap.svelte"
        },
```

- `src/lib/vite.ts` — the existing non-Svelte subpath module. `svelte-package`
  emits every file under `src/lib/` into `dist/`, so `src/lib/three.ts` becomes
  `dist/three.js` + `dist/three.d.ts` automatically (that is how `./vite` works).
- `package.json:65-67` — `"sideEffects": ["**/*.css"]`; a pure re-export module
  is tree-shakeable as-is.
- `src/lib/utils/effects.ts:18` — `EffectValues` (the union of augmented
  value types accepted by our re-typed effects). After Plan 001, `propEffect`
  uses the intersection pattern this plan copies:

```ts
export const propEffect = propEffectCore as typeof propEffectCore &
    ((subject: object, values: EffectValues) => VoidFunction)
```

- Installed upstream entrypoints (verified at plan time):
  - `node_modules/motion/dist/three.d.ts:29` —
    `export { type ThreeEffectValues, type ThreeUniform, type ThreeUniforms, threeEffect };`
  - `node_modules/motion/dist/vgpu.d.ts` — exports `vgpuEffect` and `type VGPUEffectValues`.
  - `grep -c "from 'three'" node_modules/motion/dist/es/three.mjs` → `0`
    (no runtime dependency on `three`); both modules import only from
    `framer-motion/dom`.
  - `motion`'s `package.json` maps `./three` and `./vgpu` with `types`,
    `import`, `require` conditions, so `import … from 'motion/three'` resolves
    under this repo's `moduleResolution`.
- `tests/consumer-vite6/verify.mjs` — SSR smoke test of the root import only;
  it does not enumerate subpaths and needs no change.
- Test conventions: `src/**/*.spec.ts` (node project). Re-export identity is
  asserted with `expect(ours).toBe(upstream)` — see `src/lib/utils/animateValue.spec.ts:21-23`.

## Commands you will need

| Purpose            | Command                                              | Expected on success                  |
| ------------------ | ---------------------------------------------------- | ------------------------------------ |
| Typecheck          | `pnpm check`                                         | `0 ERRORS`                           |
| Unit (new specs)   | `pnpm exec vitest run src/lib/three.spec.ts src/lib/vgpu.spec.ts` | all pass                |
| All unit           | `pnpm test:only`                                     | all pass                             |
| Package validation | `pnpm package`                                       | publint `All good!`; `dist/three.js`, `dist/three.d.ts`, `dist/vgpu.js`, `dist/vgpu.d.ts` exist |
| Format / lint      | `trunk fmt` then `trunk check`                       | no new findings                      |

## Scope

**In scope**:

- `src/lib/three.ts` (create)
- `src/lib/vgpu.ts` (create)
- `src/lib/three.spec.ts` (create)
- `src/lib/vgpu.spec.ts` (create)
- `package.json` — two `exports` entries only
- `.changeset/three-vgpu-subpaths.md` (create)
- `docs/src/routes/docs/custom-effects/+page.svx` — ONLY if Plan 002 has
  landed: add a short "Three.js and vgpu" section (import snippet + note that
  `three`/`vgpu` are the consumer's own dependencies). Otherwise skip and note it.

**Out of scope**:

- `src/lib/index.ts` — the adapters stay on subpaths (upstream keeps them off
  the root bundle on purpose; keep root tree-shaking untouched).
- Adding `three` or `vgpu` to any `package.json` dependencies — Plan 004
  handles the Three.js example's devDependencies.
- `tests/consumer-vite6/**`.

## Git workflow

- Branch: `feat/three-vgpu-subpaths` (stacked on Plan 001 if unmerged).
- Conventional commit, e.g. `feat: expose motion/three and motion/vgpu effect adapters as subpaths`.
- Do NOT push or open a PR.

## Steps

### Step 1: Failing identity tests

Create `src/lib/three.spec.ts`:

```ts
import { threeEffect as threeEffectCore } from 'motion/three'
import { describe, expect, it } from 'vitest'
import { threeEffect } from './three.js'

describe('subpath: three', () => {
    it("is motion/three's threeEffect (pure re-type, no wrapper)", () => {
        expect(threeEffect).toBe(threeEffectCore)
    })
    it('claims Three.js-shaped subjects and nothing else', () => {
        expect(threeEffect.test({ isObject3D: true })).toBe(true)
        expect(threeEffect.test({ isMaterial: true })).toBe(true)
        expect(threeEffect.test({ progress: { value: 0 } })).toBe(true) // uniforms object
        expect(threeEffect.test({ x: 1 })).toBe(false)
    })
})
```

Create `src/lib/vgpu.spec.ts` with the identity test against `motion/vgpu`'s
`vgpuEffect` and `expect(typeof vgpuEffect.test).toBe('function')`.

**Verify**: `pnpm exec vitest run src/lib/three.spec.ts src/lib/vgpu.spec.ts`
→ both suites FAIL with `Cannot find module './three.js'` (and `./vgpu.js`).

### Step 2: Create the subpath modules

`src/lib/three.ts`:

```ts
import { threeEffect as threeEffectCore } from 'motion/three'
import type { EffectValues } from './utils/effects.js'

export type { ThreeEffectValues, ThreeUniform, ThreeUniforms } from 'motion/three'

/**
 * Motion 13.2's Three.js adapter, re-typed to accept this library's augmented
 * motion values. Identical to `motion/three`'s `threeEffect` at runtime.
 *
 * Claims `Object3D`s, materials and uniforms objects (`{ key: { value } }`).
 * Register it once with `animate.addEffect(threeEffect)` so `animate(mesh,
 * { x: 2, rotateY: Math.PI })` works, or bind values manually with
 * `threeEffect(mesh, { x, rotateY })`. Writes land in `frame.preRender`,
 * ahead of render loops scheduled with `frame.render`. `three` itself is the
 * consumer's dependency — this module never imports it.
 *
 * @example
 * ```ts
 * import { animate } from '@humanspeak/svelte-motion'
 * import { threeEffect } from '@humanspeak/svelte-motion/three'
 *
 * animate.addEffect(threeEffect)
 * animate(mesh, { rotateY: Math.PI * 2 }, { duration: 2 })
 * ```
 */
export const threeEffect = threeEffectCore as typeof threeEffectCore &
    ((subject: object, values: EffectValues) => VoidFunction)
```

`src/lib/vgpu.ts` — same shape for `vgpuEffect` / `type VGPUEffectValues`
from `'motion/vgpu'`, with JSDoc noting it targets vgpu shared uniforms,
`Effect`/`Draw`/`Compute` bindings (`"params.time"`), scene nodes, cameras,
lights, materials and orbit controls, and that `vgpu` is pre-1.0.

**Verify**: `pnpm check` → `0 ERRORS`; the Step 1 specs → all pass.

### Step 3: Publish the subpaths

In `package.json` `exports`, after the `./vite` entry add:

```json
        "./three": {
            "types": "./dist/three.d.ts",
            "default": "./dist/three.js"
        },
        "./vgpu": {
            "types": "./dist/vgpu.d.ts",
            "default": "./dist/vgpu.js"
        },
```

**Verify**: `pnpm package` → `All good!` and
`ls dist/three.js dist/three.d.ts dist/vgpu.js dist/vgpu.d.ts` lists all four.
Then confirm no runtime `three` import leaked: `grep -c "from 'three'" dist/three.js` → `0`.

### Step 4: Changeset, optional docs section, gate

`.changeset/three-vgpu-subpaths.md`:

```md
---
'@humanspeak/svelte-motion': minor
---

Add `@humanspeak/svelte-motion/three` and `/vgpu` subpaths re-exporting Motion 13.2's `threeEffect` and `vgpuEffect`, re-typed for this library's augmented motion values. Register with `animate.addEffect(threeEffect)` to animate Three.js meshes, materials and shader uniforms. `three` / `vgpu` remain your own dependencies; nothing is added to the root bundle.
```

If `docs/src/routes/docs/custom-effects/+page.svx` exists (Plan 002 done), add
before "Related":

````md
## Three.js and vgpu

Motion ships adapters for Three.js and vgpu. Import them from this package's subpaths — `three`/`vgpu` stay your own dependencies:

```ts
import { animate } from '@humanspeak/svelte-motion'
import { threeEffect } from '@humanspeak/svelte-motion/three'

animate.addEffect(threeEffect)
animate(mesh, { rotateY: Math.PI * 2, scaleX: 1.4 }, { type: 'spring' })
animate(material.uniforms, { progress: 1 })
```
````

Run `trunk fmt`, then the full gate.

**Verify**: `pnpm check` → `0 ERRORS`; `pnpm test:only` → all pass;
`trunk check` → no new findings; `pnpm package` → `All good!`.

## Test plan

- Step 1 is the red anchor (module missing) → green after Step 2.
- Unit: identity with upstream; `test()` claim matrix for three; `test` exists
  for vgpu. Pattern: `src/lib/utils/animateValue.spec.ts`.
- Packaging: publint + file existence + no `three` import in `dist/three.js`.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/three.spec.ts src/lib/vgpu.spec.ts` → all pass
- [ ] `pnpm check` → `0 ERRORS`; `pnpm test:only` → all pass
- [ ] `pnpm package` → `All good!`; `dist/three.{js,d.ts}` and `dist/vgpu.{js,d.ts}` exist
- [ ] `grep -n '"./three"' package.json` and `grep -n '"./vgpu"' package.json` each match
- [ ] `grep -c "from 'three'" dist/three.js` → `0`
- [ ] `.changeset/three-vgpu-subpaths.md` exists
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] Status row updated in the batch `README.md`

## STOP conditions

- `import … from 'motion/three'` fails to resolve under `pnpm check` (the
  `motion` exports map differs from what this plan recorded).
- `pnpm package` / publint flags the new subpaths (e.g. missing `svelte`
  condition) — report the exact message rather than guessing a fix.
- `dist/three.js` contains an import from `three`.
- `threeEffect.test({ isObject3D: true })` is `false` — upstream's claim logic
  changed; report.

## Maintenance notes

- On future `motion` bumps, re-run `grep -nE '^export' node_modules/motion/dist/three.d.ts`
  and mirror any new named exports here.
- If upstream ever adds a runtime `three` import, this subpath would need
  `three` as an optional peer dependency — the Step 3 grep is the tripwire.
- Root barrel stays adapter-free by design; do not "helpfully" re-export
  `threeEffect` from `src/lib/index.ts`.
