<script lang="ts">
    import { motion, styleString, useMotionValue, useTransform } from '$lib'

    // Regression coverage for issue #418: the compute form of `useTransform`
    // must recompute when its sources change. The upstream-faithful shape uses
    // motion values read via `.get()` inside the compute, which motion-dom's
    // `collectMotionValues` auto-tracks — so a pointer move (or slider change)
    // that calls `.set()` recomputes the derived background string.

    const gradientX = useMotionValue(0.5)
    const gradientY = useMotionValue(0.5)

    const background = useTransform(
        () =>
            `conic-gradient(at ${gradientX.get() * 100}% ${gradientY.get() * 100}%, #0cdcf7, #ff0088, #fff312, #0cdcf7)`
    )

    let el: HTMLElement | undefined = $state(undefined)

    const handlePointerMove = (e: PointerEvent) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        gradientX.set((e.clientX - rect.left) / rect.width)
        gradientY.set((e.clientY - rect.top) / rect.height)
    }
</script>

<div class="conic-page bg-gray-900 p-8 text-white">
    <div class="mx-auto max-w-3xl">
        <h1 class="mb-4 text-center text-3xl font-bold">Conic Gradient (compute form)</h1>

        <p class="mb-8 text-center text-gray-400">
            <code class="rounded bg-gray-800 px-2 py-1">useTransform(() =&gt; …)</code>
            auto-tracks the two motion values it reads via
            <code class="rounded bg-gray-800 px-2 py-1">.get()</code> and recomputes the background.
        </p>

        <div class="mb-8 flex items-center justify-center">
            <div
                data-testid="swatch"
                bind:this={el}
                onpointermove={handlePointerMove}
                role="presentation"
                style="width: 320px; height: 320px;"
            >
                <motion.div
                    data-testid="gradient-box"
                    data-bg={$background}
                    style={styleString(() => ({
                        background: $background,
                        width: '320px',
                        height: '320px',
                        borderRadius: 30
                    }))}
                />
            </div>
        </div>

        <!-- Deterministic controls for e2e -->
        <div class="mx-auto flex max-w-md flex-col gap-4">
            <label class="flex items-center gap-3">
                <span class="w-24">gradientX</span>
                <input
                    data-testid="x-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value="0.5"
                    oninput={(e) => gradientX.set(parseFloat(e.currentTarget.value))}
                />
            </label>
            <label class="flex items-center gap-3">
                <span class="w-24">gradientY</span>
                <input
                    data-testid="y-slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value="0.5"
                    oninput={(e) => gradientY.set(parseFloat(e.currentTarget.value))}
                />
            </label>
        </div>
    </div>
</div>
