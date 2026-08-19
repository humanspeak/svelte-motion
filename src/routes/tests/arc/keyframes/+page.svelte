<script lang="ts">
    import { arc, motion } from '$lib'

    let toggled = $state(false)
    let strength = $state(1)
    let direction = $state<'cw' | 'ccw' | undefined>(undefined)
    let rotate = $state(false)

    const controls: Array<{ testid: string; label: string; apply: () => void }> = [
        { testid: 'strength-1', label: 'Strength 1', apply: () => (strength = 1) },
        { testid: 'strength-0', label: 'Strength 0', apply: () => (strength = 0) },
        { testid: 'dir-auto', label: 'Auto', apply: () => (direction = undefined) },
        { testid: 'dir-cw', label: 'CW', apply: () => (direction = 'cw') },
        { testid: 'dir-ccw', label: 'CCW', apply: () => (direction = 'ccw') },
        { testid: 'rotate-on', label: 'Rotate on', apply: () => (rotate = true) },
        { testid: 'rotate-off', label: 'Rotate off', apply: () => (rotate = false) }
    ]

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
        {#each controls as control (control.testid)}
            <button
                class="rounded bg-slate-700 px-3 py-2 text-white"
                data-testid={control.testid}
                onclick={control.apply}
            >
                {control.label}
            </button>
        {/each}
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
