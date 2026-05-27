<script lang="ts">
    import { LazyMotion, domAnimation, domMax, domMin, m } from '@humanspeak/svelte-motion'

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
                    <strong>{bundle.label}</strong>
                    <span>{bundle.note}</span>
                </header>
                <div class="stage">
                    <m.div
                        class="tile"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.14 }}
                        whileTap={{ scale: 0.92 }}
                        drag
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
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 0.8rem;
        background: rgba(255, 255, 255, 0.03);
    }

    header {
        display: grid;
        gap: 0.2rem;
        margin-bottom: 0.8rem;
    }

    strong {
        font-size: 0.9rem;
    }

    span {
        color: rgba(255, 255, 255, 0.58);
        font-size: 0.75rem;
    }

    .stage {
        min-height: 140px;
        display: grid;
        place-items: center;
        border: 1px dashed rgba(255, 255, 255, 0.14);
        border-radius: 6px;
    }

    :global(.tile) {
        width: 72px;
        height: 72px;
        display: grid;
        place-items: center;
        border-radius: 7px;
        background: #d8f16f;
        color: #101400;
        font-size: 0.7rem;
        font-weight: 800;
        cursor: grab;
        user-select: none;
    }

    @media (max-width: 720px) {
        .dk-demo-shell {
            grid-template-columns: 1fr;
        }
    }
</style>
