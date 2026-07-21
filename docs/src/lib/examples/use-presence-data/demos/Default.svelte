<script lang="ts" module>
    const iconsProps = {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '24',
        height: '24',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: '2',
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
    }
</script>

<script lang="ts">
    import { AnimatePresence, MotionConfig, motion, wrap } from '@humanspeak/svelte-motion'
    import PresenceDataSlide from './PresenceDataSlide.svelte'

    const items = [1, 2, 3, 4, 5, 6]

    let selectedItem = $state(items[0])
    let direction: 1 | -1 = $state(1)

    const color = $derived(`var(--presence-hue-${selectedItem})`)

    function setSlide(newDirection: 1 | -1) {
        selectedItem = wrap(1, items.length, selectedItem + newDirection)
        direction = newDirection
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <MotionConfig>
        <div class="strip">
            <div class="strip-head">
                <span class="micro">// use-presence-data</span>
                <span class="micro readout">
                    slide {String(selectedItem).padStart(2, '0')} / custom={direction}
                </span>
            </div>

            <div class="container">
                <motion.button
                    initial={false}
                    animate={{ backgroundColor: color }}
                    aria-label="Previous"
                    class="button"
                    onclick={() => setSlide(-1)}
                    whileFocus={{ outline: `2px solid ${color}` }}
                    whileTap={{ scale: 0.9 }}
                >
                    <svg {...iconsProps}>
                        <path d="m12 19-7-7 7-7" />
                        <path d="M19 12H5" />
                    </svg>
                </motion.button>

                <AnimatePresence custom={direction} initial={false} mode="popLayout">
                    {#key selectedItem}
                        <PresenceDataSlide slideKey={selectedItem} {color} />
                    {/key}
                </AnimatePresence>

                <motion.button
                    initial={false}
                    animate={{ backgroundColor: color }}
                    aria-label="Next"
                    class="button"
                    onclick={() => setSlide(1)}
                    whileFocus={{ outline: `2px solid ${color}` }}
                    whileTap={{ scale: 0.9 }}
                >
                    <svg {...iconsProps}>
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                    </svg>
                </motion.button>
            </div>

            <div class="strip-foot">
                <span class="micro">mode: poplayout / exit reads usePresenceData()</span>
            </div>
        </div>
    </MotionConfig>
</div>

<style>
    .dk-demo-shell {
        --presence-hue-1: #ff0088;
        --presence-hue-2: #dd00ee;
        --presence-hue-3: #9911ff;
        --presence-hue-4: #0d63f8;
        --presence-hue-5: #0cdcf7;
        --presence-hue-6: #4ff0b7;

        min-height: 360px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
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

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
        justify-content: center;
    }

    .container {
        position: relative;
        height: 12rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
    }

    .dk-demo-shell :global(.button) {
        position: relative;
        z-index: 1;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--brut-ink, #0a0a0a);
        outline-offset: 2px;
        color: #ffffff;
        cursor: pointer;
    }

    .dk-demo-shell :global(.button svg) {
        width: 24px;
        height: 24px;
    }
</style>
