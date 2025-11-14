<script lang="ts">
    import { motion } from '$lib/index'
    import type { Snippet } from 'svelte'

    type Props = {
        children: Snippet
    }

    const { children }: Props = $props()
</script>

<motion.button
    class="radial-gradient relative rounded-md px-6 py-2"
    initial={{ '--x': '100%', scale: 1 }}
    animate={{ '--x': '-100%' }}
    whileTap={{ scale: 0.97 }}
    transition={{
        repeat: Infinity,
        repeatType: 'loop',
        repeatDelay: 1,
        type: 'spring',
        stiffness: 20,
        damping: 15,
        mass: 2,
        scale: {
            type: 'spring',
            stiffness: 10,
            damping: 5,
            mass: 0.1
        }
    }}
>
    <span
        class="linear-mask relative block h-full w-full font-light tracking-wide text-neutral-100"
    >
        {@render children?.()}
    </span>
    <span class="linear-overlay absolute inset-0 block rounded-md p-px"></span>
</motion.button>

<style lang="postcss">
    :global {
        :root {
            --radial-gradient-background: 250, 250, 250;
            --solid-color-background: 15, 15, 15;
            --overlay-color: 255, 255, 255;
        }
        .radial-gradient {
            background: radial-gradient(
                    circle at 50% 0%,
                    rgba(var(--radial-gradient-background), 0.05) 0%,
                    transparent 60%
                )
                rgba(var(--solid-color-background), 1);
        }
    }

    .linear-mask {
        mask-image: linear-gradient(
            -75deg,
            white calc(var(--x) + 20%),
            transparent calc(var(--x) + 30%),
            white calc(var(--x) + 100%)
        );
        -webkit-mask-image: linear-gradient(
            -75deg,
            white calc(var(--x) + 20%),
            transparent calc(var(--x) + 30%),
            white calc(var(--x) + 100%)
        );
    }

    .linear-overlay {
        background-image: linear-gradient(
            -75deg,
            rgba(var(--overlay-color), 0.1) calc(var(--x) + 20%),
            rgba(var(--overlay-color), 0.5) calc(var(--x) + 25%),
            rgba(var(--overlay-color), 0.1) calc(var(--x) + 100%)
        );
        mask:
            linear-gradient(black, black) content-box,
            linear-gradient(black, black);
        -webkit-mask:
            linear-gradient(black, black) content-box,
            linear-gradient(black, black);
        mask-composite: exclude;
        -webkit-mask-composite: xor;
    }
</style>
