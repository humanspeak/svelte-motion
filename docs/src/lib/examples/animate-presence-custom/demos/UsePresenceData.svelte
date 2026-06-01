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

    const color = $derived(`var(--hue-${selectedItem})`)

    function setSlide(newDirection: 1 | -1) {
        const nextItem = wrap(1, items.length, selectedItem + newDirection)
        selectedItem = nextItem
        direction = newDirection
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <MotionConfig>
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
    </MotionConfig>
</div>

<style>
    .dk-demo-shell {
        --hue-1: #ff0088;
        --hue-2: #dd00ee;
        --hue-3: #9911ff;
        --hue-4: #0d63f8;
        --hue-5: #0cdcf7;
        --hue-6: #4ff0b7;

        min-height: 360px;
        display: grid;
        place-items: center;
        padding: 2rem;
        background:
            linear-gradient(90deg, rgba(114, 217, 247, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(114, 217, 247, 0.1) 1px, transparent 1px), #0e161c;
        background-size: 44px 44px;
        color: white;
    }

    .container {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
    }

    .dk-demo-shell :global(.button) {
        position: relative;
        z-index: 1;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 50%;
        outline-offset: 2px;
        color: white;
        cursor: pointer;
    }

    .dk-demo-shell :global(.button svg) {
        width: 24px;
        height: 24px;
    }
</style>
