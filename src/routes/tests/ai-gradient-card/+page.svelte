<script lang="ts">
    import { animate, motion, useMotionTemplate, useMotionValue } from '$lib'

    // Coverage for the AI Gradient Card example: a single `turn` motion value
    // sweeps 0 → 1 on an infinite linear loop, and `useMotionTemplate` composes
    // it into a `conic-gradient(from <turn>turn, …)` string. This proves the
    // template re-emits as `turn` animates (the `from` angle changes over time)
    // and that the same source drives the ring's `background-image`.

    const turn = useMotionValue(0)

    const gradient = useMotionTemplate`conic-gradient(from ${turn}turn, transparent 0%, #f472b6 10%, #818cf8 26%, #2dd4bf 42%, transparent 56%)`

    let running = $state(true)

    $effect(() => {
        if (!running) return
        const controls = animate(turn, [0, 1], {
            ease: 'linear',
            duration: 2,
            repeat: Infinity
        })
        return () => controls.stop()
    })

    // Deterministic control for e2e: pause the loop, then jump `turn` directly.
    const jumpTo = (value: number) => {
        running = false
        turn.set(value)
    }
</script>

<div class="ai-page bg-gray-900 p-8 text-white">
    <div class="mx-auto max-w-3xl">
        <h1 class="mb-4 text-center text-3xl font-bold">AI Gradient Card (animated template)</h1>

        <p class="mb-8 text-center text-gray-400">
            <code class="rounded bg-gray-800 px-2 py-1">useMotionTemplate</code>
            composes an animated
            <code class="rounded bg-gray-800 px-2 py-1">conic-gradient(from …turn)</code> from a looping
            motion value.
        </p>

        <div class="mb-8 flex items-center justify-center">
            <div class="ai-border" style="width: 320px; padding: 1px; border-radius: 24px;">
                <motion.div
                    data-testid="ring"
                    data-bg={$gradient}
                    style={{
                        backgroundImage: gradient,
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 'inherit'
                    }}
                />
                <div
                    class="bg-gray-950"
                    style="position: relative; border-radius: inherit; padding: 24px; height: 160px;"
                >
                    <p class="text-sm text-gray-300">Committing tomfoolery…</p>
                </div>
            </div>
        </div>

        <!-- Deterministic controls for e2e: pause the loop and set exact angles. -->
        <div class="mx-auto flex max-w-md justify-center gap-3">
            <button
                data-testid="jump-0"
                class="rounded bg-gray-700 px-3 py-1"
                onclick={() => jumpTo(0)}
            >
                from 0turn
            </button>
            <button
                data-testid="jump-half"
                class="rounded bg-gray-700 px-3 py-1"
                onclick={() => jumpTo(0.5)}
            >
                from 0.5turn
            </button>
        </div>
    </div>
</div>

<style>
    .ai-border {
        position: relative;
    }
</style>
