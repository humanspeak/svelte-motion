<script lang="ts">
    import { AnimatePresence, motion, type SpringMotionValue } from '@humanspeak/svelte-motion'
    import { Archive, ArchiveRestore, Check, FileText, LoaderCircle, Trash2 } from '@lucide/svelte'

    interface InsightRow {
        id: string
        title: string
        eyebrow: string
    }

    interface Props {
        row: InsightRow
        archiveArmed: boolean
        deleteArmed: boolean
        deleting: boolean
        deleted: boolean
        archived: boolean
        locked: boolean
        deleteSecondsLeft: number
        archiveTimeoutMs?: number
        deleteDisarmAfterMs?: number
        deleteCountdownSeconds?: number
        spinRotate: SpringMotionValue<number>
        onArmArchive: (_id: string) => void
        onConfirmArchive: (_id: string) => void
        onArmDelete: (_id: string) => void
    }

    const {
        row,
        archiveArmed,
        deleteArmed,
        deleting,
        deleted,
        archived,
        locked,
        deleteSecondsLeft,
        archiveTimeoutMs = 4000,
        deleteDisarmAfterMs = 10000,
        deleteCountdownSeconds = 3,
        spinRotate,
        onArmArchive,
        onConfirmArchive,
        onArmDelete
    }: Props = $props()

    const deleteEyebrow = $derived(
        `Delete ${row.eyebrow.split(' ').at(-1)?.toLowerCase() ?? 'item'}`
    )
    const deleteActive = $derived(deleteArmed || deleting || deleted)
    const deleteMeterSeconds = $derived(
        Math.max((deleteDisarmAfterMs - deleteCountdownSeconds * 1000) / 1000, 0.1)
    )
    let coverArchiveSlot = $state(false)

    $effect(() => {
        if (archiveArmed) {
            coverArchiveSlot = true
            return
        }

        const timer = window.setTimeout(() => {
            coverArchiveSlot = false
        }, 160)
        return () => window.clearTimeout(timer)
    })
</script>

{#if deleteActive}
    <motion.button
        key="recording-delete-row"
        type="button"
        disabled={locked || deleting || deleted}
        class="relative flex h-16 w-full overflow-hidden items-center gap-3 rounded-lg border px-3 text-sm leading-none font-semibold shadow-sm transition-colors duration-200 {deleted
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : 'border-destructive bg-destructive text-destructive-foreground'} disabled:cursor-not-allowed disabled:opacity-100"
        initial={{ opacity: 0, x: 18, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -18, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        onclick={() => onArmDelete(row.id)}
        data-testid="recording-armed-row"
        data-archive-armed={archiveArmed}
        data-delete-armed={deleteArmed}
        data-delete-row-active={deleteActive}
    >
        {#if deleteArmed && !deleted && !deleting}
            <motion.span
                key={locked
                    ? 'recording-delete-disarm-meter-wait'
                    : 'recording-delete-disarm-meter-ready'}
                class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current/45"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: locked ? 1 : 0 }}
                transition={{ duration: locked ? 0 : deleteMeterSeconds, ease: 'linear' }}
                aria-hidden="true"
                data-testid="recording-delete-disarm-meter"
            />
        {/if}

        {#key deleted ? 'done' : locked || deleting ? 'locked' : 'ready'}
            <motion.span
                class="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-current {locked ||
                deleting
                    ? ''
                    : 'bg-background/15'}"
                initial={{ opacity: 0, scale: 0.6, rotate: locked || deleting ? -30 : 0 }}
                animate={{
                    opacity: 1,
                    scale: locked || deleting ? [1, 1.12, 1] : 1
                }}
                style={locked || deleting ? { rotate: spinRotate } : undefined}
                transition={{
                    type: locked || deleting ? 'tween' : 'spring',
                    duration: locked || deleting ? 0.42 : undefined,
                    ease: locked || deleting ? 'easeOut' : undefined,
                    stiffness: locked || deleting ? undefined : 520,
                    damping: locked || deleting ? undefined : 30
                }}
            >
                {#if deleted}
                    <Check size={18} />
                {:else if locked || deleting}
                    <LoaderCircle size={18} />
                {:else}
                    <Trash2 size={18} />
                {/if}
            </motion.span>
        {/key}

        <span class="min-w-0 flex-1 text-left">
            {#if deleted}
                <span class="block text-sm leading-[1.25]">Deleted</span>
            {:else}
                <span
                    class="block text-[0.65rem] leading-[1.25] font-semibold tracking-[0.16em] text-current/62 uppercase"
                >
                    {deleteEyebrow}
                </span>
                <span class="mt-0.5 block truncate leading-[1.25]">{row.title}</span>
            {/if}
        </span>

        <span class="flex w-16 shrink-0 justify-end">
            {#if locked}
                {#key deleteSecondsLeft}
                    <motion.span
                        class="inline-flex items-center leading-none tabular-nums"
                        initial={{ y: -7, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                    >
                        {deleteSecondsLeft}
                    </motion.span>
                {/key}
            {:else if deleteArmed && !deleted}
                <span
                    class="relative top-px inline-flex items-center text-xs leading-none tracking-[0.16em] uppercase"
                >
                    Ready
                </span>
            {/if}
        </span>
    </motion.button>
{:else}
    <motion.div
        key="recording-normal-row"
        class="group/combined-row relative flex h-16 w-full items-center gap-3 rounded-lg border border-border/70 bg-background/95 p-3 shadow-sm"
        animate={archived ? { opacity: 0.55, x: 0 } : { opacity: 1, x: 0 }}
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        data-testid="recording-armed-row"
        data-archive-armed={archiveArmed}
        data-delete-armed={deleteArmed}
        data-delete-row-active={deleteActive}
    >
        <div
            class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
        >
            <FileText size={18} />
        </div>

        <div class="min-w-0 flex-1">
            <p
                class="text-[0.65rem] leading-[1.25] font-semibold tracking-[0.16em] text-muted-foreground uppercase"
            >
                {archived ? 'Archived' : row.eyebrow}
            </p>
            <p class="truncate text-sm leading-[1.25] font-medium text-foreground">{row.title}</p>
        </div>

        <div class="flex h-8 shrink-0 items-center justify-end gap-1">
            <div class="relative flex size-8 items-center justify-end">
                {#if coverArchiveSlot}
                    <div
                        class="pointer-events-none absolute inset-y-0 right-0 z-10 w-[6.75rem] rounded-md bg-background"
                        aria-hidden="true"
                    ></div>
                {/if}

                <motion.button
                    type="button"
                    class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-muted hover:text-foreground group-hover/combined-row:text-muted-foreground {coverArchiveSlot
                        ? 'pointer-events-none opacity-0'
                        : 'opacity-100'}"
                    aria-label={archived ? 'Unarchive insight' : 'Archive insight'}
                    aria-hidden={coverArchiveSlot}
                    tabindex={coverArchiveSlot ? -1 : 0}
                    whileHover={{ scale: 1.16 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                    onclick={() => onArmArchive(row.id)}
                >
                    {#if archived}
                        <ArchiveRestore size={15} />
                    {:else}
                        <Archive size={15} />
                    {/if}
                </motion.button>

                <AnimatePresence mode="popLayout">
                    {#if archiveArmed}
                        <motion.div
                            key="recording-archive-confirm"
                            class="absolute inset-y-0 right-0 z-20 flex items-center justify-end"
                            initial={{ opacity: 0, scale: 0.78, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.78, x: 10 }}
                            transition={{ duration: 0.12 }}
                        >
                            <button
                                type="button"
                                class="relative inline-flex h-8 overflow-hidden items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold whitespace-nowrap text-primary-foreground transition-opacity hover:opacity-90"
                                onclick={() => onConfirmArchive(row.id)}
                            >
                                <motion.span
                                    key="recording-archive-disarm-meter"
                                    class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current/45"
                                    initial={{ scaleX: 1 }}
                                    animate={{ scaleX: 0 }}
                                    transition={{
                                        duration: archiveTimeoutMs / 1000,
                                        ease: 'linear'
                                    }}
                                    aria-hidden="true"
                                    data-testid="recording-archive-disarm-meter"
                                />
                                {#if archived}
                                    <ArchiveRestore size={13} />
                                    Unarchive
                                {:else}
                                    <Archive size={13} />
                                    Archive
                                {/if}
                            </button>
                        </motion.div>
                    {/if}
                </AnimatePresence>
            </div>

            {#if !archived}
                <motion.button
                    type="button"
                    aria-label="Delete insight"
                    class="inline-flex size-8 items-center justify-center rounded-md text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive group-hover/combined-row:text-destructive"
                    whileHover={{ scale: 1.16 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                    onclick={() => onArmDelete(row.id)}
                >
                    <Trash2 size={15} />
                </motion.button>
            {/if}
        </div>
    </motion.div>
{/if}
