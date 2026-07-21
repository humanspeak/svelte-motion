<script lang="ts">
    import { motion, usePresenceData, type Variants } from '@humanspeak/svelte-motion'

    const { color, slideKey }: { color: string; slideKey: number } = $props()

    const direction = $derived(usePresenceData<1 | -1>() ?? 1)
    const variants = {
        enter: (custom: unknown) => ({
            opacity: 0,
            x: (custom as 1 | -1) * 50
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
            x: (custom as 1 | -1) * -50
        })
    } as unknown as Variants
</script>

<motion.div
    key={String(slideKey)}
    class="box"
    data-testid="presence-data-square"
    data-slide={slideKey}
    custom={direction}
    {variants}
    initial="enter"
    animate="center"
    exit="exit"
    style={`background-color: ${color};`}
>
    {String(slideKey).padStart(2, '0')}
</motion.div>

<style>
    :global(.dk-demo-shell .box) {
        width: 150px;
        height: 150px;
        display: grid;
        place-items: center;
        border: 1px solid var(--brut-ink, #0a0a0a);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        transform-origin: 50% 50%;
        font-family: var(--brut-mono, monospace);
        font-size: 1.5rem;
        font-weight: 700;
        color: #ffffff;
    }
</style>
