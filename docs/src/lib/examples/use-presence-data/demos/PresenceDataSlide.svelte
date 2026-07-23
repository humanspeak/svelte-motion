<script lang="ts">
    /**
     * Slide that reads AnimatePresence custom data with usePresenceData.
     *
     * @component
     * @param color CSS color used as the slide background.
     * @param slideKey Numeric slide id displayed by the example.
     */
    import { motion, usePresenceData, type Variants } from '@humanspeak/svelte-motion'

    const { color, slideKey }: { color: string; slideKey: number } = $props()

    const direction = $derived(usePresenceData<1 | -1>() ?? 1)
    const variants: Variants = {
        enter: (custom) => ({
            opacity: 0,
            x: (custom as number) > 0 ? 56 : -56
        }),
        center: {
            opacity: 1,
            x: 0,
            transition: {
                delay: 0.16,
                type: 'spring',
                visualDuration: 0.34,
                bounce: 0.36
            }
        },
        exit: (custom) => ({
            opacity: 0,
            x: (custom as number) > 0 ? -56 : 56
        })
    }
</script>

<motion.div
    key={String(slideKey)}
    class="slide"
    data-presence-direction={direction}
    {variants}
    initial="enter"
    animate="center"
    exit="exit"
    style={`background-color: ${color};`}
>
    <span>{String(slideKey).padStart(2, '0')}</span>
</motion.div>

<style>
    :global(.dk-demo-shell .slide) {
        width: 150px;
        height: 150px;
        display: grid;
        place-items: center;
        border: 1px solid var(--brut-ink, #0a0a0a);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        transform-origin: 50% 50%;
        font-family: var(--brut-mono, monospace);
        font-size: 2rem;
        font-weight: 700;
        color: #ffffff;
    }
</style>
