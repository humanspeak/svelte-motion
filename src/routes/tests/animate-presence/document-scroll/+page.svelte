<script lang="ts">
    import { AnimatePresence, MotionConfig, motion, styleString } from '$lib'

    let isVisible = $state(true)
</script>

<svelte:head>
    <title>AnimatePresence document scroll</title>
</svelte:head>

<main class="page-shell">
    <div class="demo-shell" data-testid="document-scroll-demo">
        <MotionConfig transition={{ duration: 0.6 }}>
            <div class="stage" data-testid="stage">
                <AnimatePresence>
                    {#if isVisible}
                        <motion.div
                            key="box"
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            style={styleString(() => ({
                                width: 100,
                                height: 100,
                                borderRadius: 16,
                                backgroundColor: '#06b6d4',
                                color: '#0f1115',
                                fontWeight: 600,
                                transformOrigin: 'center',
                                textAlign: 'center',
                                lineHeight: '100px'
                            }))}
                            data-testid="box"
                        >
                            Hello
                        </motion.div>
                    {/if}
                </AnimatePresence>
            </div>

            <motion.button
                onclick={() => (isVisible = !isVisible)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={styleString(() => ({
                    width: 100,
                    padding: '0.75rem 1.5rem',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#06b6d4',
                    color: '#0f1115',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textAlign: 'center'
                }))}
                data-testid="toggle"
            >
                {isVisible ? 'Hide' : 'Show'}
            </motion.button>

            <div class="status" data-testid="state-label">
                State: <span class="state-value">{isVisible ? 'visible' : 'hidden'}</span>
            </div>
        </MotionConfig>
    </div>
</main>

<style>
    :global(html) {
        background: #050808;
    }

    :global(body) {
        margin: 0;
        background: #050808;
    }

    :global(.container) {
        height: auto;
        min-height: 160vh;
        align-items: stretch;
    }

    :global(#sandbox) {
        height: auto;
        align-items: stretch;
    }

    .page-shell {
        min-height: 160vh;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        min-height: 360px;
    }

    .stage {
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .status {
        font-size: 0.875rem;
        color: rgb(255 255 255 / 0.7);
    }

    .state-value {
        font-family: monospace;
        font-weight: 600;
        color: white;
    }
</style>
