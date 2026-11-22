# Guard log: plan 008 (style strings split only on top-level `;`)

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-008`. No STOP conditions fired.
- **Red reproduced by the guard:** with `style.ts` reverted, `vitest run src/lib/utils/style.spec.ts` → 8 failed, 65 passed (cases 1–5, 8, 9 and 12, as predicted).
- **Green reproduced:** 73/73.
- **Diff read in full:**
  - `parseStyleDeclarations` is a character scanner that tracks quotes, escapes, bracket depth and comments.
  - `parseStyleString` is now `Object.fromEntries` over it, so the last value wins.
  - `mergeInlineStyles` and `mergeRenderStateIntoStyle` work on an ordered list. `setDeclaration` overwrites a property's first occurrence and drops the later ones, so strings without duplicates come out in the same order as before.
  - `readStyleProp` uses `parseStyleString`.
- **Accepted deviations:**
  - The SSR spec dropped its `height` assertions, the Step 4 fallback, because jsdom collapses duplicate properties in `style`. The e2e covers the fallback pair instead.
  - The test page passes its duplicate-property style through a constant, so `svelte/no-dupe-style-properties` doesn't flag it.
  - The e2e fallback box read 40px rather than 0px on unmodified code, because of flex stretch. It was still red.
- **Executor-reported, not re-run:**
  - `pnpm test:only` 1745/1745, `pnpm check` 0 errors, `pnpm build` and publint ok;
  - the new e2e 2/2;
  - `e2e/utilities e2e/motion e2e/drag e2e/reorder e2e/pinch`: 449 passed, 2 skipped, 0 failed;
  - Trunk clean.
- **Known, not tested (plan Maintenance notes):** a user's own `!important` declaration now sits beside the library's appended holds and beats them.
- **Needs maintainer sign-off:** `/tests/style-string-declarations` is a new tester page.
- **Integrated:** `a296b0f6` on `fix/2.14.1`.
