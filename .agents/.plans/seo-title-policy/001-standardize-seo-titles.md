# Plan 001: Standardize concise SEO titles across the docs site

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row in
> `.agents/.plans/seo-title-policy/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 31225de..HEAD -- docs/src/routes/+page.svelte docs/src/routes/svelte-animations/+page.svelte docs/src/routes/examples docs/vite.config.ts docs/src/lib/seo-title-policy.spec.ts`
> If an in-scope route changed, compare its live SEO block with the excerpts
> below. A semantic mismatch is a STOP condition; ordinary line-number drift is
> not.

## Status

- **Priority**: P1
- **Effort**: S (mostly mechanical title edits plus one focused test)
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `31225de`, 2026-07-10

## Why this matters

Ahrefs currently reports four titles over its 60-character heuristic, but the
underlying problem is a hand-authored title policy that has already drifted:
59 example detail pages use `| Examples | Svelte Motion`, while the Apple
Intelligence example omits `Examples`. Fixing only the four reported strings
would deepen that inconsistency. The source audit also found a fifth explicit
title over 60 characters at `/svelte-animations` (68 characters), which is not
in the supplied Ahrefs report.

Google does not impose a character limit; it recommends titles that are
descriptive, concise, distinct, and light on repeated boilerplate. Treat 60
characters as an operational guardrail that clears the Ahrefs warning, not as
a ranking rule. Example URLs, breadcrumbs, page copy, and the `/examples`
landing page already communicate the collection, so `Examples` is the least
valuable repeated title segment. After this plan, every example detail page
uses the same `<page-specific subject> | Svelte Motion` contract, while the
landing page naturally remains `Examples | Svelte Motion`.

Reference: Google's current title-link guidance:
<https://developers.google.com/search/docs/appearance/title-link>.

## Current state

### Rendering and build constraints

- `docs/src/routes/+layout.svelte` delegates SEO rendering to docs-kit.
- `@humanspeak/docs-kit` resolves `seo.title` directly into `<title>`,
  `og:title`, and `twitter:title`; title edits therefore affect all three.
- `docs/vite.config.ts:67-78` registers `exampleMirrorsPlugin`, which statically
  parses each example route during dev and build.
- The installed docs-kit parser requires `seo.title` to be a string literal.
  Replacing literals with a helper such as `formatExampleTitle('Pan')` will
  break mirror generation. Keep the assignments as literals in this plan.
- `seo.ogTitle`, `seo.h1`, breadcrumbs, descriptions, and `seo.ogSlug` have
  separate jobs and are already concise. Do not rewrite them merely to mirror
  the `<title>` string.

### Measured inventory at `31225de`

- 61 routes under `docs/src/routes/examples` assign a literal `seo.title`: the
  examples index plus 60 detail pages.
- 59 detail pages end in `| Examples | Svelte Motion` (with a space before the
  first pipe).
- `/examples/ai-glow-border` already ends in `| Svelte Motion`.
- The examples index is `Examples | Svelte Motion` and should remain so.
- Three example detail titles exceed 60 characters: 83, 71, and 71.
- The homepage is 71 characters.
- `/svelte-animations` is 68 characters.

Relevant excerpts:

`docs/src/routes/+page.svelte:25-31`:

```svelte
const seo = getSeoContext()
if (seo) {
    seo.title = 'Svelte Motion · Framer Motion-compatible animation library for Svelte 5'
    seo.description =
        'Framer Motion-compatible animation library for Svelte 5 — motion components, AnimatePresence, gestures, variants, layout, springs, and scroll.'
    seo.ogTitle = 'Svelte Motion'
```

`docs/src/routes/examples/layout-scroll/+page.svelte:22-28`:

```svelte
if (seo) {
    seo.title = 'layoutScroll — FLIP inside scroll containers | Examples | Svelte Motion'
    seo.description =
        'Use layoutScroll to keep FLIP layout animations anchored when the user scrolls the parent container mid-animation. Side-by-side demo of the drift vs the fix.'
    seo.ogTitle = 'layoutScroll'
    seo.h1 = { title: 'layoutScroll', mode: 'sr-only' }
```

`docs/src/routes/examples/ai-glow-border/+page.svelte:22-27` is the current
example-detail exception and the target suffix pattern:

```svelte
if (seo) {
    seo.title = 'Apple Intelligence Glow Border — Svelte | Svelte Motion'
    seo.description =
        'Recreate the Apple Intelligence wavy glow border (the Siri screen-edge glow effect from iOS and macOS) in Svelte — spring physics, feTurbulence noise, and SVG displacement with a Framer Motion-compatible animation library.'
    seo.ogTitle = 'Apple Intelligence Glow Border'
```

Repo conventions:

- Svelte/TypeScript files use four-space indentation and no semicolons.
- Formatting and linting run through Trunk.
- Commit messages are conventional, e.g.
  `fix(docs): render SEO components after children so SSR sees seo state`.
- Generated `docs/static/examples.md`, `docs/static/examples/`, and
  `docs/static/llms*.txt` are ignored. Do not add them to git.

## Title policy to implement

1. **Homepage**: lead with the brand, then the highest-value positioning phrase.
2. **Example index**: retain `Examples | Svelte Motion`.
3. **Every example detail page**: end exactly in `| Svelte Motion`, with a
   single space before the pipe; never use `| Examples | Svelte Motion`.
4. **Other explicit marketing/collection pages**: use a concise, descriptive
   page phrase followed by `| Svelte Motion` when the brand is not already
   leading the title.
5. **Budget**: every literal `seo.title` must be at most 60 JavaScript string
   characters. Prefer roughly 45-55 when the wording remains descriptive.
6. **Do not force false symmetry**: `seo.ogTitle`, the H1, and breadcrumbs may
   be shorter than `<title>`; they must stay topically aligned, not identical.

Exact rewrites for the five over-budget routes:

- `/` (46 characters):
  `Svelte Motion — Framer Motion API for Svelte 5`
- `/svelte-animations` (43 characters):
  `Svelte 5 Animation Patterns | Svelte Motion`
- `/examples/layout-scroll` (56 characters):
  `layoutScroll — FLIP in scroll containers | Svelte Motion`
- `/examples/layout-group` (54 characters):
  `LayoutGroup — scoped layout animations | Svelte Motion`
- `/examples/variants-while-hover` (59 characters):
  `whileHover variants — reuse across gestures | Svelte Motion`

For the other 56 standard example detail titles, preserve the page-specific
subject verbatim and remove only the middle `| Examples` segment plus its
preceding space. Example:

```text
Fancy Like Button | Examples | Svelte Motion
→ Fancy Like Button | Svelte Motion
```

Leave `/examples/ai-glow-border` and the `/examples` index unchanged because
they already comply with the target policy.

## Commands you will need

| Purpose            | Command                                                                                           | Expected on success                                               |
| ------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Format             | `trunk fmt docs/src/routes docs/src/lib/seo-title-policy.spec.ts .agents/.plans/seo-title-policy` | exit 0                                                            |
| Focused test       | `pnpm --filter docs test`                                                                         | all docs unit tests pass                                          |
| Docs typecheck     | `pnpm --filter docs check`                                                                        | 0 errors and 0 warnings                                           |
| Docs build         | `pnpm --filter docs build`                                                                        | exit 0; example mirrors and site build complete                   |
| Lint changed files | `trunk check`                                                                                     | exit 0                                                            |
| Inspect scope      | `git status --short`                                                                              | only in-scope source/test files plus the plan index status change |

## Scope

**In scope** (the only product/test files to modify):

- `docs/src/routes/+page.svelte` — homepage title only.
- `docs/src/routes/svelte-animations/+page.svelte` — title only.
- `docs/src/routes/examples/*/+page.svelte` — `seo.title` string literals only,
  for every detail page that currently uses `| Examples | Svelte Motion`.
- `docs/src/lib/seo-title-policy.spec.ts` — create the regression test described
  below.
- `.agents/.plans/seo-title-policy/README.md` — status update only after all
  done criteria pass.

**Out of scope** (do NOT touch):

- `docs/src/routes/examples/+page.svelte`; its title is already correct.
- `seo.description`, `seo.ogTitle`, `seo.h1`, `seo.ogTagline`,
  `seo.ogFeatures`, `seo.ogSlug`, and breadcrumbs.
- Example content, demo components, public API/library code, docs navigation,
  routes, canonical URLs, structured data, or sitemap behavior.
- `@humanspeak/docs-kit` and `docs/vite.config.ts`; inspect them if needed, but
  do not change the parser or plugin configuration.
- A production title formatter/helper. The mirror plugin requires title
  literals, so abstraction is actively harmful here.
- Pixel-width emulation. The 60-character limit is an Ahrefs compatibility
  guardrail, not a model of every device's SERP rendering.

## Git workflow

- Branch: `fix/docs-seo-title-policy` from a fresh `main`. Do not implement on
  the plan-only branch that introduced this handoff document.
- One logical commit:
  `fix(docs): standardize concise SEO page titles`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add the title-policy regression test before changing titles

Create `docs/src/lib/seo-title-policy.spec.ts` as a server-side Vitest test.
Use Vite's raw glob support to load route sources without compiling page
components:

```ts
const routeSources = import.meta.glob('/src/routes/**/+page.svelte', {
    eager: true,
    import: 'default',
    query: '?raw'
}) as Record<string, string>
```

Extract literal `seo.title` assignments, including the existing two-line
assignment in `variants-while-hover`. Keep the extraction logic test-local;
do not add a production helper. Add focused assertions that:

1. Find explicit titles for `/`, `/svelte-animations`, `/examples`, and all 60
   example detail pages. Fail with route names when an expected title cannot be
   extracted, so a syntax change cannot silently reduce coverage.
2. Every extracted literal `seo.title` is at most 60 characters. Failure output
   must include route, actual length, and title.
3. Every `/examples/<slug>` detail title ends exactly in
   `| Svelte Motion` (preceded by one space) and contains no `| Examples |`
   segment.
4. The `/examples` index remains exactly `Examples | Svelte Motion`.
5. Extracted titles are unique by route (no two routes share the same complete
   title).

Run the focused test now and confirm that it fails for the known current-state
violations: five titles over budget and 59 example detail pages with the old
category segment. If it passes before source edits, the test is not exercising
the intended files; stop and fix the test.

**Verify**: `pnpm --filter docs test` → fails for the known title-policy
violations, with readable route/title diagnostics and no unrelated failure.

### Step 2: Normalize every example detail title

Across `docs/src/routes/examples/*/+page.svelte`:

- Apply the three exact special-case rewrites from the list above.
- For every other title ending in `| Examples | Svelte Motion`, delete only
  `| Examples` and its preceding space.
- Leave the compliant Apple Intelligence title unchanged.
- Do not edit the examples index.
- Preserve literal string assignments so `exampleMirrorsPlugin` can parse them.

Use a mechanical replacement for the common suffix if desired, but inspect the
diff afterward. The diff should show only `seo.title` lines.

**Verify**: run the title-policy test. Its example suffix assertions must pass;
the only remaining failure should be a non-example over-budget title until Step
3 is complete.

### Step 3: Rewrite the homepage and Svelte animations titles

Apply the exact targets:

```text
docs/src/routes/+page.svelte:
seo.title = 'Svelte Motion — Framer Motion API for Svelte 5'

docs/src/routes/svelte-animations/+page.svelte:
seo.title = 'Svelte 5 Animation Patterns | Svelte Motion'
```

Do not alter their descriptions, social-card content, H1 behavior, or analytics.

**Verify**: `pnpm --filter docs test` → all title-policy assertions and all
existing docs unit tests pass.

### Step 4: Verify rendered and generated SEO surfaces

Run formatting, typecheck, build, and lint. The build is important because
`exampleMirrorsPlugin` statically reads the literal SEO fields and emits the
LLM-readable examples mirrors. A passing unit test alone does not prove that
parser still accepts every page.

With the local docs server, inspect these five routes in the controllable
browser and read `document.title`:

- `/`
- `/svelte-animations`
- `/examples/layout-scroll`
- `/examples/layout-group`
- `/examples/variants-while-hover`

Each must exactly match the target list. Inspect one ordinary migrated route,
such as `/examples/fancy-like-button`, and confirm
`Fancy Like Button | Svelte Motion`. No visual screenshot baseline is needed:
this plan changes head metadata only.

**Verify**:

1. `pnpm --filter docs check` → 0 errors and 0 warnings.
2. `pnpm --filter docs build` → exit 0 and mirror generation completes.
3. `trunk fmt docs/src/routes docs/src/lib/seo-title-policy.spec.ts .agents/.plans/seo-title-policy` → exit 0.
4. `trunk check` → exit 0.
5. `git diff --check` → no whitespace errors.

### Step 5: Post-deploy validation

After deployment, request a fresh Ahrefs Site Audit crawl for the affected
routes or the whole site. Confirm the "Title too long" issue count drops to
zero for these pages. This external recrawl is a release follow-up, not a local
merge gate; do not delay the code change waiting for crawler timing.

Monitor Search Console for title-link rewrites and click-through changes after
Google recrawls. Do not claim a ranking improvement from the edit alone.

**Verify**: record the new Ahrefs crawl date and affected-URL count in the PR or
follow-up comment; expected count for these known violations is 0.

## Test plan

- Add one server-side Vitest file:
  `docs/src/lib/seo-title-policy.spec.ts`.
- Cover source discovery, the 60-character operational ceiling, exact example
  suffix policy, preservation of the examples-index title, and uniqueness.
- The regression test must enumerate all current example detail routes through
  `import.meta.glob`, not hard-code only the three warned examples.
- Prove the test catches the pre-fix state before editing strings.
- Run the docs build to exercise docs-kit's literal-field parser.
- Browser-check the six rendered routes listed in Step 4; no screenshot test is
  warranted because layout and body content are unchanged.

## Done criteria

- [ ] Homepage title is exactly
      `Svelte Motion — Framer Motion API for Svelte 5` (46 characters).
- [ ] `/svelte-animations` title is exactly
      `Svelte 5 Animation Patterns | Svelte Motion` (43 characters).
- [ ] Every example detail title ends in `| Svelte Motion`, preceded by one
      space.
- [ ] No example detail title contains `| Examples |`.
- [ ] `/examples` remains `Examples | Svelte Motion`.
- [ ] Every extracted literal `seo.title` is at most 60 characters and unique.
- [ ] `pnpm --filter docs test` passes.
- [ ] `pnpm --filter docs check` reports 0 errors and 0 warnings.
- [ ] `pnpm --filter docs build` exits 0 and example mirror generation succeeds.
- [ ] `trunk check` and `git diff --check` exit 0.
- [ ] No product files outside the Scope list are modified.
- [ ] `.agents/.plans/seo-title-policy/README.md` status is updated.

## STOP conditions

Stop and report back instead of improvising if:

- Any example page assigns `seo.title` dynamically or via a helper; the current
  mirror parser assumes a string literal and the test/parser strategy must be
  reconsidered.
- The route glob finds a number of example detail pages other than 60 before
  source edits; the inventory has drifted, so re-audit the new/removed routes.
- `exampleMirrorsPlugin` fails after the title-only edits. Do not patch
  `node_modules`, docs-kit, or Vite configuration to force the build through.
- Clearing the warnings appears to require changing descriptions, H1s,
  breadcrumbs, canonical URLs, or public routes.
- The title-policy test cannot produce route-specific diagnostics or silently
  skips a title syntax it does not understand.
- A verification command fails twice after a reasonable correction.

## Maintenance notes

- Reviewers should focus on semantic clarity in the five special rewrites and
  verify the remaining example changes are suffix-only.
- Future example pages must keep a literal `seo.title` because docs-kit mirror
  generation parses route source. The new test makes both this convention and
  the title budget visible at authoring time.
- The 60-character ceiling is intentionally an Ahrefs-oriented operational
  check. If the team later replaces Ahrefs or sees evidence from Search Console
  that a longer title performs better, revise the test and policy deliberately;
  do not cargo-cult the number.
- Google can derive title links from `<title>`, prominent headings, `og:title`,
  and link text. Keep those surfaces topically aligned, but do not make them
  identical merely for consistency.
