<script lang="ts">
    import {
        motion,
        animate,
        type MotionAnimate,
        type MotionTransition
    } from '@humanspeak/svelte-motion'

    import * as m from '$lib/paraglide/messages/_index.js'
    // mounted no longer needed for CSS enter
    let headingContainer: HTMLDivElement | null = $state(null)

    function splitHeadingWords(root: HTMLElement) {
        const lines = root.querySelectorAll('h1 span')
        const words: HTMLElement[] = []
        lines.forEach((line) => {
            const text = line.textContent ?? ''
            line.textContent = ''
            const tokens = text.split(/(\s+)/)
            for (const t of tokens) {
                if (t.trim().length === 0) {
                    line.appendChild(document.createTextNode(t))
                } else {
                    const w = document.createElement('span')
                    w.className = 'split-word'
                    w.textContent = t
                    line.appendChild(w)
                    words.push(w)
                }
            }
        })
        return words
    }

    $effect(() => {
        if (typeof document === 'undefined') return
        if (!headingContainer) return
        // hide until fonts are loaded and spans are built
        headingContainer.style.visibility = 'hidden'
        document.fonts?.ready
            .then(() => {
                if (!headingContainer) return
                const words = splitHeadingWords(headingContainer)
                headingContainer.style.visibility = 'visible'
                words.forEach((el, i) => {
                    const keyframes = {
                        opacity: [0, 1],
                        y: [10, 0]
                    } as MotionAnimate
                    const options = {
                        duration: 0.8,
                        easing: 'ease-out',
                        delay: i * 0.05
                    } as MotionTransition
                    animate(el, keyframes!, options)
                })
            })
            .catch(() => {
                // Fallback: ensure visible
                headingContainer!.style.visibility = 'visible'
            })
    })
</script>

<section class="relative flex flex-1 overflow-hidden">
    <!-- Layer: subtle grid -->
    <div class="bg-grid pointer-events-none absolute inset-0 -z-20"></div>
    <!-- Layer: soft radial glow -->
    <div class="bg-glow pointer-events-none absolute inset-0 -z-10"></div>
    <!-- Layer: animated orbs via motion -->
    <motion.div
        class="orb-a-bg absolute bottom-[-80px] left-[-80px] h-[320px] w-[320px] rounded-full opacity-50 blur-[30px]"
        style="will-change: transform;"
        animate={{
            x: ['0vw', '8vw', '-4vw', '2vw', '0vw'],
            y: ['0vh', '-10vh', '6vh', '-4vh', '0vh']
        }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
        class="orb-b-bg absolute top-[20%] right-[-60px] h-[260px] w-[260px] rounded-full opacity-50 blur-[30px]"
        style="will-change: transform;"
        animate={{
            x: ['0vw', '-6vw', '3vw', '-2vw', '0vw'],
            y: ['0vh', '-8vh', '4vh', '-6vh', '0vh']
        }}
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
    />

    <div
        class="relative mx-auto flex w-full max-w-7xl items-center justify-center px-6 py-8 md:py-12"
    >
        <motion.div class="mx-auto max-w-4xl text-center">
            <div bind:this={headingContainer} class="mx-auto max-w-4xl text-center">
                <h1 class="text-5xl leading-tight font-semibold text-balance md:text-7xl">
                    <span class="block">{m.hero_title_line1()}</span>
                    <span
                        class="sheen-gradient block bg-gradient-to-r from-white via-brand-500 to-white bg-clip-text text-transparent"
                    >
                        {m.hero_title_line2()}
                    </span>
                </h1>
                <p class="mt-6 text-base leading-7 text-pretty text-white/80 md:text-lg">
                    {m.hero_subtitle()}
                </p>
                <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        whileHover={{ scale: 1.03, filter: 'brightness(0.95)' }}
                        class="inline-flex items-center justify-center rounded-full border border-[var(--color-border-mid)] bg-brand-200 px-4 py-2 text-sm font-semibold text-[#0b1011]"
                    >
                        {m.cta_primary()}
                    </motion.button>
                </div>
                <ul class="mt-10 flex flex-wrap justify-center gap-2 text-xs text-white/70">
                    <li class="rounded-full border border-white/15 px-3 py-1">
                        {m.pill_free_oss()}
                    </li>
                    <li class="rounded-full border border-white/15 px-3 py-1">{m.pill_easy()}</li>
                    <li class="rounded-full border border-white/15 px-3 py-1">{m.pill_tiny()}</li>
                </ul>
            </div>
        </motion.div>
    </div>
</section>

<style>
    /* Decorative layers */
    .bg-grid {
        background-image: radial-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px);
        background-size: 24px 24px;
        background-position: 50% 0;
        mask-image: radial-gradient(ellipse at center, rgba(0, 0, 0, 1) 20%, rgba(0, 0, 0, 0) 70%);
    }
    .bg-glow {
        background:
            radial-gradient(60% 50% at 50% 0%, rgba(141, 240, 204, 0.18), transparent 60%),
            radial-gradient(40% 40% at 90% 20%, rgba(141, 240, 204, 0.12), transparent 60%),
            radial-gradient(40% 40% at 10% 15%, rgba(141, 240, 204, 0.12), transparent 60%);
        filter: blur(0.2px);
    }
</style>
