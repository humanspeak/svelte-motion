<script lang="ts">
    import { motion, styleString, type Variants } from '@humanspeak/svelte-motion'

    // A collapsed-stack ↔ expanded-list transition driven by a single boolean.
    // The parent's `animate={isOpen ? 'open' : 'closed'}` cascades into every
    // child via `variants` — header, notifications, and stack chrome each
    // expose their own `open` / `closed` definitions and run independently
    // but coherently.
    const N_NOTIFICATIONS = 3
    const NOTIFICATION_HEIGHT = 60
    const NOTIFICATION_WIDTH = 280
    const NOTIFICATION_GAP = 8

    let isOpen = $state(false)

    const stackVariants: Variants = {
        open: { y: 20, scale: 0.9, cursor: 'pointer' },
        closed: { y: 0, scale: 1, cursor: 'default' }
    }

    const headerVariants: Variants = {
        open: { y: 0, scale: 1, opacity: 1 },
        closed: { y: 60, scale: 0.8, opacity: 0 }
    }

    function getNotificationVariants(index: number): Variants {
        return {
            open: {
                y: 0,
                scale: 1,
                opacity: 1,
                pointerEvents: 'auto',
                cursor: 'pointer'
            },
            closed: {
                y: -index * (NOTIFICATION_HEIGHT + 2 * NOTIFICATION_GAP),
                scale: 1 - index * 0.1,
                opacity: 1 - index * 0.4,
                pointerEvents: index === 0 ? 'auto' : 'none',
                cursor: index === 0 ? 'pointer' : 'default'
            }
        }
    }

    function getNotificationStyle(index: number): string {
        return styleString(() => ({
            height: NOTIFICATION_HEIGHT,
            width: NOTIFICATION_WIDTH,
            backgroundColor: 'var(--brut-bg-2, #eef4f1)',
            border: '1px solid var(--brut-ink, #0a0a0a)',
            boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: N_NOTIFICATIONS - index,
            userSelect: 'none',
            fontFamily: 'var(--brut-mono, monospace)',
            fontSize: '0.8125rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--brut-ink, #0a0a0a)'
        }))
    }

    const headerButtonStyle = styleString(() => ({
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.625rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        lineHeight: 1,
        marginRight: '8px',
        padding: '4px 12px',
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--brut-accent, #247768)',
        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
        border: '1px solid var(--brut-accent, #247768)',
        cursor: 'pointer',
        pointerEvents: 'auto',
        userSelect: 'none'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <motion.div
        style={styleString(() => ({
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: `${NOTIFICATION_GAP}px`,
            width: `${NOTIFICATION_WIDTH}px`
        }))}
        variants={stackVariants}
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        transition={{ type: 'spring', mass: 0.7 }}
    >
        <motion.div
            style={styleString(() => ({
                position: 'absolute',
                top: -40,
                left: 0,
                height: 28,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transformOrigin: 'bottom center',
                pointerEvents: 'none'
            }))}
            variants={headerVariants}
            transition={{
                type: 'spring',
                stiffness: 600,
                damping: 50,
                delay: isOpen ? 0.2 : 0
            }}
        >
            <motion.h2
                style={styleString(() => ({
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: 16,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    lineHeight: 1,
                    marginLeft: 8,
                    color: 'var(--brut-ink, #0a0a0a)'
                }))}
            >
                Notifications
            </motion.h2>
            <motion.button
                style={headerButtonStyle}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onclick={() => (isOpen = false)}
            >
                Collapse
            </motion.button>
        </motion.div>

        <!-- trunk-ignore(eslint/@typescript-eslint/no-unused-vars) -->
        {#each Array.from({ length: N_NOTIFICATIONS }) as _, i (i)}
            <motion.div
                role="button"
                tabindex="0"
                aria-pressed={isOpen}
                aria-label="Toggle notification stack"
                variants={getNotificationVariants(i)}
                transition={{
                    type: 'spring',
                    stiffness: 600,
                    damping: 50,
                    delay: i * 0.04
                }}
                style={getNotificationStyle(i)}
                onclick={() => (isOpen = !isOpen)}
                onkeydown={(e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        isOpen = !isOpen
                    }
                }}
            >
                Note {i + 1}
            </motion.div>
        {/each}
    </motion.div>

    <div class="status">
        <span class="micro">state:</span>
        <span class="state-value">{isOpen ? 'open' : 'closed'}</span>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2rem;
        padding: 2rem;
        min-height: 460px;
    }

    .status {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .state-value {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--brut-accent, #247768);
    }
</style>
