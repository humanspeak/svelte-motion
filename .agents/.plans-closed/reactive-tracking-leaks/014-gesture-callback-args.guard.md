# Guard log: plan 014 (gesture callbacks get upstream's arguments)

## 2026-11-21, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-014`, on a tip that already had plan 006. The executor confirmed 006's shape (getter callbacks, `inViewEnabled` latch, `createInViewGesture`) matched the plan's assumptions. No STOP conditions fired.
- **Red reproduced by the guard:** with `gestures.ts` reverted, `vitest run src/lib/utils/gestures.spec.ts` → 6 failed, 26 passed.
- **Green reproduced:** `gestures.spec.ts` plus `_MotionContainer.spec.ts` plus `index.spec.ts` → 111/111.
- **Executor-reported red:** `_MotionContainer` tests 1, 2 and 4, and e2e 3/3. Test 3 already passed, which the plan allows.
- **Diff read in full:**
  - `postRender` forwards arguments.
  - Hover and tap use upstream's events and `extractEventInfo`. A repeat passes the press event.
  - The viewport callbacks run synchronously with the entry: the upstream name first, then the alias.
  - Types and `index.ts` exports are added; focus callbacks are unchanged.
  - Docs gain a "Callback arguments" section.
- **Behaviour change, called out in the changeset:** `onInViewStart`/`onInViewEnd` used to run after the next render; they now run synchronously.
- **Executor-reported, not re-run:**
  - `pnpm test:only` 1797 passed, `pnpm check` 0 errors, `pnpm build` ok;
  - `e2e/motion e2e/armed-buttons e2e/lazy-motion e2e/variants` plus the new spec: 166 passed, 1 skipped;
  - Trunk no new issues.
- **Needs maintainer sign-off:** `/tests/motion/gesture-callback-args` is a new tester page.
- **Integrated:** `c27b7f97` on `fix/2.14.1`.
