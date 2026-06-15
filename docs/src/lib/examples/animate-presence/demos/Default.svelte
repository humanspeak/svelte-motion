<script lang="ts">
    import { AnimatePresence, MotionConfig, motion, styleString } from '@humanspeak/svelte-motion'

    // A `motion.*` element inside `<AnimatePresence>` with an `exit` prop runs
    // that animation when the element is removed from the DOM. Toggle the
    // visibility — the cyan box scales + fades in on mount, then runs its
    // `exit` (scale + fade out) when it leaves, all on the same spring.
    let isVisible = $state(true)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <MotionConfig transition={{ duration: 0.6 }}>
        <!-- Fixed height container prevents the button from moving as the box enters/exits. -->
        <div class="stage">
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
        >
            {isVisible ? 'Hide' : 'Show'}
        </motion.button>

        <div class="status">
            State: <span class="state-value">{isVisible ? 'visible' : 'hidden'}</span>
        </div>
    </MotionConfig>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1rem;
        padding: 2rem;
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
        color: var(--color-text-secondary);
    }

    .state-value {
        font-family: monospace;
        font-weight: 600;
        color: var(--color-text-primary);
    }
</style>
