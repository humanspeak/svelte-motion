# Plan 002: Ship a custom-effects demo page, e2e, docs page, and docs example

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in the `README.md` that sits alongside this plan file
> (`.agents/.plans/motion-13.2-effects/README.md`) — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 47b7149..HEAD -- src/routes/+page.svelte docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts docs/src/routes/docs/vanilla-values/+page.svx README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Precondition**: Plan 001 is DONE (`grep -n "createEffect, MotionValueState" src/lib/index.ts`
> returns a match and `pnpm check` is clean). Do not start otherwise.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 001-effect-registry-public-api.md
- **Category**: docs
- **Planned at**: commit `47b7149`, 2026-09-03

## Why this matters

Plan 001 makes `createEffect` + `animate.addEffect` available, but this repo's
definition of "done" for a feature (see `CLAUDE.md`, "New feature checklist")
is: a test/demo route under `src/routes/tests/`, linked from the test index,
Playwright coverage, a docs page, and a docs example with a reusable demo
component. Without those the API is invisible to users and unprotected against
regressions. This plan delivers the DOM-free "WOW": a plain JavaScript object
drawn onto a `<canvas>` by a custom effect, animated with the exact same
`animate()` call users already know.

## Current state

Files and roles:

- `src/routes/+page.svelte` — index of test/demo routes; sections are
  `<div><h2 …>Title</h2><ul>…</ul></div>`. The "Vanilla Values" section is at
  lines 290–302:

```svelte
        <div>
            <h2 class="mb-3 text-xl font-medium">Vanilla Values</h2>
            <ul class="list-disc space-y-2 pl-5">
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/vanilla-values') + searchParams}
                    >
                        Vanilla motion values (styleEffect, toMotionValue, no components)
                    </a>
                </li>
            </ul>
        </div>
```

- `src/routes/tests/vanilla-values/+page.svelte` — exemplar test page (plain
  DOM + `styleEffect`, values destroyed in a cleanup `$effect`, `data-testid`
  hooks for Playwright).
- `e2e/vanilla-values/basic.spec.ts` — exemplar e2e: `page.goto('/tests/…?@isPlaywright=true')`,
  `expect.poll(...)` on measured values.
- `docs/src/lib/docsNav.ts:98-115` — the "Motion values" nav section; the
  entry to extend:

```ts
            { title: 'Vanilla values', href: '/docs/vanilla-values', icon: Zap },
```

  `Wand` is already imported from `@lucide/svelte` at the top of the file.
- `docs/src/routes/docs/arc/+page.svx` + `+page.ts` — exemplar docs page
  (frontmatter, `getSeoContext()` block, `<Example isSmall exampleUrl=…>`,
  options table, "Related" links, upstream attribution footer).
- `docs/src/routes/examples/arc/+page.svelte` + `+page.ts` — exemplar example
  page built from `ExampleV2` sections with `demoCodeSample(...)`.
- `docs/src/lib/examples/arc/demos/*.svelte` — exemplar demo components.
- `docs/src/lib/examples/vanilla-values/demos/Default.svelte` — exemplar demo
  styling (`.dk-demo-shell` wrapper, `.strip`/`.micro` classes, CSS vars
  `--brut-mono`, `--brut-ink-3`).
- `docs/src/lib/examplesIndex.ts` — `EXAMPLES: Record<string, ExampleEntry>`
  keyed by example slug; entry shape `{ title, description }` (see `'vanilla-values'`
  at lines 157–161). Demo code loaders (`docs/src/lib/demo-loaders.ts`) are
  **generated** by docs-kit's `demoManifestPlugin` from files under
  `docs/src/lib/examples/**` — do not edit that file by hand.
- `docs/src/routes/docs/vanilla-values/+page.svx:96-109` — "Element effects"
  section; `:133-139` — "Related" list.
- `README.md:51` — feature table row
  `| Vanilla values (\`motionValue\`, \`styleEffect\`, \`toMotionValue\` bridge) | Supported |`.

Upstream reference for the demo behaviour (tag v13.2.0 in `~/Github/motion`,
if available): `packages/motion-dom/src/animation/animate/__tests__/effects.test.ts`
and `dev/html/src/three-effects.js`. The essential pattern, inlined:

```ts
import { animate, createEffect, frame, motionValue } from '@humanspeak/svelte-motion'

type Dial = { angle: number; radius: number }

// One effect per subject *type*. `test` claims subjects, `read` seeds the
// initial keyframe, `step` picks the frameloop phase for writes.
export const dialEffect = createEffect<Dial>(
    (dial, state, key, value) =>
        state.set(key, value, () => { (dial as Record<string, number>)[key] = state.latest[key] as number }, undefined, false),
    {
        test: (s): s is Dial => typeof s === 'object' && s !== null && 'angle' in s && 'radius' in s,
        read: (dial, key) => (dial as Record<string, number>)[key],
        step: frame.preRender // write before the canvas draw scheduled in frame.render
    }
)

animate.addEffect(dialEffect)
animate(dial, { angle: 270, radius: 80 }, { type: 'spring', stiffness: 120, damping: 14 })
```

Docs must be reviewed against the **built** library: the docs app consumes
`dist/`, so run `pnpm build` at the repo root before `cd docs && pnpm dev`, and
clear `docs/node_modules/.vite` if a stale build is served.

## Commands you will need

| Purpose             | Command                                                         | Expected on success                     |
| ------------------- | --------------------------------------------------------------- | --------------------------------------- |
| Build lib for docs  | `pnpm build`                                                    | exit 0, publint `All good!`             |
| Typecheck lib       | `pnpm check`                                                    | `0 ERRORS`                              |
| Typecheck docs      | `cd docs && pnpm check`                                         | `0 ERRORS`                              |
| Build docs          | `cd docs && pnpm build`                                         | exit 0                                  |
| e2e (new spec only) | `pnpm exec playwright test e2e/effects --reporter=line`         | all pass                                |
| Unit               | `pnpm test:only`                                                | all pass                                |
| Format / lint       | `trunk fmt` then `trunk check`                                  | no new findings                         |

Playwright's `webServer` builds and serves on port **4198**. If something is
already listening there (the operator's sign-off browser), do NOT kill it —
run with `PW_REUSE_SERVER=1` instead (see `playwright.config.ts:15-30`).

## Scope

**In scope**:

- `src/routes/tests/effects/custom-effect/+page.svelte` (create)
- `src/routes/tests/effects/dialEffect.ts` (create — the effect, shared by the route and the docs demo copy)
- `src/routes/+page.svelte` (add one link)
- `e2e/effects/custom-effect.spec.ts` (create)
- `docs/src/routes/docs/custom-effects/+page.svx`, `+page.ts` (create)
- `docs/src/routes/examples/custom-effects/+page.svelte`, `+page.ts` (create)
- `docs/src/lib/examples/custom-effects/demos/Default.svelte` (create)
- `docs/src/lib/examples/custom-effects/demos/dialEffect.ts` (create — docs copy; docs cannot import from `src/routes`)
- `docs/src/lib/docsNav.ts`, `docs/src/lib/examplesIndex.ts`
- `docs/src/routes/docs/vanilla-values/+page.svx` (one "Related" link + one sentence in "Element effects")
- `README.md` (one table row)

**Out of scope**:

- `src/lib/**` — the API landed in Plan 001; if the demo needs a library change, STOP.
- `docs/src/lib/demo-loaders.ts` — generated.
- `docs/src/lib/compare-data.ts` — comparison copy is maintained by the
  competitive-intel routine.
- Three.js — Plans 003/004.

## Git workflow

- Branch: `feat/custom-effects-docs` (stacked on Plan 001's branch if it has not merged).
- Conventional commits, e.g. `docs: custom effects demo, e2e and docs page`.
- Do NOT push or open a PR — the operator signs off on the live demo first.

## Steps

### Step 1: Build the demo route

Create `src/routes/tests/effects/dialEffect.ts` exporting `type Dial` and
`dialEffect` as in "Current state" (Google-style JSDoc on both). Create
`src/routes/tests/effects/custom-effect/+page.svelte`:

- A `<canvas data-testid="dial-canvas" width=240 height=240>` and a plain
  object `const dial: Dial = { angle: 0, radius: 40 }` (module-level `const`,
  not `$state` — the point is that Motion drives a non-reactive object).
- `onMount`: `animate.addEffect(dialEffect)`; schedule a draw with
  `frame.render(draw, true)` (keep-alive) that renders an arc from `0` to
  `dial.angle` degrees with radius `dial.radius`; return cleanup that calls
  `cancelFrame(draw)` and `animate.removeEffect(dialEffect)`.
- Two buttons: `data-testid="open"` → `animate(dial, { angle: 270, radius: 80 }, { type: 'spring', stiffness: 120, damping: 14 })`;
  `data-testid="reset"` → `animate(dial, { angle: 0, radius: 40 }, { duration: 0.3 })`.
- A readout `<output data-testid="angle">` updated from the effect's bound
  value: after registering, `dialEffect.get(dial, 'angle')?.on('change', …)`
  — but that value only exists after the first `animate()` call, so subscribe
  lazily inside the button handler (this also demonstrates `.get()`).
  Simpler and acceptable: update the readout inside `draw` with
  `Math.round(dial.angle)`.
- A second card proving the fallback: `animate(plainBox, { x: 100 })` on an
  object no effect claims, mirrored into `<output data-testid="plain-x">`.

Add the link to `src/routes/+page.svelte` inside the "Vanilla Values" `<ul>`:

```svelte
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/effects/custom-effect') + searchParams}
                    >
                        Custom effects (createEffect + animate.addEffect on a canvas dial)
                    </a>
                </li>
```

**Verify**: `pnpm check` → `0 ERRORS`; `pnpm dev` and open
`/tests/effects/custom-effect` — clicking "open" sweeps the arc; "reset" returns it.

### Step 2: Playwright coverage

Create `e2e/effects/custom-effect.spec.ts` modelled on
`e2e/vanilla-values/basic.spec.ts`:

- `beforeEach`: goto `/tests/effects/custom-effect?@isPlaywright=true`, wait for `dial-canvas`.
- test "animate() drives an effect-claimed object": click `open`;
  `expect.poll(() => readout angle text as number).toBeGreaterThan(200)`;
  then settle `toBe(270)` (poll, timeout 3000).
- test "reset animates back": click `open`, wait until > 200, click `reset`,
  poll `angle` `toBe(0)`.
- test "objects no effect claims still animate": click the plain-box trigger,
  poll `plain-x` `toBe(100)`.

**Verify**: `pnpm exec playwright test e2e/effects --reporter=line` → 3 passed.

### Step 3: Docs page

Create `docs/src/routes/docs/custom-effects/+page.ts` (copy `docs/arc/+page.ts`,
title `Custom effects`, description
`Drive any object with animate() — createEffect, animate.addEffect and MotionValueState.`)
and `+page.svx` following `docs/src/routes/docs/arc/+page.svx` exactly in
structure: frontmatter, SEO block (`ogSlug: 'docs-custom-effects'`,
`ogFeatures: ['createEffect', 'animate.addEffect', 'Non-DOM subjects', 'Motion 13.2']`),
intro, `<Example isSmall exampleUrl="/examples/custom-effects"><Default /></Example>`,
then sections:

1. **Writing an effect** — `createEffect(addValue, { test, read, step })`, the
   `state.set(key, value, render, computed, useDefaultValueType)` call, and a
   table of the three options (`test`: claims subjects for `animate()`; `read`:
   seeds the first keyframe, return `undefined` to require `[from, to]`;
   `step`: frameloop phase, default `frame.render`, use `frame.preRender` when
   a render loop runs in `frame.render`).
2. **Registering with animate** — `animate.addEffect` / `removeEffect`; most
   recently added wins; DOM elements are never claimed; plain objects fall back
   to the object animator.
3. **Binding values manually** — `effect(subject, { x })` returns an unbind;
   `effect.get(subject, 'x')` returns the bound value; `propEffect` gets the
   same `.get`.
4. **Related** — `/docs/vanilla-values`, `/examples/custom-effects`, and
   (once Plan 004 lands) `/docs/three-effect`.
5. Footer: `Based on Motion 13.2's [animate.addEffect](https://motion.dev/docs/animate) and createEffect.`

Add the nav item in `docs/src/lib/docsNav.ts` directly after the
"Vanilla values" item:

```ts
            { title: 'Custom effects', href: '/docs/custom-effects', icon: Wand },
```

**Verify**: `cd docs && pnpm check` → `0 ERRORS`.

### Step 4: Docs example + demo component

- Copy `src/routes/tests/effects/dialEffect.ts` to
  `docs/src/lib/examples/custom-effects/demos/dialEffect.ts` (imports from
  `@humanspeak/svelte-motion`).
- Create `docs/src/lib/examples/custom-effects/demos/Default.svelte`: same dial
  as Step 1, styled like `vanilla-values/demos/Default.svelte` (`.dk-demo-shell`
  wrapper with the `<!-- dk-strip -->` comment, `.strip`, `.micro` readouts),
  a range input driving `animate(dial, { angle })` on `input`, and a
  spring-animated "open" button.
- Create `docs/src/routes/examples/custom-effects/+page.ts` and
  `+page.svelte` modelled on `examples/arc/+page.svelte` with ONE section
  (`figId: 'FIG-001'`, `tag: 'EFFECT'`, `barCells` `api: createEffect`,
  `input: animate.addEffect`, `mode: live`), `demoCodeSample('custom-effects/demos/Default.svelte', 'custom-effects-default', 'Default.svelte')`,
  `sourceUrl` pointing at the demo file on GitHub `main`.
- Add to `docs/src/lib/examplesIndex.ts` (alphabetical position):

```ts
    'custom-effects': {
        title: 'Custom Effects',
        description:
            'Animate any JavaScript object — a canvas dial driven by createEffect and animate.addEffect.'
    },
```

**Verify**: `pnpm build` (root) then `cd docs && pnpm check && pnpm build`
→ both exit 0. `cd docs && pnpm dev`, open `/examples/custom-effects` and
`/docs/custom-effects`: demo renders, "show code" displays the demo source.
If the example card is missing from `/examples`, find how
`docs/src/lib/sitemap-manifest.json` is produced (`grep -rn "sitemap-manifest" docs --include=*.ts --include=*.js --include=*.json -l | grep -v node_modules`)
and run that generator; if it is not a local script, STOP and report.

### Step 5: Cross-links and README

- `docs/src/routes/docs/vanilla-values/+page.svx`: in "Element effects" add
  the sentence `Need to drive something that isn't an element? See [Custom effects](/docs/custom-effects).`
  and add `- [Custom effects](/docs/custom-effects) — createEffect and animate.addEffect for non-DOM subjects`
  to "Related".
- `README.md`: after the "Vanilla values" row add
  `| Custom effects (\`createEffect\`, \`animate.addEffect\`, Motion 13.2)       | Supported                                  |`
  (keep column alignment; `trunk fmt` will normalise).

**Verify**: `trunk fmt` then `trunk check` → no new findings.

### Step 6: Full gate

**Verify**: `pnpm check` → `0 ERRORS`; `pnpm test:only` → all pass;
`pnpm exec playwright test e2e/effects e2e/vanilla-values --reporter=line` → all pass;
`cd docs && pnpm check && pnpm build` → exit 0.

## Test plan

- Net-new demo/docs: no red-first unit test (no existing behaviour changes).
  The e2e spec in Step 2 is the anchor and must pass on first green run.
- e2e cases: effect-claimed object reaches target; reset returns to 0; plain
  object fallback reaches 100. Pattern: `e2e/vanilla-values/basic.spec.ts`.
- Docs typecheck/build act as the docs regression gate.

## Done criteria

- [ ] `src/routes/tests/effects/custom-effect/+page.svelte` exists and is linked from `src/routes/+page.svelte`
- [ ] `pnpm exec playwright test e2e/effects --reporter=line` → 3 passed
- [ ] `docs/src/routes/docs/custom-effects/+page.svx` and `docs/src/routes/examples/custom-effects/+page.svelte` exist
- [ ] `grep -n "custom-effects" docs/src/lib/docsNav.ts docs/src/lib/examplesIndex.ts` → one match each
- [ ] `grep -n "Custom effects" README.md` → one match
- [ ] `pnpm check` and `cd docs && pnpm check` both report `0 ERRORS`; `cd docs && pnpm build` exits 0
- [ ] `trunk check` shows no new findings
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] Status row updated in `.agents/.plans/motion-13.2-effects/README.md`

## STOP conditions

Stop and report back if:

- Plan 001's precondition is not met.
- `animate(dial, …)` on the demo route throws `effect-unreadable-value` or
  animates nothing — the effect `test`/`read` contract differs from this plan.
- The demo needs a change under `src/lib/**`.
- The docs example does not appear on `/examples` after the Step 4 manifest check.
- Port 4198 is occupied and `PW_REUSE_SERVER=1` still fails — never kill that server.

## Maintenance notes

- The dial effect exists in two copies (test route and docs demo) because the
  docs app cannot import from `src/routes`. Keep them identical; the docs copy
  is what users read.
- When Plan 004 lands, add its docs page to this page's "Related" list.
- Reviewer focus: the `frame.render(draw, true)` keep-alive must be cancelled
  on unmount (`cancelFrame`), and `animate.removeEffect` must run in cleanup so
  the global registry does not leak across route navigations.
