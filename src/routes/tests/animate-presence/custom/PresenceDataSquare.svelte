<script lang="ts">
    /**
     * Renders an animated square that reads directional custom data from the
     * nearest AnimatePresence boundary.
     *
     * @component
     * @param color CSS color used as the square background.
     * @param slideKey Numeric slide identifier exposed to the e2e harness.
     * @example
     * ```svelte
     * <PresenceDataSquare color="blue" slideKey={0} />
     * ```
     */
    import { motion, usePresenceData, type Variants } from '$lib'

    let { color, slideKey }: { color: string; slideKey: number } = $props()

    const direction = $derived(usePresenceData<1 | -1>() ?? 1)
    const normalizeDirection = (custom: unknown): 1 | -1 => (custom === -1 ? -1 : 1)
    const variants: Variants = {
        enter: (custom: unknown) => ({
            opacity: 0,
            x: normalizeDirection(custom) * 50
        }),
        center: {
            opacity: 1,
            x: 0,
            transition: {
                delay: 0.2,
                type: 'spring',
                visualDuration: 0.3,
                bounce: 0.4
            }
        },
        exit: (custom: unknown) => ({
            opacity: 0,
            x: normalizeDirection(custom) * -50
        })
    }
</script>

<motion.div
    key={String(slideKey)}
    class="presence-data-square"
    data-testid="presence-data-square"
    data-slide={slideKey}
    custom={direction}
    {variants}
    initial="enter"
    animate="center"
    exit="exit"
    style={`background-color: ${color};`}
/>

<style>
    :global(.presence-data-square) {
        width: 150px;
        height: 150px;
        border-radius: 10px;
        transform-origin: 50% 50%;
    }
</style>
