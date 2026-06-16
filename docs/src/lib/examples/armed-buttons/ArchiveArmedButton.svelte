<script lang="ts">
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
    import { Archive, ArchiveRestore, FileText } from '@lucide/svelte'

    interface Props {
        id?: string
        title?: string
        eyebrow?: string
        armed?: boolean
        archived?: boolean
        timeoutMs?: number
        onArm?: () => void
        onDisarm?: () => void
        onArchive?: () => void
    }

    const {
        id = 'north-star',
        title = 'North star kickoff notes',
        eyebrow = 'Shared insight',
        armed: controlledArmed,
        archived: controlledArchived,
        timeoutMs = 4000,
        onArm,
        onDisarm,
        onArchive
    }: Props = $props()

    let armedId = $state<string | null>(null)
    let archivedState = $state(false)

    const isArmed = $derived(controlledArmed ?? armedId === id)
    const isArchived = $derived(controlledArchived ?? archivedState)
    let coverArchiveSlot = $state(false)

    $effect(() => {
        if (!isArmed) return
        const timer = window.setTimeout(() => {
            if (controlledArmed === undefined) {
                armedId = null
            } else {
                onDisarm?.()
            }
        }, timeoutMs)
        return () => window.clearTimeout(timer)
    })

    $effect(() => {
        if (isArmed) {
            coverArchiveSlot = true
            return
        }

        const timer = window.setTimeout(() => {
            coverArchiveSlot = false
        }, 160)
        return () => window.clearTimeout(timer)
    })

    const armArchive = () => {
        if (isArmed) {
            if (controlledArmed === undefined) {
                armedId = null
            } else {
                onDisarm?.()
            }
            return
        }
        if (controlledArmed === undefined) {
            armedId = id
        } else {
            onArm?.()
        }
    }

    const confirmArchive = () => {
        archivedState = !isArchived
        armedId = null
        onArchive?.()
    }
</script>

<motion.div
    class="group/archive-row relative flex w-full max-w-[26rem] items-center gap-3 rounded-lg border border-border/70 bg-background/95 p-3 shadow-sm"
    animate={isArchived ? { opacity: 0.55, x: 0 } : { opacity: 1, x: 0 }}
    whileHover={{ x: 2 }}
    transition={{ type: 'spring', stiffness: 520, damping: 32 }}
    data-testid="archive-row"
    data-armed={isArmed}
    data-archived={isArchived}
>
    <div
        class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
    >
        <FileText size={18} />
    </div>

    <div class="min-w-0 flex-1">
        <p class="text-[0.65rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            {isArchived ? 'Archived' : eyebrow}
        </p>
        <p class="truncate text-sm font-medium text-foreground">{title}</p>
    </div>

    <div class="relative flex h-8 w-24 shrink-0 items-center justify-end">
        {#if coverArchiveSlot}
            <div
                class="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 rounded-md bg-background"
                aria-hidden="true"
            ></div>
        {/if}

        <motion.button
            type="button"
            class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground/55 transition-colors hover:bg-muted hover:text-foreground group-hover/archive-row:text-muted-foreground {coverArchiveSlot
                ? 'pointer-events-none opacity-0'
                : 'opacity-100'}"
            aria-label={isArchived ? 'Unarchive insight' : 'Archive insight'}
            aria-hidden={coverArchiveSlot}
            tabindex={coverArchiveSlot ? -1 : 0}
            whileHover={{ scale: 1.16 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            onclick={armArchive}
            data-testid="archive-arm"
        >
            {#if isArchived}
                <ArchiveRestore size={15} />
            {:else}
                <Archive size={15} />
            {/if}
        </motion.button>

        <AnimatePresence mode="popLayout">
            {#if isArmed}
                <motion.div
                    key="archive-confirm"
                    class="absolute inset-y-0 right-0 z-20 flex items-center justify-end"
                    initial={{ opacity: 0, scale: 0.78, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.78, x: 10 }}
                    transition={{ duration: 0.12 }}
                    data-testid="archive-confirm-shell"
                >
                    <button
                        type="button"
                        class="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold whitespace-nowrap text-primary-foreground transition-opacity hover:opacity-90"
                        onclick={confirmArchive}
                        data-testid="archive-confirm"
                    >
                        {#if isArchived}
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
</motion.div>
