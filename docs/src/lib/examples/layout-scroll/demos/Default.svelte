<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // Two side-by-side scroll containers. Identical FLIP animations
    // inside. Only the right one has `layoutScroll`. Click "expand",
    // then drag the scrollbar in either panel mid-animation:
    //   - Left:  the red box drifts (FLIP measures viewport-relative
    //            rects, so the scroll offset leaks into the delta).
    //   - Right: the teal box stays anchored (layoutScroll re-bases
    //            measurements in the scroll container's coordinate
    //            space).

    let expanded = $state(false)
    const sizeRest = '120px'
    const sizeExpanded = '220px'

    // Slow tween so a viewer has time to grab the scrollbar mid-animation
    // and actually feel the difference between the two panels.
    const slowTransition = { duration: 1.8, ease: 'easeInOut' as const }

    function toggle() {
        expanded = !expanded
    }
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div
        style={styleString(() => ({
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            background: 'var(--color-background-secondary)',
            borderRadius: 8,
            width: '100%',
            maxWidth: '720px'
        }))}
    >
        <motion.button
            whileTap={{ scale: 0.96 }}
            whileHover={{ scale: 1.03, backgroundColor: 'var(--color-brand-600)' }}
            onclick={toggle}
            style={styleString(() => ({
                alignSelf: 'flex-start',
                padding: '0.55rem 1.1rem',
                background: 'var(--color-brand-500)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                boxShadow:
                    '0 4px 14px -4px color-mix(in oklab, var(--color-brand-500) 70%, transparent)'
            }))}
        >
            {expanded ? 'shrink box' : 'expand box →'}
        </motion.button>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <article>
                <header
                    style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"
                >
                    <strong style="font-size: 0.85rem;">without <code>layoutScroll</code></strong>
                    <span
                        style="font-size: 0.72rem; padding: 1px 6px; border-radius: 4px; color: #b91c1c; background: #fee2e2;"
                    >
                        drifts on scroll
                    </span>
                </header>
                <div
                    style={styleString(() => ({
                        overflow: 'auto',
                        height: '240px',
                        border: '1px solid var(--color-border, #bbb)',
                        borderRadius: 8,
                        background: 'var(--color-background, #fff)'
                    }))}
                >
                    <div style="height: 60px;"></div>
                    <motion.div
                        layout
                        transition={slowTransition}
                        style={styleString(() => ({
                            width: expanded ? sizeExpanded : sizeRest,
                            height: expanded ? sizeExpanded : sizeRest,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg,#ef4444 0%,#f97316 100%)',
                            margin: '0 auto'
                        }))}
                    ></motion.div>
                    <div style="height: 360px;"></div>
                </div>
            </article>

            <article>
                <header
                    style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;"
                >
                    <strong style="font-size: 0.85rem;">with <code>layoutScroll</code></strong>
                    <span
                        style="font-size: 0.72rem; padding: 1px 6px; border-radius: 4px; color: #047857; background: #d1fae5;"
                    >
                        stays anchored
                    </span>
                </header>
                <motion.div
                    layoutScroll
                    style={styleString(() => ({
                        overflow: 'auto',
                        height: '240px',
                        border: '1px solid var(--color-border, #bbb)',
                        borderRadius: 8,
                        background: 'var(--color-background, #fff)'
                    }))}
                >
                    <div style="height: 60px;"></div>
                    <motion.div
                        layout
                        transition={slowTransition}
                        style={styleString(() => ({
                            width: expanded ? sizeExpanded : sizeRest,
                            height: expanded ? sizeExpanded : sizeRest,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg,#22c55e 0%,#06b6d4 100%)',
                            margin: '0 auto'
                        }))}
                    ></motion.div>
                    <div style="height: 360px;"></div>
                </motion.div>
            </article>
        </div>
    </div>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 460px;
    }
</style>
