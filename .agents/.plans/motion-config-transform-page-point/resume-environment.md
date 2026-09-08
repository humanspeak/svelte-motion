# Resume environment evidence — 2026-09-08

Source snapshot: 13ec152. Plan tip: a365240. These are guard-reproduced environment/docs checks during Step A; runtime has not been revised or endorsed.

- Isolated `/tmp/svelte-motion-react-parity-1320/node_modules`: React 19.1.1, ReactDOM 19.1.1, motion 13.2.0, framer-motion 13.2.0, motion-dom 13.2.0, motion-utils 13.0.0, Vite 8.2.2. Installed by guard with npm prefix, no project dependency or lock changes. Direct package metadata verified; npm ls without a fixture manifest did not enumerate this no-save installation.
- In-app browser selection failed; troubleshooting read and discovery returned an empty list. Playwright Chromium remains available for automated verification. No live visual review claimed.
- Docs metadata: 5/5 pass. Log `/tmp/transform-page-point-resume-docs-seo.log`.
- Docs production build: exit 0, including generated registry, GitHub stats, mirrors and cards. Log `/tmp/transform-page-point-resume-docs-build.log`. Registry generator changed only unrelated tracked animated-tabs.json class ordering; guard restored its exact HEAD content after build, preserving feature scope.
- Initial docs check: 9 errors/13 warnings, including absent generated registry/stats files. After normal generation: 6 errors/13 warnings. Clean 14046a5 baseline reproduced the same 6 errors/13 warnings under the current environment. Errors are existing keyframes x:null (1), transform-template rune/state naming (4), and PostHog dynamic public env token typing (1). No new feature-file diagnostics. This supersedes the earlier host baseline count of 5 errors; the extra PostHog typing issue reproduces on both snapshots in this environment.
- Logs: `/tmp/transform-page-point-resume-docs-check-generated.log`, `/tmp/transform-page-point-resume-baseline-docs-check.log`.

No public React behavior results are recorded yet. Source-derived leads (not observed reference outcomes): config distinguishes omitted keys from explicit undefined; pan unmount does not synthesize onPanEnd; drag delta is frame-relative and velocity uses frame history, while the Svelte draft differs. These require the public fixture comparison before runtime decisions.
