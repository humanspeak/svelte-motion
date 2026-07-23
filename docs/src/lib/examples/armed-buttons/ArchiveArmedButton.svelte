<script lang="ts">
    import { AnimatePresence, motion, styleString } from '@humanspeak/svelte-motion'
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
    class="armed-row"
    animate={isArchived ? { opacity: 0.55, x: 0 } : { opacity: 1, x: 0 }}
    whileHover={{ x: 2 }}
    transition={{ type: 'spring', stiffness: 520, damping: 32 }}
    style={styleString(() => ({
        position: 'relative',
        display: 'flex',
        width: '100%',
        maxWidth: '26rem',
        alignItems: 'center',
        gap: '0.75rem',
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        background: 'var(--brut-bg-2, #eef4f1)',
        padding: '0.75rem',
        boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
    }))}
    data-testid="archive-row"
    data-armed={isArmed}
    data-archived={isArchived}
>
    <div class="glyph">
        <FileText size={18} />
    </div>

    <div class="copy">
        <p class="eyebrow">{isArchived ? 'Archived' : eyebrow}</p>
        <p class="title">{title}</p>
    </div>

    <div class="slot">
        {#if coverArchiveSlot}
            <div class="cover" aria-hidden="true"></div>
        {/if}

        <motion.button
            type="button"
            aria-label={isArchived ? 'Unarchive insight' : 'Archive insight'}
            aria-hidden={coverArchiveSlot}
            tabindex={coverArchiveSlot ? -1 : 0}
            whileHover={{
                scale: 1.16,
                backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                color: 'var(--brut-ink, #0a0a0a)'
            }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            onclick={armArchive}
            data-testid="archive-arm"
            style={styleString(() => ({
                display: 'inline-flex',
                width: '2rem',
                height: '2rem',
                flex: 'none',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid transparent',
                background: 'transparent',
                color: 'var(--brut-ink-3, #9a9a9a)',
                cursor: 'pointer',
                opacity: coverArchiveSlot ? 0 : 1,
                pointerEvents: coverArchiveSlot ? 'none' : 'auto'
            }))}
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
                    initial={{ opacity: 0, scale: 0.78, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.78, x: 10 }}
                    transition={{ duration: 0.12 }}
                    data-testid="archive-confirm-shell"
                    style={styleString(() => ({
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        right: 0,
                        zIndex: 20,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end'
                    }))}
                >
                    <motion.button
                        type="button"
                        onclick={confirmArchive}
                        data-testid="archive-confirm"
                        whileHover={{ opacity: 0.9 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                        style={styleString(() => ({
                            position: 'relative',
                            display: 'inline-flex',
                            height: '2rem',
                            overflow: 'hidden',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.375rem',
                            border: '1px solid var(--brut-accent, #247768)',
                            background: 'var(--brut-accent, #247768)',
                            padding: '0 0.75rem',
                            fontFamily: 'var(--brut-mono, monospace)',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                            color: 'var(--brut-accent-ink, #f8fcfb)',
                            cursor: 'pointer'
                        }))}
                    >
                        <motion.span
                            key="archive-disarm-meter"
                            initial={{ scaleX: 1 }}
                            animate={{ scaleX: 0 }}
                            transition={{ duration: timeoutMs / 1000, ease: 'linear' }}
                            aria-hidden="true"
                            data-testid="archive-disarm-meter"
                            style={styleString(() => ({
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                height: '2px',
                                transformOrigin: 'left',
                                background: 'var(--brut-accent-ink, #f8fcfb)',
                                opacity: 0.45,
                                pointerEvents: 'none'
                            }))}
                        />
                        {#if isArchived}
                            <ArchiveRestore size={13} />
                            Unarchive
                        {:else}
                            <Archive size={13} />
                            Archive
                        {/if}
                    </motion.button>
                </motion.div>
            {/if}
        </AnimatePresence>
    </div>
</motion.div>

<style>
    .glyph {
        display: grid;
        width: 2.5rem;
        height: 2.5rem;
        flex: none;
        place-items: center;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .copy {
        min-width: 0;
        flex: 1;
    }

    .eyebrow {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .title {
        margin: 0.125rem 0 0;
        overflow: hidden;
        font-size: 0.8125rem;
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--brut-ink, #0a0a0a);
    }

    .slot {
        position: relative;
        display: flex;
        height: 2rem;
        width: 6rem;
        flex: none;
        align-items: center;
        justify-content: flex-end;
    }

    .cover {
        pointer-events: none;
        position: absolute;
        inset: 0 0 0 auto;
        z-index: 10;
        width: 6rem;
        background: var(--brut-bg-2, #eef4f1);
    }
</style>
