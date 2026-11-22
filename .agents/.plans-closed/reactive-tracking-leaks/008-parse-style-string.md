# Plan 008: String `style` props survive `;` inside values and keep CSS fallback pairs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/utils/style.ts src/lib/utils/style.spec.ts src/lib/utils/optimizedAppear.ts src/lib/html/_MotionContainer.ssr.spec.ts src/routes/+page.svelte src/routes/tests/style-string-declarations e2e/utilities/style-string-declarations.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. (`src/routes/+page.svelte` is also
> edited by plans 003, 006, 007 and 010, each adding one link; a link added
> by them is expected and is not a STOP.)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (pure string handling; every `motion.*` element with a string `style` goes through it, so the existing style suites are the gate)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

Every `motion.*` element with a string `style` prop renders its inline style
through `mergeInlineStyles`, which parses the string with `parseStyleString`.
That parser splits on every `;` and stores one value per property in a plain
object. Two user-visible consequences:

1. A `;` inside a value cuts the value. `style="background-image:url('data:image/png;base64,…')"`
   renders as `background-image: url('data:image/png`, which the browser
   rejects, so the image disappears. The same happens to `;` inside quoted
   strings (`content: "a;b"`) and comments (`/* … ; … */`), and a comment
   containing `:` turns into a garbage property.
2. A CSS fallback pair collapses to its last member.
   `style="height: 50px; height: 100dvh"` renders as `height: 100dvh`. The
   result is written as a **style attribute string**, not through
   `el.style.setProperty`, so the browser would have kept the first value when
   it rejects the second; after the collapse it gets nothing. A plain
   `<div style="…">` keeps the fallback; wrapping it in `motion.div` must not
   change that.

After this plan, one declaration splitter that respects quotes, brackets and
comments serves `style.ts` and `optimizedAppear.ts`; `parseStyleString` keeps
its one-value-per-property contract (last wins, as the browser resolves a
single property), and `mergeInlineStyles` keeps every authored declaration
in order, collapsing a property to one declaration only when Motion writes
that property itself.

## Current state

There is no upstream equivalent: React's `style` prop is object-only, so
framer-motion never parses a CSS string. The reference behavior is the
browser's own inline-style parsing.

- `src/lib/utils/style.ts` (464 lines): style serialization for SSR and the
  client. Not exported from the package root (`src/lib/index.ts` does not
  re-export these names), so internal signatures may change.

  `parseStyleString`, lines 437–457:

  ```ts
  /**
   * Parse an inline CSS string into a property → value record. Property
   * names are kept verbatim (kebab-case stays kebab-case), which is a
   * valid object-form style — `Reorder.Item` uses this to merge its
   * `x`/`y`/`zIndex` MotionValues into a consumer's string `style`.
   */
  export const parseStyleString = (style: string): Record<string, string> => {
      const out: Record<string, string> = {}
      style
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((decl) => {
              const idx = decl.indexOf(':')
              if (idx === -1) return
              const prop = decl.slice(0, idx).trim()
              const value = decl.slice(idx + 1).trim()
              if (prop) out[prop] = value
          })
      return out
  }

  const stringifyStyleObject = (obj: Record<string, string>): string =>
      Object.entries(obj)
          .map(([k, v]) => `${k}: ${v}`)
          .join('; ')
  ```

  `mergeInlineStyles`, lines 79–109 (the parse is at 85–87):

  ```ts
  export const mergeInlineStyles = (
      existingStyle: unknown,
      initial: Record<string, unknown> | null | undefined,
      animateFallback?: Record<string, unknown> | null,
      transformTemplate?: TransformTemplate
  ): string => {
      const base: Record<string, string> = parseStyleString(
          typeof existingStyle === 'string' ? existingStyle : ''
      )

      const source = /* initial, else animateFallback, else null */
      if (!source) {
          if (transformTemplate && !base.transform) {
              const templatedTransform = transformTemplate({}, '')
              if (templatedTransform) {
                  base.transform = templatedTransform
              }
          }

          return stringifyStyleObject(base)
      }

      mergeRenderStateIntoStyle(base, buildMotionHTMLRenderState(source, transformTemplate))

      return stringifyStyleObject(base)
  }
  ```

  `mergeRenderStateIntoStyle`, lines 419–435 (module-private):

  ```ts
  const mergeRenderStateIntoStyle = (base: Record<string, string>, state: HTMLRenderState) => {
      for (const [key, value] of Object.entries(state.style)) {
          if (value == null) continue
          const cssKey = toKebabCase(key)
          const cssValue = String(value)
          if (cssKey === 'transform' && !cssValue) {
              delete base.transform
              continue
          }
          base[cssKey] = cssValue
      }

      for (const [key, value] of Object.entries(state.vars)) {
          if (value == null) continue
          base[key] = String(value)
      }
  }
  ```

  `extractTransform` (line 139) returns `parseStyleString(style).transform ?? ''`.

- How the result reaches the DOM (this decides the duplicate rule):
  - `src/lib/html/_MotionContainer.svelte:1891-1929`: `renderedInlineStyle`
    is `mergeInlineStyles(inlineStyleBaseWithHolds, …)` on both the SSR and
    client paths, and line 2002 passes it as the element's `style`
    **attribute** (`style: renderedInlineStyle`).
  - `src/lib/utils/style.ts:318-327` (`applyMotionStyleEffect`):
    `element.setAttribute('style', mergeInlineStyles(element.getAttribute('style') ?? '', …))`.
  - So the output is a whole declaration list handed to the browser's CSS
    parser, which drops invalid declarations and keeps the last valid one per
    property. Keeping both members of a fallback pair in the string is what
    makes the fallback work.
  - `_MotionContainer.svelte:1814-1815` builds `inlineStyleBaseWithHolds` by
    appending library holds to the user's string:
    `;visibility:hidden`, a drag `touch-action` default, a pinch
    `touch-action`, and `;display:none`. Today the collapse makes the hold the
    only declaration; after this plan the string carries both
    (`display: flex; display: none`), which the browser resolves identically
    (last valid wins). Do not edit `_MotionContainer.svelte`.

- `src/lib/utils/optimizedAppear.ts` (547 lines). Line 1:
  `import { mergeInlineStyles } from '$lib/utils/style'`. The same naive split,
  lines 146–153:

  ```ts
  const readStyleProp = (style: string, prop: string): string | undefined => {
      return style
          .split(';')
          .map((part) => part.trim())
          .find((part) => part.startsWith(`${prop}:`))
          ?.slice(prop.length + 1)
          .trim()
  }
  ```

  Its only callers are lines 311–312, reading `'transform'` from
  `mergeInlineStyles('', initial, null)` / `mergeInlineStyles('', target, null)`.
  That input is library-generated and has no `;` inside values, so this site is
  a consistency fix, not a user-visible bug.

- Other consumers of `parseStyleString` (do not edit):
  `src/lib/components/Reorder/Item.svelte:83` and `:278` spread it into an
  object-form style. An object holds one value per key, so last-wins is the
  right contract there.

- A third naive splitter exists in `src/lib/utils/layout.ts:107-116`
  (`stripNonChildLayoutStyle`). It only builds a comparison key for change
  detection, so a bad split there cannot corrupt rendered output. It is out of
  scope (see Maintenance notes).

- Tests: `src/lib/utils/style.spec.ts` (601 lines) imports from `./style.js`
  (source, no build needed). Its import block is lines 3–11; add
  `parseStyleString` to it. Existing exemplar, lines 130–135:

  ```ts
  it('ignores malformed existing style declarations', () => {
      const out = mergeInlineStyles('baddecl; color: blue', { opacity: 1 }, null)
      expect(out).toContain('color: blue')
      expect(out).toContain('opacity: 1')
      expect(out).not.toContain('baddecl')
  })
  ```

  `src/lib/html/_MotionContainer.ssr.spec.ts` renders the container in jsdom:

  ```ts
  const { container } = render(MotionContainer as unknown as any, {
      props: { tag: 'div', initial: { opacity: 0.3, borderRadius: '12px' }, style: 'width: 100px; height: 50px' }
  })
  const el = container.firstElementChild as HTMLElement
  const style = el.getAttribute('style') ?? ''
  ```

- Test page conventions: pages live under `src/routes/tests/<name>/+page.svelte`
  and are linked from `src/routes/+page.svelte`. The neighbouring link to copy
  (lines 1644–1651):

  ```svelte
  <li>
      <a
          class="text-blue-300 hover:underline"
          href={resolve('/tests/reactive-style') + searchParams}
      >
          styleString (Reactive Styles)
      </a>
  </li>
  ```

  Its spec is `e2e/utilities/reactive-style.spec.ts`. Every motion element
  carries `data-is-loaded` (`_MotionContainer.svelte:1978`); wait for
  `ready`. The guided tester panel exemplar is
  `src/routes/tests/pinch/prop/+page.svelte` (`isTester` set in `onMount` from
  `!window.location.search.includes('@isPlaywright=true')`, panel wrapped in
  `{#if isTester}`).

## Commands you will need

| Purpose        | Command                                                                       | Expected on success |
| -------------- | ----------------------------------------------------------------------------- | ------------------- |
| Install        | `pnpm install --frozen-lockfile --config.engine-strict=false`                 | exit 0              |
| Browsers       | `pnpm exec playwright install chromium`                                       | exit 0              |
| Style unit     | `pnpm exec vitest run src/lib/utils/style.spec.ts`                            | see steps           |
| Related unit   | `pnpm exec vitest run src/lib/utils/optimizedAppear.spec.ts src/lib/html/_MotionContainer.ssr.spec.ts src/lib/components/Reorder` | all pass |
| All unit tests | `pnpm test:only`                                                              | all pass            |
| Typecheck      | `pnpm check`                                                                  | 0 errors            |
| Build          | `pnpm build`                                                                  | exit 0              |
| e2e (own port) | `PW_PORT=4218 pnpm exec playwright test <paths> --project=chromium`           | see steps           |
| Format / lint  | `trunk fmt <files>` then `trunk check <files>`                                | no issues           |

Notes: port 4198 is the maintainer's live dev server; never bind, reuse or
kill it, and never set `PW_REUSE_SERVER`. Playwright builds and previews the
app itself. Trunk is the only lint/format tool. Never use `git stash`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/style.ts`
- `src/lib/utils/style.spec.ts`
- `src/lib/utils/optimizedAppear.ts` (only `readStyleProp` and the import on line 1)
- `src/lib/html/_MotionContainer.ssr.spec.ts` (one new test)
- `src/routes/tests/style-string-declarations/+page.svelte` (create)
- `e2e/utilities/style-string-declarations.spec.ts` (create)
- `src/routes/+page.svelte` (one new link)
- `.changeset/style-string-declarations.md` (create)

**Out of scope** (do NOT touch):

- `src/lib/html/_MotionContainer.svelte`, including the hold appends at
  1814–1815. The browser resolves the duplicated hold the same way.
- `src/lib/components/Reorder/Item.svelte`: it keeps using `parseStyleString`
  unchanged.
- `src/lib/utils/layout.ts` (`stripNonChildLayoutStyle`): comparison only;
  another batch finding (17) may plan edits in that file.
- `toKebabCase` at the end of `style.ts`: batch finding 29 covers the
  converters.
- `toNativeOptions` in `optimizedAppear.ts` (an unverified lead in the README).

## Git workflow

- Branch: `advisor/008-parse-style-string`, in a worktree created by hand
  from the commit that adds this plan (not `isolation: 'worktree'`).
- Conventional commits, for example
  `fix(style): split string styles on top-level semicolons and keep fallbacks`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Red unit tests

In `src/lib/utils/style.spec.ts`, add `parseStyleString` to the import from
`./style.js`, then add a new `describe('parseStyleString', …)` block and new
cases inside the existing `describe('mergeInlineStyles', …)` and
`describe('extractTransform', …)` blocks. Use this data URI constant at the top
of the file:

```ts
const PNG = "url('data:image/png;base64,iVBORw0KGgo=')"
```

`parseStyleString`:

1. `parseStyleString(\`background-image: ${PNG}; color: red\`)` `toEqual`
   `{ 'background-image': PNG, color: 'red' }`.
2. Unquoted URL: `parseStyleString('background: url(data:image/svg+xml;utf8,<svg/>); width: 1px')`
   `toEqual` `{ background: 'url(data:image/svg+xml;utf8,<svg/>)', width: '1px' }`.
3. Quoted strings: `parseStyleString('content: "a;b"; font-family: \'x;y\', serif')`
   `toEqual` `{ content: '"a;b"', 'font-family': "'x;y', serif" }`.
4. Comments are dropped: `parseStyleString('color: red; /* width: 1px; */ height: 2px')`
   `toEqual` `{ color: 'red', height: '2px' }`.
5. Escaped quote inside a string: `parseStyleString('content: "a\\";b"; color: red')`
   (the JS string contains `content: "a\";b"; color: red`) `toEqual`
   `{ content: '"a\\";b"', color: 'red' }`.
6. Last wins (pin, passes today): `parseStyleString('height: 50px; height: 100dvh')`
   `toEqual` `{ height: '100dvh' }`.
7. Unterminated input does not throw (pin):
   `expect(() => parseStyleString("color: red; content: 'oops")).not.toThrow()`
   and the result's `color` is `'red'`.

`mergeInlineStyles` (exact strings, since order and duplicates are the point):

8. Fallback pair preserved: `mergeInlineStyles('height: 50px; height: 100dvh', null, null)`
   `toBe` `'height: 50px; height: 100dvh'`.
9. Data URI with a Motion source: `mergeInlineStyles(\`background-image: ${PNG}\`, { opacity: 0 }, null)`
   `toBe` `` `background-image: ${PNG}; opacity: 0` ``.
10. A Motion-written property collapses its duplicates in place (pin, passes
    today): `mergeInlineStyles('opacity: 1; color: red; opacity: 0.5', { opacity: 0 }, null)`
    `toBe` `'opacity: 0; color: red'`.
11. The empty-template transform removal removes every transform declaration:
    `mergeInlineStyles('transform: rotate(1deg); color: red; transform: scale(2)', { x: 10 }, null, () => '')`
    `toBe` `'color: red'`.

`extractTransform`:

12. `extractTransform('/* transform: none; */ transform: scale(2)')` `toBe`
    `'scale(2)'`.

**Verify**: `pnpm exec vitest run src/lib/utils/style.spec.ts` → cases 1–5, 8,
9 and 12 FAIL (truncated or missing values, `'height: 100dvh'` for 8, a
`'/* transform'` key making 12 return `''`); cases 6, 7, 10 and 11 pass; every
pre-existing test passes.

If case 1, 8 or 9 passes on the unmodified code, STOP and report: the
reproduction is wrong. If case 11 fails today, note it in your report and keep
it (it must pass after Step 2).

### Step 2: One splitter, used everywhere in `style.ts`

In `src/lib/utils/style.ts`:

1. Add an exported splitter above `parseStyleString`, with Google-style JSDoc
   (summary, `@param`, `@returns`, `@example`):

   ```ts
   /**
    * Split an inline CSS declaration list into ordered `[property, value]`
    * pairs, the way the browser's CSS parser does: a `;` ends a declaration
    * only outside quoted strings, outside `()`/`[]`/`{}` and outside
    * comments. Comments are dropped. Duplicate properties are all kept, in
    * source order. Declarations without a `:` or with an empty property name
    * are skipped. Property names and values are trimmed; names keep their
    * case (custom properties are case-sensitive).
    *
    * @param style Inline CSS such as the value of a `style` attribute.
    * @returns The declarations in source order.
    * @example
    * ```ts
    * parseStyleDeclarations("background: url(data:a;b); height: 1px; height: 1dvh")
    * // => [['background', 'url(data:a;b)'], ['height', '1px'], ['height', '1dvh']]
    * ```
    */
   export const parseStyleDeclarations = (style: string): Array<[string, string]> => {
       const declarations: Array<[string, string]> = []
       let current = ''
       let quote: string | null = null
       let depth = 0
       const flush = () => {
           const colon = current.indexOf(':')
           if (colon !== -1) {
               const property = current.slice(0, colon).trim()
               if (property) declarations.push([property, current.slice(colon + 1).trim()])
           }
           current = ''
       }
       for (let i = 0; i < style.length; i++) {
           const ch = style[i]
           if (ch === '\\') {
               current += ch + (style[i + 1] ?? '')
               i++
               continue
           }
           if (quote) {
               current += ch
               if (ch === quote) quote = null
               continue
           }
           if (ch === '/' && style[i + 1] === '*') {
               const end = style.indexOf('*/', i + 2)
               i = end === -1 ? style.length : end + 1
               continue
           }
           if (ch === '"' || ch === "'") quote = ch
           else if (ch === '(' || ch === '[' || ch === '{') depth++
           else if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) depth--
           else if (ch === ';' && depth === 0) {
               flush()
               continue
           }
           current += ch
       }
       flush()
       return declarations
   }
   ```

2. Rewrite `parseStyleString` on top of it and update its JSDoc to Google
   style, stating the contract: one value per property, **the last
   declaration wins** (what the browser resolves for a property whose values
   are all valid), so an object-form consumer like `Reorder.Item` sees the
   final value; use `parseStyleDeclarations` when every declaration matters.
   Add `@param`, `@returns`, and an `@example` showing a data URI surviving and
   `height: 1px; height: 2px` → `{ height: '2px' }`.

3. Make `mergeInlineStyles` keep the ordered list. Replace the
   `Record<string, string>` base with `Array<[string, string]>` from
   `parseStyleDeclarations`, and add three module-private helpers next to
   `stringifyStyleObject` (rename that to `stringifyDeclarations` and make it
   take the array):

   - `getDeclaration(list, property)`: the value of the **last** declaration
     of `property`, or `undefined`.
   - `setDeclaration(list, property, value)`: if `property` is absent, push
     `[property, value]`; otherwise overwrite the **first** occurrence in place
     and remove every later occurrence. (This reproduces today's output order
     exactly for strings without duplicates, because a JS object also keeps a
     key at its first insertion position.)
   - `removeDeclaration(list, property)`: remove every occurrence.

   Then: `!base.transform` → `!getDeclaration(base, 'transform')`;
   `base.transform = templatedTransform` → `setDeclaration(base, 'transform', templatedTransform)`.
   Change `mergeRenderStateIntoStyle` to take the array: `delete base.transform`
   → `removeDeclaration(base, 'transform')`, and both `base[key] = …` writes →
   `setDeclaration(base, key, …)`. Do not change `buildMotionHTMLRenderState`
   or any other function.

4. `extractTransform` keeps calling `parseStyleString(style).transform ?? ''`
   (last wins). No change needed beyond the new parser.

**Verify**: `pnpm exec vitest run src/lib/utils/style.spec.ts` → all tests
pass, including the 12 new ones.

### Step 3: Use the parser in `optimizedAppear.ts`

In `src/lib/utils/optimizedAppear.ts`, change line 1 to
`import { mergeInlineStyles, parseStyleString } from '$lib/utils/style'` and
replace the body of `readStyleProp` (lines 146–153) with
`return parseStyleString(style)[prop]`. Keep the function and its call sites.
If `trunk check` flags the one-line wrapper as pointless, inline it at lines
311–312 instead (`parseStyleString(mergeInlineStyles('', initial, null)).transform`)
and delete `readStyleProp`.

**Verify**:
`pnpm exec vitest run src/lib/utils/optimizedAppear.spec.ts src/lib/html/_MotionContainer.ssr.spec.ts src/lib/components/Reorder`
→ all pass. `grep -n "split(';')" src/lib/utils/style.ts src/lib/utils/optimizedAppear.ts`
→ no output.

### Step 4: Component-level test

In `src/lib/html/_MotionContainer.ssr.spec.ts`, add one test inside the
existing `describe`, modelled on "reflects initial styles in SSR output":
render with
`style: "width: 10px; background-image: url('data:image/png;base64,iVBORw0KGgo='); height: 5px; height: 6px"`
and `initial: { opacity: 0.5 }`. Assert the `style` attribute contains
`base64,iVBORw0KGgo=`, `opacity: 0.5`, and both `height: 5px` and
`height: 6px`.

**Verify**: `pnpm exec vitest run src/lib/html/_MotionContainer.ssr.spec.ts`
→ all pass. (Optional sanity: with Step 2 reverted locally, this test fails;
restore Step 2 afterwards.)

If only the `height` assertions fail because jsdom normalizes the attribute
(it should not; Svelte writes the string verbatim), replace those two
assertions with the data-URI one alone and record that in your report. Do not
weaken the data-URI assertion.

### Step 5: Browser-level regression page and e2e

The fallback pair only proves itself in a real CSS parser, so add a small page.

Create `src/routes/tests/style-string-declarations/+page.svelte` (SSR on: no
`+page.ts`), importing `motion` from `$lib`:

```svelte
<motion.div
    data-testid="fallback"
    style="width: 40px; height: 50px; height: 1furlong; background: #38bdf8"
/>
<motion.div
    data-testid="data-uri"
    initial={{ opacity: 0.5 }}
    style="width: 40px; height: 40px; background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='); background-size: cover"
/>
```

`1furlong` is an invalid length: the browser drops it and keeps `50px` only if
both declarations reach the element. Add a short tester panel under
`{#if isTester}` (mechanism from `src/routes/tests/pinch/prop/+page.svelte`):
step "Load the page"; expected "The first box is 50px tall, the second shows a
pixel image at half opacity"; live verdicts PASS/FAIL computed in `onMount`
from `getComputedStyle(el).height === '50px'` and
`getComputedStyle(el).backgroundImage.includes('base64')`. No upstream twin is
needed: framer-motion has no string styles.

Link it from `src/routes/+page.svelte` directly after the
`styleString (Reactive Styles)` item, text `styleString declarations (data URIs, fallbacks)`,
`href={resolve('/tests/style-string-declarations') + searchParams}`.

Create `e2e/utilities/style-string-declarations.spec.ts` (model:
`e2e/utilities/reactive-style.spec.ts`), URL
`/tests/style-string-declarations?@isPlaywright=true`, one `test.describe`:

1. **keeps the earlier member of a fallback pair**: wait for
   `data-is-loaded="ready"` on `fallback`; `expect.poll` on
   `getComputedStyle(el).height` → `'50px'`.
2. **keeps a data URI containing `;`**: wait for ready on `data-uri`; assert
   `getComputedStyle(el).backgroundImage` contains `base64,iVBOR` and the
   `style` attribute contains `opacity`.

No `waitForTimeout`.

**Verify**:
`PW_PORT=4218 pnpm exec playwright test e2e/utilities/style-string-declarations.spec.ts --project=chromium`
→ both pass. (Optional red check: with Step 2 reverted locally, test 1 reads
`0px` and test 2 reads `none`; restore Step 2.)

### Step 6: Changeset

Create `.changeset/style-string-declarations.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

String `style` props on `motion.*` elements no longer break on a `;` inside a value (data URIs, quoted strings, comments), and CSS fallback pairs such as `height: 100vh; height: 100dvh` now reach the element intact instead of collapsing to the last declaration.
```

### Step 7: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, then
`PW_PORT=4218 pnpm exec playwright test e2e/utilities e2e/motion e2e/drag e2e/reorder e2e/pinch --project=chromium`
(the suites that exercise string styles, drag and pinch holds), then
`trunk fmt` and `trunk check` on the in-scope files, then `git diff --check`.

**Verify**: every command exits 0. For an e2e failure, re-run that spec alone
once; if it fails again and also fails without your change, it is a baseline
flake: record it and continue. If it passes without your change, STOP.

## Test plan

- Red first: `style.spec.ts` cases 1–5, 8, 9, 12 fail on current code
  (truncation, collapse, comment garbage) and pass after Step 2.
- Pins that pass before and after: last-wins in `parseStyleString` (6),
  unterminated input (7), Motion overrides collapse duplicates in place (10),
  empty-template transform removal (11).
- Integration: one `_MotionContainer.ssr.spec.ts` test (rendered attribute).
- Browser: `e2e/utilities/style-string-declarations.spec.ts`, two tests on the
  new page, proving the fallback reaches the CSS parser.
- Regression: the whole unit suite, plus the e2e areas in Step 7.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/style.spec.ts` exits 0 with the 12 new cases present
- [ ] `pnpm test:only` and `pnpm check` exit 0
- [ ] `PW_PORT=4218 pnpm exec playwright test e2e/utilities/style-string-declarations.spec.ts --project=chromium` exits 0
- [ ] `grep -n "split(';')" src/lib/utils/style.ts src/lib/utils/optimizedAppear.ts` prints nothing
- [ ] `grep -c "parseStyleDeclarations" src/lib/utils/style.ts` prints at least `2`
- [ ] `grep -c "style-string-declarations" src/routes/+page.svelte` prints `1`
- [ ] `grep -c "waitForTimeout" e2e/utilities/style-string-declarations.spec.ts` prints `0`
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 case 1, 8 or 9 passes on the unmodified code.
- The excerpts in "Current state" do not match the live code.
- An existing `style.spec.ts`, Reorder, optimized-appear or SSR test fails
  after Step 2 and passes without it (it may assert the old collapse; report
  the test name and assertion rather than editing it).
- Any e2e outside the new spec fails after your change and passes without it.
- The fix seems to need a change in `_MotionContainer.svelte`, `Reorder/*` or
  `layout.ts`.

## Maintenance notes

- Duplicate rule, stated once: `parseStyleString` is last-wins (one value per
  property, for object consumers and `extractTransform`); `mergeInlineStyles`
  preserves every authored declaration in order, because its output is a style
  attribute string and the browser does the fallback resolution; a property
  Motion writes (render state, CSS variables, transform template) collapses to
  one declaration at its first position.
- Observable side effect: library holds appended in
  `_MotionContainer.svelte:1815` now appear next to the user's own
  declaration (`display: flex; display: none`) instead of replacing it. The
  browser result is the same, except when the user's declaration carries
  `!important`, which now beats the hold. That case did not come up in any
  test; if it matters, the fix belongs in `_MotionContainer.svelte` (apply
  holds as overrides, not appended text), as a separate plan.
- `src/lib/utils/layout.ts:107-116` (`stripNonChildLayoutStyle`) still splits
  naively. It only builds a comparison key, so the worst case is a spurious or
  missed layout-change comparison for values containing `;`. Switching it to
  `parseStyleDeclarations` is a one-line follow-up; it was left out because
  `layout.ts` may be owned by another plan in this batch (finding 17).
- `src/routes/+page.svelte` is also edited by plans 003, 006, 007 and 010
  (one link each). Each insertion is a separate `<li>`; whichever lands later
  resolves a trivial merge. This is not a dependency.
- Reviewer: check that strings without duplicates produce byte-identical
  output to before (the existing exact-string tests at `style.spec.ts:464,469`
  cover this), and that the splitter never loops forever on a trailing `\` or
  an unterminated comment.
