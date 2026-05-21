<script lang="ts">
    import { motion, useCycle } from '$lib'

    const variants = {
        rest: { x: 0, rotate: 0, backgroundColor: '#667eea' },
        nudge: { x: 80, rotate: 8, backgroundColor: '#7c3aed' },
        flip: { x: 80, rotate: 188, backgroundColor: '#db2777' },
        spin: { x: 0, rotate: 360, backgroundColor: '#f59e0b' }
    } as const

    const labels = ['rest', 'nudge', 'flip', 'spin'] as const
    const variant = useCycle<keyof typeof variants>(...labels)

    const items = [0, 50, 100, 150] as const
    const x = useCycle(...items)
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center gap-12 p-8">
    <section class="flex w-full max-w-xl flex-col items-center gap-4">
        <h2 class="text-xl font-semibold">useCycle - variants</h2>

        <motion.div
            class="h-24 w-24 rounded-2xl shadow-lg"
            {variants}
            animate={variant.current}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            data-testid="cycle-variant-box"
            data-variant={variant.current}
        />

        <div class="flex flex-wrap items-center gap-2">
            <button
                type="button"
                class="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-500"
                data-testid="cycle-next"
                onclick={() => variant.cycle()}
            >
                variant.cycle()
            </button>
            {#each labels as label, i (label)}
                <button
                    type="button"
                    class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
                    data-testid={`jump-${label}`}
                    onclick={() => variant.cycle(i)}
                >
                    variant.cycle({i})
                </button>
            {/each}
        </div>
    </section>

    <section class="flex w-full max-w-xl flex-col items-center gap-4">
        <h2 class="text-xl font-semibold">useCycle - numeric</h2>

        <motion.div
            class="h-16 w-16 rounded-xl bg-emerald-500 shadow-lg"
            animate={{ x: x.current }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            data-testid="cycle-x-box"
            data-x={x.current}
        />

        <div class="flex flex-wrap items-center gap-2">
            <button
                type="button"
                class="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
                data-testid="cycle-x-next"
                onclick={() => x.cycle()}
            >
                x.cycle()
            </button>
            <button
                type="button"
                class="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
                data-testid="cycle-x-jump-2"
                onclick={() => x.cycle(2)}
            >
                x.cycle(2)
            </button>
            <span class="text-sm text-gray-600">
                current: <strong data-testid="cycle-x-value">{x.current}</strong>
            </span>
        </div>
    </section>
</div>
