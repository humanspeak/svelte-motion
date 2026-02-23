<script lang="ts">
    import { motion, useScroll, useSpring } from '@humanspeak/svelte-motion'

    let containerEl: HTMLElement | undefined = $state(undefined)

    // Pass a getter so useScroll resolves the element after mount
    const { scrollYProgress } = useScroll({ container: () => containerEl })
    const scaleX = useSpring(scrollYProgress)

    const colors = ['#ff0088', '#dd00ff', '#0088ff', '#00cc88', '#ffaa00']
</script>

<div class="wrapper">
    <div class="progress-bar" style="transform: scaleX({$scaleX});"></div>

    <div class="scroll-area" bind:this={containerEl}>
        {#each colors as color, i (color)}
            <motion.div
                class="card"
                style="background: {color}"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
            >
                <span class="card-number">{i + 1}</span>
            </motion.div>
        {/each}
    </div>
</div>

<style>
    .wrapper {
        width: 100%;
        max-width: 400px;
        height: 320px;
        display: flex;
        flex-direction: column;
        border-radius: 12px;
        overflow: hidden;
        background: #f0f0f5;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    :global(.dark) .wrapper {
        background: #1a1a2e;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }

    .progress-bar {
        flex-shrink: 0;
        height: 6px;
        background: #ff0088;
        transform-origin: left;
        z-index: 10;
        border-radius: 0 3px 3px 0;
    }

    .scroll-area {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .scroll-area::-webkit-scrollbar {
        width: 4px;
    }

    .scroll-area::-webkit-scrollbar-track {
        background: transparent;
    }

    .scroll-area::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
        border-radius: 2px;
    }

    :global(.dark) .scroll-area::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
    }

    /* :global() required because .card is on a motion.div component —
	   Svelte doesn't add the scoping hash to component class props */
    .scroll-area :global(.card) {
        flex-shrink: 0;
        height: 150px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .card-number {
        font-size: 2rem;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.9);
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
</style>
