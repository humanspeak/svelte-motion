<script lang="ts">
    import { motion, AnimatePresence, stringifyStyleObject } from '@humanspeak/svelte-motion'

    let isVisible = $state(true)

    function toggleVisibility() {
        isVisible = !isVisible
    }
</script>

<div
    style={stringifyStyleObject({
        background: 'var(--color-background-secondary)',
        borderRadius: 8,
        padding: '2rem',
        margin: '2rem 0'
    })}
>
    <div
        style={stringifyStyleObject({
            display: 'flex',
            minHeight: '200px',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem'
        })}
    >
        <!-- Fixed height container prevents button from moving -->
        <div
            style={stringifyStyleObject({
                height: 100,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            })}
        >
            <AnimatePresence>
                {#if isVisible}
                    <motion.div
                        key="box"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        style={stringifyStyleObject({
                            width: 100,
                            height: 100,
                            borderRadius: 16,
                            backgroundColor: '#06b6d4',
                            color: '#0f1115',
                            fontWeight: 600,
                            transformOrigin: 'center',
                            textAlign: 'center',
                            lineHeight: '100px'
                        })}
                    >
                        Hello
                    </motion.div>
                {/if}
            </AnimatePresence>
        </div>

        <motion.button
            onclick={toggleVisibility}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={stringifyStyleObject({
                width: 120,
                padding: '0.75rem 1.5rem',
                borderRadius: 8,
                border: 'none',
                backgroundColor: 'var(--color-text-primary)',
                color: 'var(--color-background)',
                cursor: 'pointer',
                fontWeight: 600,
                textAlign: 'center'
            })}
        >
            {isVisible ? 'Hide' : 'Show'}
        </motion.button>
    </div>

    <div
        style={stringifyStyleObject({
            textAlign: 'center',
            marginTop: '1rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)'
        })}
    >
        State: <span
            style={stringifyStyleObject({
                fontFamily: 'monospace',
                fontWeight: 600,
                color: 'var(--color-text-primary)'
            })}>{isVisible ? 'visible' : 'hidden'}</span
        >
    </div>
</div>
