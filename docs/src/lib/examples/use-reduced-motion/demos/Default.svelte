<script lang="ts">
    import { motion, styleString, useReducedMotion } from '@humanspeak/svelte-motion'

    // `useReducedMotion()` returns a `$state`-backed `{ current }` object
    // wired to the `(prefers-reduced-motion: reduce)` media query. Use it
    // to gate any non-essential animation — combine with an in-page
    // override so users can opt in/out independently of OS settings.
    const reduced = useReducedMotion()
    let forceReduced = $state(false)
    const effective = $derived(reduced.current || forceReduced)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-reduced-motion</span>
            <span class="micro state">
                policy: {effective ? 'reduce' : 'no-preference'}
            </span>
        </div>

        <div class="stage">
            <motion.div
                aria-label={effective ? 'Animation disabled' : 'Animation enabled'}
                animate={effective ? { rotate: 0 } : { rotate: 360 }}
                transition={effective
                    ? { duration: 0 }
                    : { repeat: Infinity, ease: 'linear', duration: 4 }}
                style={styleString(() => ({
                    width: 108,
                    height: 108,
                    border: '1px solid var(--brut-ink, #0a0a0a)',
                    background: 'var(--brut-bg-2, #eef4f1)',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                    transformOrigin: '50% 50%'
                }))}
            ></motion.div>
        </div>

        <div class="info">
            <div class="row">
                <span class="micro">os preference</span>
                <span class="micro state">{reduced.current ? 'reduce' : 'no-preference'}</span>
            </div>
            <label class="override">
                <input type="checkbox" bind:checked={forceReduced} />
                <span class="micro">force reduced motion (in-page override)</span>
            </label>
            <p class="hint">
                Tip: Chrome DevTools → Rendering → emulate
                <code>prefers-reduced-motion: reduce</code> to test the OS path.
            </p>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 440px;
    }

    .strip {
        width: 100%;
        max-width: 420px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .state {
        color: var(--brut-accent, #247768);
    }

    .strip-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .stage {
        height: 11rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .info {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
    }

    .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }

    .override {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
    }

    .override input {
        accent-color: var(--brut-accent, #247768);
    }

    .hint {
        margin: 0;
        font-size: 0.6875rem;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .hint code {
        font-family: var(--brut-mono, monospace);
        color: var(--brut-ink-2, #525252);
    }
</style>
