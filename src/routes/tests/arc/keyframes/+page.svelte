<script lang="ts">
    import { arc, motion } from '$lib'

    let toggled = $state(false)
    let strength = $state(1)
    let direction = $state<'cw' | 'ccw' | undefined>(undefined)
    let rotate = $state(false)

    // arc() keeps auto-direction continuity state, so recreate it only when
    // an option changes instead of evaluating a fresh path on every render.
    const transition = $derived({
        duration: 1,
        ease: 'linear' as const,
        path: arc({ strength, direction, rotate })
    })
</script>

<svelte:head>
    <title>arc() transition.path keyframes</title>
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
    <h1 class="text-2xl font-semibold">arc() — transition.path keyframes</h1>

    <div class="flex flex-wrap gap-2">
        <button
            class="rounded bg-blue-600 px-3 py-2 text-white"
            data-testid="toggle"
            onclick={() => (toggled = !toggled)}
        >
            Toggle
        </button>
        <button
            class="rounded bg-slate-700 px-3 py-2 text-white"
            data-testid="strength-1"
            onclick={() => (strength = 1)}
        >
            Strength 1
        </button>
        <button
            class="rounded bg-slate-700 px-3 py-2 text-white"
            data-testid="strength-0"
            onclick={() => (strength = 0)}
        >
            Strength 0
        </button>
        <button
            class="rounded bg-slate-700 px-3 py-2 text-white"
            data-testid="dir-auto"
            onclick={() => (direction = undefined)}
        >
            Auto
        </button>
        <button
            class="rounded bg-slate-700 px-3 py-2 text-white"
            data-testid="dir-cw"
            onclick={() => (direction = 'cw')}
        >
            CW
        </button>
        <button
            class="rounded bg-slate-700 px-3 py-2 text-white"
            data-testid="dir-ccw"
            onclick={() => (direction = 'ccw')}
        >
            CCW
        </button>
        <button
            class="rounded bg-slate-700 px-3 py-2 text-white"
            data-testid="rotate-on"
            onclick={() => (rotate = true)}
        >
            Rotate on
        </button>
        <button
            class="rounded bg-slate-700 px-3 py-2 text-white"
            data-testid="rotate-off"
            onclick={() => (rotate = false)}
        >
            Rotate off
        </button>
    </div>

    <p class="font-mono text-sm" data-testid="readout">
        strength={strength} direction={direction ?? 'auto'} rotate={rotate}
    </p>

    <div class="relative h-[300px] w-[300px] border border-slate-500 bg-slate-900/30 p-2">
        <motion.div
            data-testid="arc-box"
            class="absolute top-2 left-2 h-12 w-12 rounded bg-cyan-400 shadow-lg"
            initial={{ x: 0, y: 0 }}
            animate={{ x: toggled ? 200 : 0, y: 0 }}
            {transition}
        />
    </div>
</main>
