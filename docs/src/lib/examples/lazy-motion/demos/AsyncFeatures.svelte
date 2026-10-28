<script lang="ts">
    import {
        LazyMotion,
        domAnimation,
        m,
        styleString,
        type FeatureBundle
    } from '@humanspeak/svelte-motion'

    // The async card's loader resolves when "Load features" is pressed.
    let release = () => {}
    let loaded = $state(false)
    let generation = $state(0)

    const loadFeatures = () =>
        new Promise<FeatureBundle>((resolve) => {
            release = () => resolve(domAnimation)
        })

    const load = () => {
        loaded = true
        release()
    }

    const reset = () => {
        loaded = false
        generation += 1
    }

    const boxStyle = styleString(() => ({
        width: '120px',
        height: '72px',
        display: 'grid',
        placeItems: 'center',
        border: '1px solid var(--brut-ink, #0a0a0a)',
        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
        boxShadow: '4px 4px 0 var(--brut-rule, #d6dedb)',
        color: 'var(--brut-ink, #0a0a0a)',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.625rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        userSelect: 'none'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    {#key generation}
        <section class="card">
            <header>
                <span class="micro label">// no LazyMotion</span>
                <span class="note">stays at initial</span>
            </header>
            <div class="stage">
                <m.div
                    initial={{ opacity: 0.4, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.1 }}
                    style={boxStyle}
                >
                    bare m
                </m.div>
            </div>
        </section>

        <section class="card">
            <header>
                <span class="micro label">// async features</span>
                <span class="note">{loaded ? 'domAnimation loaded' : 'waiting for the bundle'}</span
                >
            </header>
            <div class="stage">
                <LazyMotion features={loadFeatures}>
                    <m.div
                        initial={{ opacity: 0.4, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.1 }}
                        style={boxStyle}
                    >
                        async m
                    </m.div>
                </LazyMotion>
            </div>
        </section>
    {/key}

    <div class="controls">
        <button type="button" onclick={load} disabled={loaded}>Load features</button>
        <button type="button" onclick={reset}>Reset</button>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
        width: 100%;
        padding: 1rem;
    }

    .card {
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        padding: 0.8rem;
    }

    header {
        display: grid;
        gap: 0.25rem;
        margin-bottom: 0.8rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .label {
        font-weight: 700;
        color: var(--brut-accent, #247768);
    }

    .note {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .stage {
        min-height: 140px;
        display: grid;
        place-items: center;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
    }

    .controls {
        grid-column: 1 / -1;
        display: flex;
        gap: 0.5rem;
    }

    button {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        padding: 0.5rem 0.9rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #fff);
        color: var(--brut-ink, #0a0a0a);
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.5;
        cursor: default;
    }

    @media (max-width: 720px) {
        .dk-demo-shell {
            grid-template-columns: 1fr;
        }
    }
</style>
