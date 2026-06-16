<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'

    const ID = 'share-1'

    let armedId = $state<string | null>(null)
    let archived = $state(false)

    const isArmed = $derived(armedId === ID)

    $effect(() => {
        if (!armedId) return
        const timer = window.setTimeout(() => {
            armedId = null
        }, 1500)
        return () => window.clearTimeout(timer)
    })
</script>

<main
    class="flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950 p-8 text-white"
>
    <motion.div
        class="group flex w-96 items-center gap-3 rounded-lg border border-white/10 bg-white/8 p-3 shadow-2xl"
        whileHover={archived ? undefined : { x: 2 }}
        data-testid="archive-test-row"
        data-armed={isArmed}
        data-archived={archived}
    >
        <div class="flex size-10 items-center justify-center rounded-md bg-sky-400/15 text-sky-200">
            <span class="text-xs font-bold">DOC</span>
        </div>

        <div class="min-w-0 flex-1">
            <p class="text-xs text-slate-400">{archived ? 'Archived' : 'Shared insight'}</p>
            <p class="truncate text-sm font-semibold">Revenue model notes</p>
        </div>

        <div class="relative flex h-8 w-24 items-center justify-end">
            <motion.button
                type="button"
                aria-label="Archive insight"
                class="inline-flex size-8 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white"
                disabled={archived}
                whileHover={{ scale: 1.16 }}
                whileTap={{ scale: 0.9 }}
                onclick={() => {
                    if (!archived) armedId = isArmed ? null : ID
                }}
                data-testid="archive-test-arm"
            >
                <span aria-hidden="true" class="text-xs font-bold">A</span>
            </motion.button>

            <AnimatePresence mode="popLayout">
                {#if isArmed}
                    <motion.div
                        key="archive-confirm"
                        class="absolute inset-y-0 right-0 z-10 flex items-center justify-end"
                        initial={{ opacity: 0, scale: 0.78, x: 10 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.78, x: 10 }}
                        transition={{ duration: 0.12 }}
                    >
                        <button
                            type="button"
                            class="inline-flex h-8 items-center gap-1.5 rounded-md bg-sky-300 px-3 text-xs font-semibold text-slate-950"
                            onclick={() => {
                                archived = true
                                armedId = null
                            }}
                            data-testid="archive-test-confirm"
                        >
                            <span aria-hidden="true">A</span>
                            Archive
                        </button>
                    </motion.div>
                {/if}
            </AnimatePresence>
        </div>
    </motion.div>
</main>

<style>
    :global(html),
    :global(body) {
        height: auto !important;
        min-height: 100%;
        overflow-y: auto !important;
    }
</style>
