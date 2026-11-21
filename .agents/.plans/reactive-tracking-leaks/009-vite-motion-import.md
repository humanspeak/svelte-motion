# Plan 009: The Vite optimizer keeps the `motion` import while any `motion` reference survives the rewrite

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/vite.ts src/lib/vite.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (build-time transform; a wrong "keep" only costs tree-shaking, a wrong "drop" is the crash being fixed)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

`svelteMotionOptimize()` (exported as `@humanspeak/svelte-motion/vite`, and
used by the docs site at `docs/vite.config.ts:189`) rewrites `<motion.div>` to
a direct `Div.svelte` import and removes `import { motion }` when it believes
nothing else uses `motion`. It decides that by deleting every `motion.<word>`
from the **whole file** and looking for a leftover `motion`, but it only
rewrites `motion.<tag>` in two places: `<motion.TAG` / `</motion.TAG>` tags,
and member expressions inside `<script>` blocks. A `motion.<tag>` in a
template expression, such as

```svelte
<script>
    import { motion } from '@humanspeak/svelte-motion'
    import W from './W.svelte'
</script>

<motion.div>hi</motion.div>
<W as={motion.span} />
```

is neither rewritten nor counted, so the import is dropped and the page throws
`ReferenceError: motion is not defined`, only when the plugin is on. The same
happens for `<svelte:component this={motion.span} />`, `{@const C = motion.p}`,
and any non-tag script member (`motion.foo`). After this plan the import is
kept whenever a `motion` reference survives the rewrite.

There is no upstream equivalent: the Vite plugin is specific to svelte-motion.

## Current state

- `src/lib/vite.ts` (567 lines): the plugin. Regexes, lines 188–217:

  ```ts
  const MOTION_IMPORT_RE =
      /import\s*\{([^}]*\bmotion\b[^}]*)\}\s*from\s*['"]@humanspeak\/svelte-motion['"]/
  const MOTION_TEMPLATE_OPEN_RE = /<motion\.([a-z][a-z0-9-]*)/g
  const MOTION_TEMPLATE_CLOSE_RE = /<\/motion\.([a-z][a-z0-9-]*)\s*>/g
  const MOTION_SCRIPT_RE = /\bmotion\.([a-z][a-z0-9-]*)\b/g
  ```

  `transform`, lines 257–369. Tag collection (template opens and script-body
  members, lines 266–288), then component imports, then the decision,
  lines 306–340:

  ```ts
  // Check if motion is used for anything other than .TAG access
  // (e.g., passed as a variable, used in a function call)
  const otherImports = importMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && s !== 'motion')

  // Check if motion itself is used beyond .TAG access
  // Remove all motion.TAG patterns and see if bare `motion` remains
  const codeWithoutTags = transformed
      .replace(MOTION_TEMPLATE_OPEN_RE, '')
      .replace(MOTION_TEMPLATE_CLOSE_RE, '')
      .replace(MOTION_SCRIPT_RE, '')
  const motionStillUsed = /\bmotion\b/.test(
      codeWithoutTags.replace(MOTION_IMPORT_RE, '').replace(/['"].*?['"]/g, '')
  )

  // Replace the import statement
  if (motionStillUsed) {
      transformed = transformed.replace(
          MOTION_IMPORT_RE,
          (original) => `${original}\n${componentImports.join('\n')}`
      )
  } else if (otherImports.length > 0) {
      transformed = transformed.replace(
          MOTION_IMPORT_RE,
          `import { ${otherImports.join(', ')} } from '@humanspeak/svelte-motion'\n${componentImports.join('\n')}`
      )
  } else {
      transformed = transformed.replace(MOTION_IMPORT_RE, componentImports.join('\n'))
  }
  ```

  Then the rewrites, lines 342–363: template opens/closes for tags in
  `tagToLocal` (`<motion.${tag}(?=[\s/>])` and `</motion.${tag}\s*>`), and
  `rewriteMotionRefsInScript` over each `<script>` body, which rewrites only
  non-computed `motion.<tag>` member expressions whose tag is in `tagToLocal`
  (acorn path `rewriteViaAst`, lines 424–467; TS fallback `rewriteViaLexer`,
  lines 476–567).

- The mechanism of the bug: `.replace(MOTION_SCRIPT_RE, '')` on line 318 runs
  over the whole file, including template expressions, while the rewrite only
  covers script bodies. Anything the check deletes but the rewrite leaves
  behind becomes a dangling `motion`. Also, the check deletes `motion.<x>` for
  any lowercase `x`, but only valid tags are rewritten.

- A second, harmless imprecision: HTML comments and `<style>` blocks count as
  uses today (`<!-- motion … -->` keeps the whole barrel import). A dry run of
  the new rule (Step 2) over the 96 `.svelte` files in `docs/src` and
  `src/routes` that the plugin transforms changed the decision for 3 files,
  all from "keep" to "drop", all because their only extra `motion` was in an
  HTML or CSS comment (`docs/src/lib/examples/use-presence-data/demos/Default.svelte:34`,
  `docs/src/lib/examples/mobile-drawer/demos/Default.svelte:224`,
  `docs/src/lib/examples/animate-presence-custom/demos/UsePresenceData.svelte`).
  No file changed from "drop" to "keep". No file in the repo uses
  `as={motion.…}` or `this={motion.…}` today, which is why the crash was never
  seen.

- Tests: `src/lib/vite.spec.ts` (372 lines). Helper, lines 7–14:

  ```ts
  const transform = (code: string, id = 'test.svelte'): string | null => {
      const plugin = svelteMotionOptimize()
      const result = (plugin.transform as (code: string, id: string) => { code: string } | null)(
          code,
          id
      )
      return result?.code ?? null
  }
  ```

  Exemplar to model new tests on, lines 126–142
  ("keeps motion import when motion is used as a bare reference"):

  ```ts
  const result = transform(code)
  expect(result).not.toBeNull()
  // motion is still used as a value, so keep the import
  expect(result).toContain("import { motion } from '@humanspeak/svelte-motion'")
  expect(result).toContain(
      "import SvelteMotionDiv from '@humanspeak/svelte-motion/html/Div.svelte'"
  )
  ```

  `src/lib/html/componentNames.spec.ts:101` also runs the plugin; keep it green.

- No fixture app exercises the plugin in e2e (the root app's `vite.config.ts`
  does not use it; only `docs/` does). This plan is unit-tested only.

## Commands you will need

| Purpose        | Command                                                                      | Expected on success |
| -------------- | ---------------------------------------------------------------------------- | ------------------- |
| Install        | `pnpm install --frozen-lockfile --config.engine-strict=false`                | exit 0              |
| Plugin unit    | `pnpm exec vitest run src/lib/vite.spec.ts src/lib/html/componentNames.spec.ts` | see steps        |
| All unit tests | `pnpm test:only`                                                             | all pass            |
| Typecheck      | `pnpm check`                                                                 | 0 errors            |
| Build          | `pnpm build`                                                                 | exit 0              |
| Format / lint  | `trunk fmt <files>` then `trunk check <files>`                               | no issues           |

No e2e and no port: nothing in the root app runs the plugin. (Lane port 4219
is reserved for this plan if a reviewer asks for one; never 4198.) Never use
`git stash`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/vite.ts`
- `src/lib/vite.spec.ts`
- `.changeset/vite-keep-motion-import.md` (create)

**Out of scope** (do NOT touch):

- Rewriting template-expression references (`as={motion.span}` →
  `as={SvelteMotionSpan}`). That is a further optimization; this plan only
  makes the output correct. Note it as a follow-up.
- `rewriteViaAst` / `rewriteViaLexer`, `VALID_TAGS`, `componentNames.ts`.
- `docs/vite.config.ts` and docs pages.
- Replacing the regex approach with the Svelte compiler's parser.

## Git workflow

- Branch: `advisor/009-vite-motion-import`, in a worktree created by hand from
  the commit that adds this plan (not `isolation: 'worktree'`).
- Conventional commits, for example
  `fix(vite): keep the motion import when a template expression still uses it`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Red tests

Add these tests to the `describe('svelteMotionOptimize', …)` block in
`src/lib/vite.spec.ts`, after the "keeps motion import when motion is used as
a bare reference" test:

1. **keeps the motion import for a template-expression reference**:

   ```svelte
   <script>
       import { motion } from '@humanspeak/svelte-motion'
       import W from './W.svelte'
   </script>

   <motion.div>hi</motion.div>
   <W as={motion.span} />
   ```

   Expect: result not null; contains
   `"import { motion } from '@humanspeak/svelte-motion'"`; contains the
   `SvelteMotionDiv` import; contains `<SvelteMotionDiv>hi</SvelteMotionDiv>`;
   contains `as={motion.span}`.

2. **keeps the original import, other names included**: same template with
   `import { motion, animate } from '@humanspeak/svelte-motion'`. Expect the
   result contains `"import { motion, animate } from '@humanspeak/svelte-motion'"`.

3. **keeps the import for `svelte:component` and `@const`**: template
   `<motion.div>a</motion.div>`, `<svelte:component this={motion.span} />`, and
   `{#if true}{@const C = motion.p}<C />{/if}`. Expect the
   `import { motion }` line is kept.

4. **keeps the import for a non-tag script member**: script
   `const C = motion.notatag` plus `<motion.div>a</motion.div>`. Expect the
   `import { motion }` line is kept and `motion.notatag` is unchanged.

5. **an HTML or CSS comment mentioning motion does not pin the import**:

   ```svelte
   <script>
       import { motion } from '@humanspeak/svelte-motion'
   </script>

   <!-- motion components below -->
   <motion.div>hi</motion.div>

   <style>
       /* styles for the motion box */
   </style>
   ```

   Expect the result does not contain `import { motion }` and does contain the
   `SvelteMotionDiv` import.

6. **pin, passes today**: a `motion.div` inside a script string literal or
   comment alone does not keep the import (script
   `const C = motion.div` plus `const label = "motion.div"`,
   `// motion.div is the box` and `/* motion.div */`, template `<C />`).
   Expect `not.toContain('import { motion }')`. This guards the script-comment
   stripping in Step 2: without it, this test turns red after the fix.

**Verify**: `pnpm exec vitest run src/lib/vite.spec.ts` → tests 1–5 FAIL
(1–4: the `import { motion … }` line is missing; 5: it is present); test 6 and
every pre-existing test pass.

If test 1 passes on unmodified code, STOP and report: the mechanism described
above is wrong.

### Step 2: Decide from what survives the rewrite

In `src/lib/vite.ts`, inside `transform`:

1. Move the template-tag rewrite loop (lines 342–350) and the script rewrite
   (lines 352–363, keep its comment block) **above** the import decision, so
   they run on `transformed` first. Leave the `componentImports` /
   `tagToLocal` construction where it is (it must run before the rewrites).
2. Delete `codeWithoutTags` and the old `motionStillUsed` computation, and
   replace it with a call to a new module-level helper:
   `const motionStillUsed = hasMotionReference(transformed)`.
3. Keep the three-way import replacement exactly as it is; it now runs last.
4. Add the helper below `escapeRegExp`, with Google-style JSDoc (summary,
   `@param`, `@returns`, `@example`) that states the safety rule: a false
   "true" only costs tree-shaking, a false "false" breaks the page, so every
   doubtful case counts as a reference.

   ```ts
   /**
    * Whether a `.svelte` source still references the `motion` binding after
    * the tag and script rewrites. …
    *
    * @param code - The partially transformed component source, with the
    *   original `import { motion … }` statement still present.
    * @returns `true` when the import must be kept.
    * @example
    * ```ts
    * hasMotionReference(`<script>import { motion } from '@humanspeak/svelte-motion'</script><W as={motion.span} />`)
    * // => true
    * ```
    */
   const hasMotionReference = (code: string): boolean => {
       const scripts: string[] = []
       const markup = code
           .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (_full, body: string) => {
               scripts.push(body)
               return ''
           })
           // CSS and HTML comments cannot reference a JS binding.
           .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
           .replace(/<!--[\s\S]*?-->/g, '')
           // Plain quoted attribute values. A value containing `{` may hold
           // an expression, so it is kept.
           .replace(/=\s*(["'])[^{]*?\1/g, '=')
       const script = scripts
           .join('\n')
           .replace(MOTION_IMPORT_RE, '')
           // Same string stripping as before; JS strings cannot reference it.
           // Strings first, so a `//` inside a URL string is not a comment.
           .replace(/['"].*?['"]/g, '')
           // JS comments cannot reference it either. Without this, a
           // `// motion.div` comment would now keep the import (the old
           // whole-file `MOTION_SCRIPT_RE` deletion used to hide it).
           .replace(/\/\*[\s\S]*?\*\//g, '')
           .replace(/\/\/[^\n]*/g, '')
       return /\bmotion\b/.test(`${script}\n${markup}`)
   }
   ```

   Do **not** apply the quote stripping to markup text: an apostrophe in prose
   (`Don't`) would pair with a later quote on the same line and hide a real
   `{motion.span}` between them.

**Verify**: `pnpm exec vitest run src/lib/vite.spec.ts src/lib/html/componentNames.spec.ts`
→ all pass, including the 6 new tests.

If a pre-existing test now fails, STOP and report its name and assertion; do
not edit it. (Expected: none fail. Tests at lines 178–240 have `motion.dev` /
`motion.div` prose in the markup; the import is now kept for those, which none
of them assert against.)

### Step 3: Dry run against the docs pages

Confirm the new rule does not regress tree-shaking for real pages. Write a
throwaway script in your scratch directory (not in the repo) that imports
`svelteMotionOptimize` from `src/lib/vite.ts` (run it with
`pnpm exec tsx <script>`; `tsx` is a root devDependency and resolves the `.js` → `.ts` import in `vite.ts`), runs `transform` on every `.svelte` file under
`docs/src` and `src/routes`, and prints each file whose output still contains
`import { motion` together with whether it did on `a33531a2` (check out the
old `vite.ts` into the scratch directory and import both).

**Verify**: no file changes from "dropped" to "kept". The plan-time dry run
found exactly 3 changes, all "kept" → "dropped", listed in "Current state".
If any file flips to "kept", open it: a real template-expression reference is
fine (that is the fix; list it in your report); prose or an attribute that is
not a reference means the helper is too conservative: STOP and report the
file and line.

### Step 4: Changeset

Create `.changeset/vite-keep-motion-import.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`svelteMotionOptimize()` no longer removes `import { motion }` when a template expression still uses it, such as `<W as={motion.span} />` or `<svelte:component this={motion.span} />`, which threw `motion is not defined` with the plugin on. HTML and CSS comments that mention `motion` no longer keep the full import.
```

### Step 5: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, `trunk fmt` and `trunk check` on
`src/lib/vite.ts` and `src/lib/vite.spec.ts`, then `git diff --check`.

**Verify**: every command exits 0.

## Test plan

- Red first: `vite.spec.ts` tests 1–4 fail on current code because the
  `import { motion … }` line is dropped while `motion.<x>` remains; test 5
  fails because a comment pins the import. All pass after Step 2.
- Pin: test 6 (string/comment `motion.div` in a script does not keep the
  import) passes before and after.
- Regression: every existing `vite.spec.ts` test and `componentNames.spec.ts`.
- Real-world check: Step 3 dry run over `docs/src` and `src/routes`.
- No e2e: no app in the repo's Playwright setup builds with the plugin.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/vite.spec.ts src/lib/html/componentNames.spec.ts` exits 0 with the 6 new tests present
- [ ] `pnpm test:only`, `pnpm check` and `pnpm build` exit 0
- [ ] `grep -n "codeWithoutTags" src/lib/vite.ts` prints nothing
- [ ] `grep -c "hasMotionReference" src/lib/vite.ts` prints `2`
- [ ] Step 3 dry run reported no "dropped" → "kept" flip caused by prose or attributes
- [ ] `trunk check src/lib/vite.ts src/lib/vite.spec.ts` reports no issues
- [ ] `git status --short` lists only the in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 test 1 passes on unmodified code.
- The excerpts in "Current state" do not match the live code.
- A pre-existing `vite.spec.ts` or `componentNames.spec.ts` test fails after
  Step 2.
- The Step 3 dry run shows a file flipping to "kept" because of prose or a
  non-reference attribute.
- The fix seems to need edits outside `src/lib/vite.ts`.

## Maintenance notes

- The rule is now "decide from the rewritten code": any future rewrite added
  to `transform` must run before `hasMotionReference`, or it will be counted
  as a surviving reference (safe, but it defeats the optimization).
- Follow-up, deliberately left out: rewrite template-expression
  `motion.<tag>` references to the direct component (and add those tags to
  `usedTags`), so `<W as={motion.span} />` also drops the barrel import. That
  needs brace-aware template scanning and is an optimization, not a fix.
- Known conservative cases: prose such as `<p>See motion.dev</p>` and
  `motion` inside a quoted attribute containing `{` now keep the import. The
  dry run found no such file in this repo.
- The script-side quote stripping (`/['"].*?['"]/g`) is inherited and can in
  theory pair an apostrophe in a `//` comment with a quote later on the same
  line; the new line-comment strip can in theory eat the rest of a line after
  a `//` inside a regex literal. Both are rare and both err toward hiding a
  reference only on that same line. Upgrading it to a real string/comment-aware scan (the lexer in
  `rewriteViaLexer` already walks strings correctly) would close that; it was
  left as is to keep the diff focused.
- No overlap with other plans in this batch; `src/lib/vite.ts` is not listed
  under any other plan.
