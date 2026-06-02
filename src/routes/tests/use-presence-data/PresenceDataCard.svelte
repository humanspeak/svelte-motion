<script lang="ts">
    /**
     * Test card that reads parent AnimatePresence custom data during enter
     * and exit variants.
     *
     * @component
     * @param id Stable card id exposed to the e2e harness.
     * @param label Text rendered inside the card.
     */
    import { motion, usePresenceData, type Variants } from '$lib'

    let { id, label }: { id: string; label: string } = $props()

    const direction = $derived(usePresenceData<1 | -1>() ?? 1)
    const variants: Variants = {
        enter: (custom) => ({
            x: (custom as number) > 0 ? 90 : -90,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (custom) => ({
            x: (custom as number) > 0 ? -90 : 90,
            opacity: 0
        })
    }
</script>

<motion.div
    key={id}
    class="card"
    data-testid="presence-data-card"
    data-card={id}
    data-presence-data={direction}
    {variants}
    initial="enter"
    animate="center"
    exit="exit"
    transition={{ duration: 0.5, ease: 'linear' }}
>
    <span>{label}</span>
    <small>presence data {direction}</small>
</motion.div>

<style>
    :global(.card) {
        position: absolute;
        width: min(320px, calc(100% - 32px));
        min-height: 128px;
        display: grid;
        align-content: center;
        gap: 10px;
        padding: 22px;
        border: 1px solid #72d9f7;
        background: #142230;
        box-shadow: 0 24px 70px rgba(0, 0, 0, 0.36);
        color: #edf7ff;
        transform-origin: 50% 50%;
    }

    :global(.card span) {
        font-size: 24px;
        font-weight: 800;
        line-height: 1.1;
    }

    :global(.card small) {
        color: #f5b7df;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
</style>
