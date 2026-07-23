<script lang="ts">
    import {
        LazyMotion,
        domAnimation,
        domMax,
        domMin,
        m,
        styleString
    } from '@humanspeak/svelte-motion'

    const bundles = [
        { label: 'domMin', features: domMin, note: 'animation only' },
        { label: 'domAnimation', features: domAnimation, note: 'gestures enabled' },
        { label: 'domMax', features: domMax, note: 'gestures + drag + layout' }
    ]
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    {#each bundles as bundle (bundle.label)}
        <LazyMotion features={bundle.features}>
            <section class="bundle">
                <header>
                    <span class="micro label">// {bundle.label}</span>
                    <span class="note">{bundle.note}</span>
                </header>
                <div class="stage">
                    <m.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.14 }}
                        whileTap={{ scale: 0.92 }}
                        drag
                        style={styleString(() => ({
                            // Wide enough for the longest label (DOMANIMATION)
                            // with breathing room — 72px clipped it.
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
                            cursor: 'grab',
                            userSelect: 'none'
                        }))}
                    >
                        {bundle.label}
                    </m.div>
                </div>
            </section>
        </LazyMotion>
    {/each}
</div>

<style>
    .dk-demo-shell {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        width: 100%;
        padding: 1rem;
    }

    .bundle {
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

    @media (max-width: 720px) {
        .dk-demo-shell {
            grid-template-columns: 1fr;
        }
    }
</style>
