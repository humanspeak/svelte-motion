<script lang="ts">
    import { motion, useTime, useTransform, styleString } from '$lib'

    // Reactive state
    let rotation = $state(0)
    let scale = $state(1)
    let opacity = $state(1)
    let hue = $state(200)

    // Time-based animation using useTime and useTransform
    const time = useTime()
    const autoRotate = useTransform(time, [0, 2000], [0, 360], { clamp: false })

    // Toggle for automatic rotation
    let autoMode = $state(false)

    // Code example (stored as variable to avoid confusing the Svelte language server)
    // trunk-ignore-begin(eslint/no-useless-escape)
    const codeExample = `<script>
  import { styleString } from '@humanspeak/svelte-motion'

  let myRotation = $state(0)
  let myOpacity = $state(1)
<\/script>

<!-- Reactive in Svelte 5 templates -->
<div style={styleString({ rotate: myRotation, opacity: myOpacity })}>
  This div's style updates reactively!
</div>`
    // trunk-ignore-end(eslint/no-useless-escape)
</script>

<div class="reactive-style-page bg-gray-900 p-8 text-white">
    <div class="mx-auto max-w-3xl pb-8">
        <h1 class="mb-4 text-center text-3xl font-bold">Reactive Style Helper Demo</h1>

        <p class="mb-8 text-center text-gray-400">
            The <code class="rounded bg-gray-800 px-2 py-1">styleString</code> helper creates CSS style
            strings with automatic unit handling. In Svelte 5, template expressions are reactive.
        </p>

        <!-- Demo Box -->
        <div class="mb-8 flex min-h-64 items-center justify-center rounded-lg bg-gray-800 p-8">
            <div
                style={styleString({
                    width: 150,
                    height: 150,
                    borderRadius: 16,
                    backgroundColor: `hsl(${hue}, 70%, 50%)`,
                    rotate: autoMode ? $autoRotate : rotation,
                    scale: scale,
                    opacity: opacity,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 14,
                    color: 'white',
                    textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                })}
            >
                Reactive!
            </div>
        </div>

        <!-- Controls -->
        <div class="space-y-6 rounded-lg bg-gray-800 p-6">
            <h2 class="mb-4 text-xl font-semibold">Controls</h2>

            <!-- Auto Rotate Toggle -->
            <div class="flex items-center gap-4">
                <label class="flex items-center gap-2">
                    <input type="checkbox" bind:checked={autoMode} class="h-4 w-4" />
                    <span>Auto Rotate (using useTime + useTransform)</span>
                </label>
            </div>

            <!-- Manual Rotation -->
            <div class="space-y-2" class:opacity-50={autoMode}>
                <div class="flex items-center justify-between">
                    <span id="rotation-label">Rotation: {rotation}°</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="360"
                    bind:value={rotation}
                    disabled={autoMode}
                    class="w-full"
                    aria-labelledby="rotation-label"
                />
            </div>

            <!-- Scale -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span id="scale-label">Scale: {scale.toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    bind:value={scale}
                    class="w-full"
                    aria-labelledby="scale-label"
                />
            </div>

            <!-- Opacity -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span id="opacity-label">Opacity: {opacity.toFixed(2)}</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    bind:value={opacity}
                    class="w-full"
                    aria-labelledby="opacity-label"
                />
            </div>

            <!-- Hue -->
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span id="hue-label">Hue: {hue}°</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="360"
                    bind:value={hue}
                    class="w-full"
                    aria-labelledby="hue-label"
                />
            </div>

            <!-- Reset Button -->
            <motion.button
                onclick={() => {
                    rotation = 0
                    scale = 1
                    opacity = 1
                    hue = 200
                    autoMode = false
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={styleString({
                    padding: '12px 24px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%'
                })}
            >
                Reset All
            </motion.button>
        </div>

        <!-- Code Example -->
        <div class="mt-8 rounded-lg bg-gray-800 p-6">
            <h2 class="mb-4 text-xl font-semibold">Usage Example</h2>
            <pre class="overflow-x-auto rounded bg-gray-900 p-4 text-sm"><code class="text-gray-300"
                    >{codeExample}</code
                ></pre>
        </div>

        <!-- Key Points -->
        <div class="mt-8 rounded-lg bg-gray-800 p-6">
            <h2 class="mb-4 text-xl font-semibold">Key Points</h2>
            <ul class="list-inside list-disc space-y-2 text-gray-300">
                <li>
                    <strong>Automatic reactivity:</strong> Svelte 5 template expressions track
                    <code>$state</code> dependencies automatically
                </li>
                <li>
                    <strong>Unit handling:</strong> Numbers automatically get <code>px</code>,
                    <code>deg</code>, or remain unitless as appropriate
                </li>
                <li>
                    <strong>camelCase support:</strong> Properties like <code>backgroundColor</code>
                    are converted to <code>background-color</code>
                </li>
                <li>
                    <strong>Simple API:</strong> Pass an object directly or use a factory function
                </li>
            </ul>
        </div>
    </div>
</div>

<style>
    :global(html),
    :global(body) {
        overflow: auto !important;
        height: auto !important;
    }

    :global(#sandbox) {
        height: auto !important;
        align-items: flex-start !important;
    }

    :global(.container) {
        height: auto !important;
        align-items: flex-start !important;
    }

    .reactive-style-page {
        min-height: 100vh;
        width: 100%;
    }
</style>
