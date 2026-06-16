<script lang="ts">
    import { motion } from '$lib'

    const COUNTDOWN_SECONDS = 2

    let armed = $state(false)
    let secondsLeft = $state(COUNTDOWN_SECONDS)
    let deleting = $state(false)
    let deleted = $state(false)

    const locked = $derived((armed && secondsLeft > 0) || deleting)

    $effect(() => {
        if (!armed) return
        secondsLeft = COUNTDOWN_SECONDS
        const ticker = window.setInterval(() => {
            secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : 0
        }, 1000)
        const disarm = window.setTimeout(() => {
            if (!deleting && !deleted) armed = false
        }, 4200)

        return () => {
            window.clearInterval(ticker)
            window.clearTimeout(disarm)
        }
    })

    const clickDelete = () => {
        if (deleted) return
        if (!armed) {
            armed = true
            return
        }
        if (locked) return

        deleting = true
        window.setTimeout(() => {
            deleting = false
            deleted = true
            armed = false
        }, 120)
    }
</script>

<main
    class="flex min-h-screen items-center justify-center overflow-y-auto bg-slate-950 p-8 text-white"
>
    <motion.div
        class="w-96"
        whileHover={armed || deleted ? undefined : { x: 2 }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
    >
        <button
            type="button"
            disabled={locked || deleted}
            class="flex h-12 w-full items-center gap-3 rounded-lg border px-4 text-sm font-semibold shadow-2xl transition-colors {deleted
                ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-100'
                : armed
                  ? 'border-rose-400 bg-rose-500 text-white'
                  : 'border-white/10 bg-white/8 text-white hover:bg-white/12'}"
            onclick={clickDelete}
            data-testid="delete-test-button"
            data-armed={armed}
            data-locked={locked}
            data-deleted={deleted}
        >
            {#key deleted ? 'done' : locked ? 'locked' : armed ? 'ready' : 'idle'}
                <motion.span
                    class="inline-flex size-5 items-center justify-center"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                    data-testid="delete-test-icon"
                >
                    {#if deleted}
                        <span aria-hidden="true">OK</span>
                    {:else if locked}
                        <span aria-hidden="true">...</span>
                    {:else}
                        <span aria-hidden="true">DEL</span>
                    {/if}
                </motion.span>
            {/key}

            <span class="flex-1 text-left"
                >{deleted ? 'Workspace deleted' : 'Delete workspace'}</span
            >

            <span class="flex w-16 justify-end">
                {#if armed && secondsLeft > 0}
                    <span class="tabular-nums" data-testid="delete-test-countdown">
                        {secondsLeft}
                    </span>
                {:else if armed && !deleted}
                    <span class="text-xs uppercase tracking-widest" data-testid="delete-test-ready">
                        Ready
                    </span>
                {/if}
            </span>
        </button>
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
