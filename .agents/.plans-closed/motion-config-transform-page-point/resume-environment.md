# Resume environment evidence — 2026-09-08

Source snapshot: 13ec152. Plan tip: a365240. These are guard-reproduced environment/docs checks during Step A; runtime has not been revised or endorsed.

- Isolated `/tmp/svelte-motion-react-parity-1320/node_modules`: React 19.1.1, ReactDOM 19.1.1, motion 13.2.0, framer-motion 13.2.0, motion-dom 13.2.0, motion-utils 13.0.0, Vite 8.2.2. Installed by guard with npm prefix, no project dependency or lock changes. Direct package metadata verified; npm ls without a fixture manifest did not enumerate this no-save installation.
- In-app browser selection failed; troubleshooting read and discovery returned an empty list. Playwright Chromium remains available for automated verification. No live visual review claimed.
- Docs metadata: 5/5 pass. Log `/tmp/transform-page-point-resume-docs-seo.log`.
- Docs production build: exit 0, including generated registry, GitHub stats, mirrors and cards. Log `/tmp/transform-page-point-resume-docs-build.log`. Registry generator changed only unrelated tracked animated-tabs.json class ordering; guard restored its exact HEAD content after build, preserving feature scope.
- Initial docs check: 9 errors/13 warnings, including absent generated registry/stats files. After normal generation: 6 errors/13 warnings. Clean 14046a5 baseline reproduced the same 6 errors/13 warnings under the current environment. Errors are existing keyframes x:null (1), transform-template rune/state naming (4), and PostHog dynamic public env token typing (1). No new feature-file diagnostics. This supersedes the earlier host baseline count of 5 errors; the extra PostHog typing issue reproduces on both snapshots in this environment.
- Logs: `/tmp/transform-page-point-resume-docs-check-generated.log`, `/tmp/transform-page-point-resume-baseline-docs-check.log`.

No public React behavior results are recorded yet. Source-derived leads (not observed reference outcomes): config distinguishes omitted keys from explicit undefined; pan unmount does not synthesize onPanEnd; drag delta is frame-relative and velocity uses frame history, while the Svelte draft differs. These require the public fixture comparison before runtime decisions.

## Existing gesture browser baseline

Guard ran the clean 14046a5 baseline with `pnpm exec playwright test e2e/drag e2e/motion/pan-authored-transforms.spec.ts e2e/motion/pan.spec.ts --reporter=line` (there is no pan.spec.ts in this baseline; the other selectors ran 75 tests). Result: 73 passed, 1 skipped, 1 failed, 2.0 minutes. This was a targeted baseline run, not the full e2e suite. Build/package validation succeeded during startup. Log: `/tmp/transform-page-point-resume-baseline-gestures.log`.

Failure: `e2e/drag/snap-to-origin.spec.ts:49`, test “release animates back to origin instead of snapping instantly”: after an 80ms wait, expected tx <79, received79.2095. Screenshot inspected: the both-axes blue card remains displaced right/down. A static screenshot cannot establish animation timing. The page demonstrates springing back to the start on chosen axes; the remaining eventual-return/axis/regrab tests passed.

Isolated three-repeat command: `pnpm exec playwright test e2e/drag/snap-to-origin.spec.ts -g 'release animates back to origin instead of snapping instantly' --repeat-each=3 --reporter=line`. All3 failed the same <79 threshold, received80.7026,81.0457,80.8156. Log: `/tmp/transform-page-point-resume-baseline-snap-repeat.log`. The exact baseline assertion is consistently failing in this environment; no conclusion that it is introduced by this feature and no source/test changes. Repository full-suite review rule remains applicable when the final full suite runs.
