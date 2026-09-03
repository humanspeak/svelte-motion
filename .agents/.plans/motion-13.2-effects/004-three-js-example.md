# Plan 004: Three.js flagship example — `animate(mesh, …)` and shader uniforms via `threeEffect`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/motion-13.2-effects/README.md`) — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 47b7149..HEAD -- package.json docs/package.json pnpm-workspace.yaml src/routes/+page.svelte docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts README.md`
> On any in-scope drift, compare against "Current state" before proceeding;
> on a mismatch, STOP.
>
> **Preconditions**: Plans 002 and 003 are DONE
> (`ls src/lib/three.ts docs/src/routes/docs/custom-effects/+page.svx` succeeds).

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (adds `three` as a dev dependency in two packages; WebGL in headless CI)
- **Depends on**: 002-custom-effects-demo-docs.md, 003-three-vgpu-subpath-exports.md
- **Category**: direction
- **Planned at**: commit `47b7149`, 2026-09-03

## Why this matters

`threeEffect` is the visible payoff of Motion 13.2 and the demo upstream leads
with: a spring-animated mesh and a shader `progress` uniform driven by the same
`animate()` call used for DOM. Without a live example the subpath from Plan 003
is an invisible feature. The "WOW" to recreate is upstream's
`dev/html/three-effects.html`: a torus knot whose surface ripples as a uniform
animates, while `x`/`rotateY`/`scale` shorthands move the mesh — no
`requestAnimationFrame` bookkeeping in user code beyond one render loop.

## Current state

- `src/lib/three.ts` (from Plan 003) — `threeEffect` re-typed; `test` claims
  `isObject3D` / `isMaterial` / uniforms objects; shorthands `x y z rotateX
  rotateY rotateZ scaleX scaleY scaleZ` map to `position/rotation/scale`;
  writes run in `frame.preRender`.
- Neither `package.json` nor `docs/package.json` lists `three` (verified
  `grep -n '"three"' package.json docs/package.json` → no match).
- `pnpm-workspace.yaml:16` enforces `minimumReleaseAge: 2880` (48 h). At plan
  time `three@0.185.1` (published 2026-07-01) and `@types/three@0.185.4`
  (published 2026-08-04) are both well past the cutoff.
- `src/routes/+page.svelte:290-302` — "Vanilla Values" section, where Plan 002
  added the custom-effect link.
- Docs exemplars: Plan 002's `docs/src/routes/docs/custom-effects/`,
  `docs/src/routes/examples/custom-effects/`, and
  `docs/src/lib/examples/custom-effects/demos/Default.svelte`.
- `docs/src/lib/docsNav.ts` — "Motion values" section (Plan 002 added
  `Custom effects` after `Vanilla values`; `Box` is already imported from
  `@lucide/svelte`).
- `docs/src/lib/examplesIndex.ts` — `EXAMPLES` map.

Upstream's demo, condensed (tag v13.2.0, `dev/html/src/three-effects.js`);
this is the scene to reproduce:

```js
import { animate, motionValue, transformValue } from 'motion'
import { threeEffect } from 'motion/three'
import * as THREE from 'three'

animate.addEffect(threeEffect)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
camera.position.z = 6

const uniforms = { progress: { value: 0 } }
const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
        uniform float progress; varying vec3 vNormal;
        void main() {
            vNormal = normal;
            float wave = sin((position.y + progress) * 8.0) * progress * 0.12;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * wave, 1.0);
        }`,
    fragmentShader: `
        uniform float progress; varying vec3 vNormal;
        void main() {
            vec3 purple = vec3(0.49, 0.23, 0.93); vec3 cyan = vec3(0.13, 0.83, 0.93);
            float light = dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 1.0)));
            gl_FragColor = vec4(mix(purple, cyan, progress) * (0.7 + light * 0.4), 1.0);
        }`
})
const mesh = new THREE.Mesh(new THREE.TorusKnotGeometry(0.9, 0.28, 160, 24), material)
scene.add(mesh)

const x = motionValue(0), rotateY = motionValue(0), progress = motionValue(0)
const scale = transformValue(() => 0.9 + progress.get() * 0.3)
threeEffect(mesh, { x, rotateY, scale })
threeEffect(uniforms, { progress })

frame.render(() => renderer.render(scene, camera), true)  // keep-alive loop
```

Repo conventions: demo routes destroy their values in a cleanup `$effect`,
expose `data-testid` readouts for Playwright, and never import heavy libraries
at module top level in docs demos — use `await import('three')` inside
`onMount` so the docs bundle and the `/examples` index stay light.

## Commands you will need

| Purpose             | Command                                                              | Expected on success             |
| ------------------- | -------------------------------------------------------------------- | ------------------------------- |
| Add root dev deps   | `pnpm add -w -D three@^0.185.1 @types/three@^0.185.4`                | exit 0, lockfile updated        |
| Add docs dev deps   | `pnpm --filter ./docs add -D three@^0.185.1 @types/three@^0.185.4`   | exit 0                          |
| Typecheck           | `pnpm check` / `cd docs && pnpm check`                               | `0 ERRORS`                      |
| Build lib for docs  | `pnpm build`                                                         | exit 0                          |
| e2e                 | `pnpm exec playwright test e2e/effects --reporter=line`              | all pass                        |
| Docs build          | `cd docs && pnpm build`                                              | exit 0                          |
| Format / lint       | `trunk fmt` then `trunk check`                                       | no new findings                 |

Port 4198 rule: if occupied, run e2e with `PW_REUSE_SERVER=1`; never kill it.

## Scope

**In scope**:

- `package.json`, `docs/package.json`, `pnpm-lock.yaml` — dev dependencies only
- `src/routes/tests/effects/three/+page.svelte` (create)
- `src/routes/+page.svelte` (one link)
- `e2e/effects/three.spec.ts` (create)
- `docs/src/lib/examples/three-effect/demos/Default.svelte` (create)
- `docs/src/routes/examples/three-effect/+page.svelte`, `+page.ts` (create)
- `docs/src/routes/docs/three-effect/+page.svx`, `+page.ts` (create)
- `docs/src/lib/docsNav.ts`, `docs/src/lib/examplesIndex.ts`
- `docs/src/routes/docs/custom-effects/+page.svx` (one "Related" link)
- `README.md` (one table row)

**Out of scope**:

- `src/lib/**` — if the example needs a library change, STOP.
- `dependencies`/`peerDependencies` — `three` must never become a runtime or
  peer dependency of the package.
- vgpu example — rejected for this batch (see README).

## Git workflow

- Branch: `feat/three-effect-example` (stacked on Plans 002/003 if unmerged).
- Conventional commit, e.g. `docs: Three.js threeEffect example, demo route and e2e`.
- Do NOT push or open a PR.

## Steps

### Step 1: Add dev dependencies

Run the two `pnpm add` commands from the table. Confirm `three` lands under
`devDependencies` in both manifests and nowhere else.

**Verify**: `grep -n '"three"' package.json docs/package.json` → one
`devDependencies` match each; `git diff --stat pnpm-lock.yaml` shows changes;
`pnpm install --frozen-lockfile` → exit 0.

### Step 2: Demo route

Create `src/routes/tests/effects/three/+page.svelte`:

- `onMount(async () => { const THREE = await import('three'); … })` builds the
  upstream scene above against a `<canvas data-testid="three-canvas">`.
  Wrap `new THREE.WebGLRenderer(…)` in `try/catch`; on failure set
  `rendererAvailable = false` and skip the render loop — the motion values and
  effect bindings must still run so the e2e stays deterministic without WebGL.
- Register `animate.addEffect(threeEffect)` and bind
  `threeEffect(uniforms, { progress })` for the uniform; animate the mesh with
  `animate(mesh, { x: 1.5, rotateY: Math.PI * 2 }, { type: 'spring', stiffness: 80, damping: 12 })`
  (the registry path) from a `data-testid="move"` button, and
  `animate(progress, 1, { duration: 1 })` from `data-testid="ripple"`.
- Readouts driven from a `frame.update` subscription (or `mesh.rotation.y` read
  in the render loop): `<output data-testid="rotate-y">` and
  `<output data-testid="progress">`, both `toFixed(2)`.
- Cleanup: cancel the keep-alive frame, `animate.removeEffect(threeEffect)`,
  unbind the effect, `renderer?.dispose()`, `geometry.dispose()`, `material.dispose()`.

Link it from `src/routes/+page.svelte` in the "Vanilla Values" list:
`Three.js effect (animate(mesh) + shader uniform via threeEffect)` →
`/tests/effects/three`.

**Verify**: `pnpm check` → `0 ERRORS`; `pnpm dev`, open `/tests/effects/three`:
"move" springs the knot right while spinning; "ripple" makes the surface wave
and shifts purple → cyan.

### Step 3: Playwright coverage

Create `e2e/effects/three.spec.ts` (pattern: `e2e/effects/custom-effect.spec.ts`):

- goto `/tests/effects/three?@isPlaywright=true`; wait for `move` to be enabled
  (set `disabled` until the dynamic import resolves).
- "animate(mesh) through the registry rotates the mesh": click `move`;
  `expect.poll(rotate-y as number, { timeout: 4000 }).toBeCloseTo(6.28, 1)`.
- "uniform progress animates to 1": click `ripple`; poll `progress` → `toBe('1.00')`.
- Assert on readouts only — never on pixels; the test must pass with
  `rendererAvailable === false`.

**Verify**: `pnpm exec playwright test e2e/effects --reporter=line` → all pass
(Plan 002's 3 + these 2).

### Step 4: Docs example, page, nav, index

- `docs/src/lib/examples/three-effect/demos/Default.svelte`: the same scene,
  styled with the `.dk-demo-shell` / `.strip` / `.micro` conventions from
  `custom-effects/demos/Default.svelte`; a "move" button and a `progress` range
  input; dynamic `import('three')` in `onMount`; show a short "WebGL unavailable"
  `.micro` note if the renderer fails.
- `docs/src/routes/examples/three-effect/+page.ts` + `+page.svelte`: one
  `ExampleV2` section (`tag: 'THREE'`, barCells `api: threeEffect`,
  `input: animate.addEffect`, `mode: live`),
  `demoCodeSample('three-effect/demos/Default.svelte', 'three-effect-default', 'Default.svelte')`.
- `docs/src/routes/docs/three-effect/+page.ts` + `+page.svx`: SEO block
  (`ogSlug: 'docs-three-effect'`), import snippet from
  `@humanspeak/svelte-motion/three`, a table of claimed subjects (`Object3D`,
  materials, uniforms objects, TSL uniform nodes) and shorthand keys
  (`x y z rotateX rotateY rotateZ scaleX scaleY scaleZ`, plus colour keys on
  materials), the `frame.preRender` write-timing note, and "Related" links to
  `/docs/custom-effects` and `/examples/three-effect`. Footer: based on
  Motion 13.2's `motion/three`.
- `docsNav.ts`: after `Custom effects` add
  `{ title: 'Three.js effect', href: '/docs/three-effect', icon: Box }`.
- `examplesIndex.ts`: add `'three-effect': { title: 'Three.js Effect', description: 'Spring a mesh and ripple a shader uniform with animate() and threeEffect.' }`.
- `custom-effects/+page.svx` "Related": add the `/docs/three-effect` link.
- `README.md`: add row `| Three.js / vgpu adapters (\`/three\`, \`/vgpu\` subpaths) | Supported |`.

**Verify**: `pnpm build` then `cd docs && pnpm check && pnpm build` → exit 0;
`cd docs && pnpm dev`, `/examples/three-effect` and `/docs/three-effect`
render; `/examples` index shows the new card (if not, apply Plan 002 Step 4's
sitemap-manifest check).

### Step 5: Gate

`trunk fmt`; then `pnpm check`, `pnpm test:only`,
`pnpm exec playwright test e2e/effects --reporter=line`, `trunk check`,
`cd docs && pnpm check && pnpm build`.

**Verify**: all exit 0 / `0 ERRORS` / no new findings.

## Test plan

- Net-new example: no red-first unit test. The e2e spec (Step 3) is the anchor
  and asserts on numeric readouts so it is independent of WebGL availability.
- Docs typecheck and build gate the example page.

## Done criteria

- [ ] `three` and `@types/three` appear only under `devDependencies` in `package.json` and `docs/package.json`
- [ ] `pnpm exec playwright test e2e/effects --reporter=line` → 5 passed
- [ ] `/tests/effects/three` linked from `src/routes/+page.svelte`
- [ ] `docs/src/routes/docs/three-effect/+page.svx` and `docs/src/routes/examples/three-effect/+page.svelte` exist; nav + examples index entries present
- [ ] `grep -n "three-effect" docs/src/routes/docs/custom-effects/+page.svx` → match
- [ ] `pnpm check`, `cd docs && pnpm check`, `cd docs && pnpm build` all clean
- [ ] `grep -n "Three.js" README.md` → one table row
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] Status row updated in the batch `README.md`

## STOP conditions

- `pnpm add` rejects `three`/`@types/three` (release-age guard or peer
  conflict) — report the message; do not edit `pnpm-workspace.yaml`.
- `animate(mesh, …)` does not move the mesh although `threeEffect.test(mesh)`
  is `true` — a registry-order or timing issue in the library; report.
- Headless Chromium fails the e2e even with the renderer disabled — the
  readouts, not WebGL, are broken; report rather than loosening assertions.
- Docs build output grows by more than ~50 KB gzip on the `/examples` index
  route (check `cd docs && pnpm build` output) — the dynamic import is not
  splitting; report.
- Any step appears to require `src/lib/**` changes.

## Maintenance notes

- `three` is dev-only in two places; Renovate/Dependabot bumps must keep it
  out of `dependencies`. The subpath (`src/lib/three.ts`) must keep importing
  nothing from `three`.
- The demo reads mesh state for readouts; if upstream changes shorthand
  mapping (e.g. `rotateY` → quaternion), update the docs table and e2e tolerance.
- A vgpu example was deliberately deferred (vgpu is a 0.3.x scaffold package);
  revisit when it reaches 1.0.
