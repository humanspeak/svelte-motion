Implemented test/demo-only coverage on `feat/motion-config-transform-page-point`.

- Fixture: added isolated zero and nonzero initial-axis query cases with fixed controls, real 60px parent layout shift, `layout`, imperative `snapToCursor`, disabled listener/momentum, and no `MotionConfig`.
- Regression test: added real-pointer sequences covering frame-sampled `+150,+50` dragging, layout settling, zero-scroll/viewport preconditions, and first/second/third snap alignment within 2px.

Executor checks: Prettier, ESLint, git diff --check, svelte-check (0 errors, 39 existing warnings). No browser tests or runtime changes. Guard reproduces browser RED independently.
