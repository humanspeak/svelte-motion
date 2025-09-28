<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    import { cn } from '$lib/shadcn/utils'
    import type { Snippet } from 'svelte'

    type ExampleProps = {
        children: Snippet
        isSmall?: boolean
        motionUrl?: string
    }

    const { children, isSmall = false, motionUrl }: ExampleProps = $props()

    let refreshId = $state(0)
    const refreshMotion = () => {
        // motion.reset()
        refreshId++
    }
</script>

<div
    class={cn(
        'isolate flex h-full w-full flex-1 flex-col',
        isSmall && 'rounded border border-border'
    )}
>
    <div class="flex h-12 w-full items-center border-b border-border px-3 py-2">
        <div class="flex flex-1 items-center gap-4"></div>
        <div class="flex flex-1 items-center justify-center gap-4"></div>
        <div class="flex flex-1 items-center justify-end gap-4">
            {#if motionUrl}
                <motion.button
                    onclick={() => window.open(motionUrl, '_blank')}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.1 }}
                    class="inline-flex items-center justify-center rounded-md border border-border-muted px-2 py-1 text-sm text-text-muted transition-colors hover:border-border-mid hover:text-text-secondary"
                >
                    Motion.dev
                </motion.button>
            {/if}
            <motion.button
                onclick={refreshMotion}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.1 }}
                class="inline-flex size-6 items-center justify-center rounded-full border border-border-muted text-text-muted transition-colors hover:border-border-mid hover:text-text-secondary"
            >
                <i class="fa-solid fa-rotate-right fa-xs"></i>
            </motion.button>
        </div>
    </div>
    <!-- Subtle orange background that never clips content -->
    <!-- Subtle dotted grid background in brand orange -->
    <!-- Keep dots within same stacking context so parent background doesn't cover them -->
    {#if !isSmall}
        <div
            class="bg-grid-orange pointer-events-none fixed top-0 right-0 left-0 z-0"
            style="bottom: 64px;"
        ></div>
    {/if}
    <div class="relative z-10 m-0 flex w-full flex-1 items-center justify-center p-0">
        <main class="flex h-full w-full max-w-none flex-1 items-center justify-center">
            {#key refreshId}
                {@render children()}
            {/key}
        </main>
    </div>
</div>

<style>
    /* Dotted grid similar to examples.motion.dev, tinted with brand orange */
    .bg-grid-orange {
        /* Light mode default: multiply over light background */
        mix-blend-mode: multiply;
        background-image:
            radial-gradient(rgba(234, 88, 12, 0.2) 1.6px, transparent 1.6px),
            /* orange-600 */ radial-gradient(rgba(234, 88, 12, 0.1) 1.6px, transparent 1.6px);
        background-position:
            0 0,
            12px 12px;
        background-size: 24px 24px;
        opacity: 1;
        /* Fade out upwards over bottom 15% (strongest at bottom) */
        /* Strongest at bottom, smoothly fades out over ~15% */
        -webkit-mask-image: linear-gradient(
            to top,
            rgba(0, 0, 0, 1) 0%,
            rgba(0, 0, 0, 1) 5%,
            rgba(0, 0, 0, 0) 20%
        );
        mask-image: linear-gradient(
            to top,
            rgba(0, 0, 0, 1) 0%,
            rgba(0, 0, 0, 1) 5%,
            rgba(0, 0, 0, 0) 20%
        );
        mask-repeat: no-repeat;
        -webkit-mask-repeat: no-repeat;
        mask-size: 100% 100%;
        -webkit-mask-size: 100% 100%;
    }

    :global(.dark) .bg-grid-orange {
        /* Dark mode: lighten over dark background */
        mix-blend-mode: screen;
        background-image:
            radial-gradient(rgba(249, 115, 22, 0.18) 1.6px, transparent 1.6px),
            radial-gradient(rgba(249, 115, 22, 0.1) 1.6px, transparent 1.6px);
    }
</style>
