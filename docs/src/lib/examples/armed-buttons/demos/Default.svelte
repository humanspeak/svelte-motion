<script lang="ts">
    import {
        AnimatePresence,
        motion,
        useAnimationFrame,
        useMotionValue,
        useSpring
    } from '@humanspeak/svelte-motion'
    import RecordingInsightRow from '../RecordingInsightRow.svelte'
    import { SvelteSet } from 'svelte/reactivity'

    const rows = [
        { id: 'launch', title: 'Launch notes', eyebrow: 'Shared insight' },
        { id: 'pricing', title: 'Pricing objections', eyebrow: 'Saved thread' },
        { id: 'metrics', title: 'Retention metrics', eyebrow: 'Team highlight' }
    ]

    const DELETE_COUNTDOWN_SECONDS = 3
    const ARCHIVE_DISARM_AFTER_MS = 4000
    const DELETE_DISARM_AFTER_MS = 10000

    let archiveArmedId = $state<string | null>(null)
    const archiveArchivedIds = new SvelteSet<string>()
    let deleteArmedId = $state<string | null>(null)
    let deleteSecondsLeft = $state(0)
    let deletingId = $state<string | null>(null)
    const deletedIds = new SvelteSet<string>()
    const removedIds = new SvelteSet<string>()
    const spinTarget = useMotionValue(0)
    const spinRotate = useSpring(spinTarget, { stiffness: 220, damping: 18, mass: 0.8 })

    let nextSpinAt = 0
    let spinTurns = 0

    const deleteLocked = $derived(
        Boolean(deleteArmedId && deleteSecondsLeft > 0) || Boolean(deletingId)
    )
    const visibleRows = $derived(rows.filter((row) => !removedIds.has(row.id)))

    useAnimationFrame((time) => {
        if (!deleteLocked) {
            nextSpinAt = 0
            spinTurns = 0
            spinTarget.jump(0)
            return
        }

        if (time < nextSpinAt) return

        spinTurns += 1
        spinTarget.set(spinTurns * 720)
        nextSpinAt = time + 1180
    })

    $effect(() => {
        if (!deleteArmedId) return

        deleteSecondsLeft = DELETE_COUNTDOWN_SECONDS
        const ticker = window.setInterval(() => {
            deleteSecondsLeft = deleteSecondsLeft > 0 ? deleteSecondsLeft - 1 : 0
        }, 1000)
        const disarm = window.setTimeout(() => {
            if (!deletingId) deleteArmedId = null
        }, DELETE_DISARM_AFTER_MS)

        return () => {
            window.clearInterval(ticker)
            window.clearTimeout(disarm)
        }
    })

    $effect(() => {
        if (!archiveArmedId) return
        const timer = window.setTimeout(() => {
            archiveArmedId = null
        }, ARCHIVE_DISARM_AFTER_MS)

        return () => window.clearTimeout(timer)
    })

    const armArchive = (id: string) => {
        if (deletedIds.has(id) || deleteArmedId === id) return
        archiveArmedId = archiveArmedId === id ? null : id
    }

    const confirmArchive = (id: string) => {
        if (archiveArchivedIds.has(id)) {
            archiveArchivedIds.delete(id)
        } else {
            archiveArchivedIds.add(id)
        }
        archiveArmedId = null
    }

    const armDelete = (id: string) => {
        if (deletedIds.has(id) || archiveArchivedIds.has(id)) return
        if (deleteArmedId === id) {
            if (deleteSecondsLeft > 0 || deletingId) return

            deletingId = id
            window.setTimeout(() => {
                deletedIds.add(id)
                deletingId = null
                deleteArmedId = null
                window.setTimeout(() => {
                    removedIds.add(id)
                }, 2000)
            }, 520)
            return
        }

        archiveArmedId = null
        deleteArmedId = id
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="stage">
        <div class="stack">
            <AnimatePresence mode="popLayout">
                {#each visibleRows as row (row.id)}
                    {@const archiveArmed = archiveArmedId === row.id}
                    {@const deleteArmed = deleteArmedId === row.id}
                    {@const deleting = deletingId === row.id}
                    {@const deleted = deletedIds.has(row.id)}
                    {@const archived = archiveArchivedIds.has(row.id)}
                    {@const locked = deleteArmed && deleteSecondsLeft > 0}
                    <motion.div
                        key={row.id}
                        layout
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -28, scale: 0.96, filter: 'blur(3px)' }}
                        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                    >
                        <RecordingInsightRow
                            {row}
                            {archiveArmed}
                            {deleteArmed}
                            {deleting}
                            {deleted}
                            {archived}
                            {locked}
                            {deleteSecondsLeft}
                            archiveTimeoutMs={ARCHIVE_DISARM_AFTER_MS}
                            deleteDisarmAfterMs={DELETE_DISARM_AFTER_MS}
                            deleteCountdownSeconds={DELETE_COUNTDOWN_SECONDS}
                            {spinRotate}
                            onArmArchive={armArchive}
                            onConfirmArchive={confirmArchive}
                            onArmDelete={armDelete}
                        />
                    </motion.div>
                {/each}
            </AnimatePresence>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        min-height: 360px;
        align-items: center;
        justify-content: center;
        padding: 2rem;
    }

    .stage {
        display: grid;
        width: min(100%, 32rem);
        gap: 1rem;
        border-radius: 1rem;
        border: 1px solid hsl(var(--border));
        background:
            linear-gradient(135deg, hsl(var(--muted) / 0.42), transparent 42%),
            hsl(var(--background));
        padding: 1.25rem;
        box-shadow: 0 18px 60px hsl(var(--foreground) / 0.1);
    }

    .stack {
        display: grid;
        gap: 0.65rem;
    }
</style>
