Updated only [run-svelte-reference.mjs](/tmp/svelte-motion-react-parity-1320/run-svelte-reference.mjs):

- Lines 108–166: bounded, target-specific native scroll delivery checks.
- Lines 216–326: all `waitForFunction` calls use 10 ms timer polling with explicit timeouts.
- Lines 367–375: partial clock/trace capture on failure.
- Lines 387–392: per-case progress output to stderr.
- Fixed RAF schedule and comparison tolerances remain unchanged.

Validation passed:

```sh
node --check /tmp/svelte-motion-react-parity-1320/run-svelte-reference.mjs
```

No tests, browsers, Git commands, or other writes were performed.
