<script lang="ts">
    import { LazyMotion, domAnimation, domMax, domMin, m } from '$lib'

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
            Hover/tap works for domAnimation and domMax. Drag is only enabled for domMax.
        </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
        {#each cards as card (card.label)}
            <LazyMotion features={card.features}>
                <section class="rounded-lg border border-slate-700 bg-slate-900 p-4">
                    <h2 class="font-medium">{card.label}</h2>
                    <p class="mb-5 mt-1 text-sm text-slate-400">{card.description}</p>
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
    </div>
</main>
