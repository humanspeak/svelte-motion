# Guard log: plan 002 (`fx` prop)

**Verdict: PASS** (2026-11-14). Executor: opus, lane `lane/14140-fx` (`41ed152e` red, `37fbb0b6` fix), merged into `feat/motion-14.14.0` without squash.

## Reproduced by the guard
- Diff: nine files, all in scope. The runtime change is one line in `derivedAttrs` (`'fx' in spreadAttrs ? { fx: spreadAttrs.fx ? '' : undefined } : {}`), matching upstream `filter-props.ts:32-39` @ v14.14.0.
- `pnpm check`: 0 errors (36 pre-existing warnings).
- `vitest run fxProp.spec.ts _MotionContainer.ssr.spec.ts`: 19/19 passed. The executor reported 20; to be recounted in the full unit run after the wave-2 merge.
- `pnpm build` ok; `PW_PORT=4272 … e2e/motion/fx-prop.spec.ts`: 2/2 passed (including the JS-disabled server-markup test).

## Taken from the executor, not reproduced
- Red results before the fix; docs build/check; full `pnpm test:only` (1721).

## Accepted deviations
- Test 2 (`fx={false}`) was also red before the fix: a `true → false` re-render left `fx="false"`. That is an existing bug, which the same line fixes.
- `api-reference/+page.svx` had no prop table, so the executor added a small "Advanced props" section with one `fx` row.
- The "server" unit test renders in jsdom, like its neighbours; the e2e JS-disabled test is the real SSR check.
