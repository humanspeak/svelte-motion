<script lang="ts">
    import {
        MotionConfig,
        motion,
        styleString,
        useReducedMotionConfig,
        type ReducedMotionConfig
    } from '@humanspeak/svelte-motion'

    // `useReducedMotionConfig()` returns the resolved policy — combining the
    // nearest <MotionConfig reducedMotion="..."> ancestor with the OS-level
    // `prefers-reduced-motion` setting. Use it when a *parent* wants to
    // override what the OS says (e.g. a kiosk app that disables motion
    // regardless of the user's preference).
    const POLICIES = ['never', 'user', 'always'] as const satisfies readonly ReducedMotionConfig[]
    let policy = $state<ReducedMotionConfig>('user')
    const reduced = useReducedMotionConfig()
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-reduced-motion-config</span>
            <span class="micro state">
                resolved: {reduced.current ? 'reduce' : 'no-preference'}
            </span>
        </div>

        <div class="stage">
            <MotionConfig reducedMotion={policy}>
                <motion.div
                    aria-label={reduced.current ? 'Animation disabled' : 'Animation enabled'}
                    animate={reduced.current ? { rotate: 0 } : { rotate: 360 }}
                    transition={reduced.current
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
            </MotionConfig>
        </div>

        <div class="info">
            <span class="micro">&lt;MotionConfig reducedMotion="…"&gt;</span>
            <fieldset class="segmented" aria-label="MotionConfig reducedMotion policy">
                {#each POLICIES as option (option)}
                    <label class="seg">
                        <input type="radio" name="policy" value={option} bind:group={policy} />
                        <span>{option}</span>
                    </label>
                {/each}
            </fieldset>
            <p class="hint">
                Tip: Chrome DevTools → Rendering → emulate
                <code>prefers-reduced-motion: reduce</code> to verify the
                <code>'user'</code> path honors the OS setting.
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
        min-height: 460px;
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

    .segmented {
        display: flex;
        margin: 0;
        padding: 0;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    .segmented legend {
        display: none;
    }

    .seg {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.4rem 0.5rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--brut-ink-2, #525252);
        cursor: pointer;
        border-left: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    .seg:first-of-type {
        border-left: none;
    }

    .seg input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .seg:has(input:checked) {
        background: var(--brut-accent, #247768);
        color: var(--brut-accent-ink, #f8fcfb);
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
