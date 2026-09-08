Updated only the first test in [owned-child.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/e2e/animate-presence/owned-child.spec.ts:11).

- Replaced fixed `120ms` wait with `expect.poll`, timeout `500ms`, intervals `[16, 32, 50]`.
- Preserved strict opacity `< 0.95`, original-node identity, no-clone, eventual removal, and exit-count assertions.
- All other tests remain byte-identical.
- Passed `git diff --check`, Prettier check, and file-scoped ESLint.
- Playwright, builds, installs, and other tests were not run.

Verbatim relay: `Expected <0.95 Received 0.98175` is now handled by observing fade progress instead of assuming compositor progress after 120ms.
