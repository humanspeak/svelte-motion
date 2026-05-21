<!--
  @component
  Interactive example demonstrating the styleString helper with reactive controls.
-->
<script lang="ts">
    import { motion, styleString, useTime, useTransform } from '@humanspeak/svelte-motion'

    // `styleString` takes a JS-style object and returns a CSS string. Passing it
    // a function (getter) makes the result reactive — any $state read inside
    // re-runs the conversion when that state changes. Mix in motion values
    // (`$autoRotate`) and they update every frame.
    let rotation = $state(0)
    let scale = $state(1)
    let hue = $state(200)

    const time = useTime()
    const autoRotate = useTransform(time, [0, 2000], [0, 360], { clamp: false })

    let autoMode = $state(false)
</script>

<!-- HUMANSPEAK: docs-kit positioning shell — stripped from the published code. -->
<div class="humanspeak-demo-shell">
    <div class="flex flex-col items-center gap-6 p-6">
        <div
            style={styleString({
                width: 120,
                height: 120,
                borderRadius: 16,
                backgroundColor: `hsl(${hue}, 70%, 50%)`,
                rotate: autoMode ? $autoRotate : rotation,
                scale: scale,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: 14,
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            })}
        >
            Reactive!
        </div>

        <div
            class="flex flex-col gap-4 rounded-lg bg-white/10 p-4 backdrop-blur-sm dark:bg-black/20"
        >
            <label class="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" bind:checked={autoMode} class="h-4 w-4 accent-blue-500" />
                <span>Auto Rotate</span>
            </label>

            <div class="flex flex-col gap-1" class:opacity-40={autoMode}>
                <div class="flex justify-between text-xs">
                    <span id="rotation-label">Rotation</span>
                    <span class="font-mono">{rotation}°</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="360"
                    bind:value={rotation}
                    disabled={autoMode}
                    class="w-40 accent-blue-500"
                    aria-labelledby="rotation-label"
                />
            </div>

            <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs">
                    <span id="scale-label">Scale</span>
                    <span class="font-mono">{scale.toFixed(1)}</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    bind:value={scale}
                    class="w-40 accent-blue-500"
                    aria-labelledby="scale-label"
                />
            </div>

            <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs">
                    <span id="hue-label">Hue</span>
                    <span class="font-mono">{hue}°</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="360"
                    bind:value={hue}
                    class="w-40 accent-blue-500"
                    aria-labelledby="hue-label"
                />
            </div>

            <motion.button
                onclick={() => {
                    rotation = 0
                    scale = 1
                    hue = 200
                    autoMode = false
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                class="rounded bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
            >
                Reset
            </motion.button>
        </div>
    </div>
</div>

<style>
    .humanspeak-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        min-height: 540px;
    }
</style>
