<script lang="ts">
    import { AnimatePresence, motion } from '$lib'

    // Regression page: a `layoutId` element swapped with a plain `{#if}` (no
    // AnimatePresence) on a page that is scrolled away from the top. The
    // departing rect used to be stored in viewport coordinates while the
    // projection layout is measured in page coordinates, so the incoming
    // element started `window.scrollY` pixels off and flew in from above.
    let right = $state(false)

    const transition = { layout: { duration: 0.8, ease: 'linear' as const } }
</script>

<svelte:head>
    <title>layoutId — scrolled page handoff</title>
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
    <h1 class="text-2xl font-semibold">layoutId — scrolled page handoff</h1>
    <p class="text-sm text-slate-400">
        The stages sit below a tall spacer; Playwright scrolls them into view before toggling.
    </p>

    <div style="height: 1400px" class="border border-dashed border-slate-700"></div>

    <button
        class="w-fit rounded bg-blue-600 px-3 py-2 text-white"
        data-testid="toggle"
        onclick={() => (right = !right)}
    >
        Toggle
    </button>

    <section class="flex flex-col gap-2">
        <h2 class="text-lg font-medium">Plain {'{#if}'} swap</h2>
        <div class="grid w-[400px] grid-cols-2 gap-8">
            <div class="flex h-24 items-start justify-start border border-slate-500 p-2">
                {#if !right}
                    <motion.div
                        layoutId="plain-swap"
                        data-testid="plain-box"
                        class="h-12 w-12 rounded bg-emerald-400"
                        {transition}
                    />
                {/if}
            </div>
            <div class="flex h-24 items-start justify-end border border-slate-500 p-2">
                {#if right}
                    <motion.div
                        layoutId="plain-swap"
                        data-testid="plain-box"
                        class="h-12 w-12 rounded bg-emerald-400"
                        {transition}
                    />
                {/if}
            </div>
        </div>
    </section>

    <section class="flex flex-col gap-2">
        <h2 class="text-lg font-medium">AnimatePresence swap (control)</h2>
        <div class="grid w-[400px] grid-cols-2 gap-8">
            <div class="flex h-24 items-start justify-start border border-slate-500 p-2">
                <AnimatePresence>
                    {#if !right}
                        <motion.div
                            key="ap-left"
                            layoutId="ap-swap"
                            data-testid="ap-box"
                            class="h-12 w-12 rounded bg-amber-400"
                            {transition}
                        />
                    {/if}
                </AnimatePresence>
            </div>
            <div class="flex h-24 items-start justify-end border border-slate-500 p-2">
                <AnimatePresence>
                    {#if right}
                        <motion.div
                            key="ap-right"
                            layoutId="ap-swap"
                            data-testid="ap-box"
                            class="h-12 w-12 rounded bg-amber-400"
                            {transition}
                        />
                    {/if}
                </AnimatePresence>
            </div>
        </div>
    </section>
</main>
