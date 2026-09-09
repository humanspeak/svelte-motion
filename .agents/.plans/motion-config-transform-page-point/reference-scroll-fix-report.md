STATUS: PASS

- Changed: `/tmp/svelte-motion-react-parity-1320/run-reference.mjs`
- Reason: Both scroll operations now await a new, target-specific `dom:scroll` trace with exact expected coordinates before continuing. Timeouts become precondition failures with partial trace evidence.
- Preserved: Existing geometric and coordinate preconditions; no synthetic events or sleeps.
- Verification: `node --check run-reference.mjs` passed.
- No browsers, source/tests/docs/plans/dependencies, `.agents`, or `.git` were touched.
