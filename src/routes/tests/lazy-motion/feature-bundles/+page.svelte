<script lang="ts">
    import { LazyMotion, domAnimation, domMax, domMin, m, motion } from '$lib'

    const cards = [
        {
            label: 'domMin',
            features: domMin,
            description: 'animations only'
        },
        {
            label: 'domAnimation',
            features: domAnimation,
            description: 'animations + gestures'
        },
        {
            label: 'domMax',
            features: domMax,
            description: 'animations + gestures + drag + layout'
        }
    ]
</script>

<main class="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-8 p-8">
    <div>
        <h1 class="text-2xl font-semibold">LazyMotion feature bundles</h1>
        <p class="mt-2 text-sm text-slate-300">
            `m` components get the bundle's features: hover/tap for domAnimation and domMax, drag
            only for domMax. A `motion` component ignores LazyMotion and always has every feature.
        </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {#each cards as card (card.label)}
            <LazyMotion features={card.features}>
                <section class="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h2 class="font-medium">{card.label}</h2>
                    <p class="mt-1 mb-5 text-sm text-slate-400">{card.description}</p>
                    <div
                        class="grid h-44 place-items-center rounded-md border border-dashed border-slate-700"
                    >
                        <m.div
                            data-testid={`lazy-motion-${card.label}`}
                            class="grid size-20 place-items-center rounded-md bg-lime-300 text-sm font-semibold text-slate-950"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            drag
                            transition={{ duration: 0.25 }}
                        >
                            {card.label}
                        </m.div>
                    </div>
                </section>
            </LazyMotion>
        {/each}
        <LazyMotion features={domMin}>
            <section class="rounded-lg border border-slate-700 bg-slate-900 p-4">
                <h2 class="font-medium">motion.div in domMin</h2>
                <p class="mt-1 mb-5 text-sm text-slate-400">
                    every feature: motion ignores LazyMotion
                </p>
                <div
                    class="grid h-44 place-items-center rounded-md border border-dashed border-slate-700"
                >
                    <motion.div
                        data-testid="lazy-motion-motion-in-domMin"
                        class="grid size-20 place-items-center rounded-md bg-sky-300 text-sm font-semibold text-slate-950"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        drag
                        transition={{ duration: 0.25 }}
                    >
                        motion
                    </motion.div>
                </div>
            </section>
        </LazyMotion>
    </div>
</main>
