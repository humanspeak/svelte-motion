<script lang="ts">
    import { arc, motion } from '$lib'

    let right = $state(false)

    const path = arc({ strength: 1 })
    const transition = { layout: { duration: 1, ease: 'linear' as const, path } }
</script>

<svelte:head>
    <title>arc() layout paths</title>
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
    <h1 class="text-2xl font-semibold">arc() — layout / layoutId path</h1>
    <button
        class="w-fit rounded bg-blue-600 px-3 py-2 text-white"
        data-testid="toggle"
        onclick={() => (right = !right)}
    >
        Toggle
    </button>

    <section class="flex flex-col gap-2">
        <h2 class="text-lg font-medium">Layout FLIP</h2>
        <div
            class="flex h-32 w-[400px] items-start border border-slate-500 bg-slate-900/30 p-2"
            style:justify-content={right ? 'flex-end' : 'flex-start'}
        >
            <motion.div
                layout
                data-testid="layout-box"
                class="h-12 w-12 rounded bg-violet-400"
                {transition}
            />
        </div>
    </section>

    <section class="flex flex-col gap-2">
        <h2 class="text-lg font-medium">Shared layoutId</h2>
        <div class="grid w-[400px] grid-cols-2 gap-8">
            <div
                class="flex h-32 items-start justify-start border border-slate-500 bg-slate-900/30 p-2"
            >
                {#if !right}
                    <motion.div
                        layoutId="shared-arc"
                        data-testid="shared-box"
                        class="h-12 w-12 rounded-full bg-amber-400"
                        {transition}
                    />
                {/if}
            </div>
            <div
                class="flex h-32 items-start justify-end border border-slate-500 bg-slate-900/30 p-2"
            >
                {#if right}
                    <motion.div
                        layoutId="shared-arc"
                        data-testid="shared-box"
                        class="h-12 w-12 rounded-full bg-amber-400"
                        {transition}
                    />
                {/if}
            </div>
        </div>
    </section>
</main>
