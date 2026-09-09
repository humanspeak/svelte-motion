Round-two changes are ready for guard verification.

- `_MotionContainer` now forwards public drag callbacks into VisualElement props, so callback-reference replacements trigger the existing projection/update-options commit lifecycle while preserving the active gesture and hot-swapping handlers: [_MotionContainer.svelte](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/html/_MotionContainer.svelte:600).
- The parity fixture now models React’s fresh public handler references on equivalent parent state updates. The artificial `data-fixture-commit` sentinel was removed: [drag fixture](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/routes/tests/transform-page-point/drag/+page.svelte:52).
- E2E coverage now asserts the exact `1088` stable-scale commit, `1104` retained sample/velocity, target geometry, pre-regrab position `(530,335)`, and callback `point.x = 60`: [transform-page-point.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/e2e/drag/transform-page-point.spec.ts:363).
- Added unit coverage proving callback replacements update the same VisualElement: [_MotionContainer.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/html/_MotionContainer.spec.ts:343).
- Expanded the minor changeset to disclose no-config threshold, frame sampling, delta/offset, velocity, terminal, and teardown compatibility changes: [changeset](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/.changeset/motion-config-transform-page-point.md:9).

The public-prop equivalence is deliberate: React creates fresh `onDrag*` closures on each relevant render. Svelte compiler-stabilizes inline handlers, so the fixture replaces those public references when the same action state changes. They then flow through normal props → `visualElement.update()` → live `updateOptions()`; active commits use the existing projection flush, while inactive resize commits refresh ref constraints before resize scaling.

Validation:

- 50 focused component/drag unit tests passed.
- `npm run check`: zero errors; 39 existing warnings.
- Scoped ESLint passed for the test and fixture files.
- Direct ESLint of `_MotionContainer.svelte` remains blocked by seven pre-existing lint findings unrelated to this change.
- No browser, full build, Reorder, controls route/test, reference, dependency, git, or `.agents` changes were made.

The isolated controls probe is under `/tmp/svelte-motion-react-parity-1320/` as `controls.html`, `src/controls.js`, `src/controls.css`, and `run-controls-reference.mjs`. Run against the existing Vite server:

```sh
cd /tmp/svelte-motion-react-parity-1320
FEATURE_WORKTREE=/Users/jasonkummerl/Github/svelte-motion-transform-page-point \
REACT_CONTROLS_OUTPUT=/tmp/svelte-motion-react-parity-1320/react-controls-reference.json \
node ./run-controls-reference.mjs
```

If port 4299 is not already serving that fixture:

```sh
cd /tmp/svelte-motion-react-parity-1320
./node_modules/.bin/vite --host 127.0.0.1 --port 4299 --strictPort
```

Exact 29-case parity and the controls conclusions remain unclaimed until guard runs those browser checks.
