<script lang="ts">
    import {
        AnimatePresence,
        motion,
        styleString,
        type SpringMotionValue
    } from '@humanspeak/svelte-motion'
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

    // Motion-driven color state for the armed/deleted delete row.
    const dangerRowColors = $derived(
        deleted
            ? {
                  backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                  borderColor: 'var(--brut-accent, #247768)',
                  color: 'var(--brut-accent, #247768)'
              }
            : {
                  backgroundColor: 'var(--armed-danger, #b91c1c)',
                  borderColor: 'var(--armed-danger, #b91c1c)',
                  color: 'var(--brut-accent-ink, #f8fcfb)'
              }
    )

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
        initial={{ opacity: 0, x: 18, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1, ...dangerRowColors }}
        exit={{ opacity: 0, x: -18, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        onclick={() => onArmDelete(row.id)}
        data-testid="recording-armed-row"
        data-archive-armed={archiveArmed}
        data-delete-armed={deleteArmed}
        data-delete-row-active={deleteActive}
        style={styleString(() => ({
            position: 'relative',
            display: 'flex',
            height: '4rem',
            width: '100%',
            overflow: 'hidden',
            alignItems: 'center',
            gap: '0.75rem',
            borderWidth: '1px',
            borderStyle: 'solid',
            padding: '0 0.75rem',
            fontSize: '0.8125rem',
            lineHeight: 1,
            fontWeight: 600,
            boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
            cursor: locked || deleting || deleted ? 'not-allowed' : 'pointer'
        }))}
    >
        {#if deleteArmed && !deleted && !deleting}
            <motion.span
                key={locked
                    ? 'recording-delete-disarm-meter-wait'
                    : 'recording-delete-disarm-meter-ready'}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: locked ? 1 : 0 }}
                transition={{ duration: locked ? 0 : deleteMeterSeconds, ease: 'linear' }}
                aria-hidden="true"
                data-testid="recording-delete-disarm-meter"
                style={styleString(() => ({
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '2px',
                    transformOrigin: 'left',
                    background: 'currentColor',
                    opacity: 0.45,
                    pointerEvents: 'none'
                }))}
            />
        {/if}

        {#key deleted ? 'done' : locked || deleting ? 'locked' : 'ready'}
            <motion.span
                initial={{ opacity: 0, scale: 0.6, rotate: locked || deleting ? -30 : 0 }}
                animate={{
                    opacity: 1,
                    scale: locked || deleting ? [1, 1.12, 1] : 1
                }}
                style={{
                    display: 'inline-flex',
                    width: '2.5rem',
                    height: '2.5rem',
                    flex: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(!(locked || deleting) ? { background: 'rgba(255, 255, 255, 0.15)' } : {}),
                    ...(locked || deleting ? { rotate: spinRotate } : {})
                }}
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

        <span class="label">
            {#if deleted}
                <span class="deleted-line">Deleted</span>
            {:else}
                <span class="eyebrow">{deleteEyebrow}</span>
                <span class="title">{row.title}</span>
            {/if}
        </span>

        <span class="trail">
            {#if locked}
                {#key deleteSecondsLeft}
                    <motion.span
                        initial={{ y: -7, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                        style={styleString(() => ({
                            display: 'inline-flex',
                            alignItems: 'center',
                            lineHeight: 1,
                            fontVariantNumeric: 'tabular-nums'
                        }))}
                    >
                        {deleteSecondsLeft}
                    </motion.span>
                {/key}
            {:else if deleteArmed && !deleted}
                <span class="ready">Ready</span>
            {/if}
        </span>
    </motion.button>
{:else}
    <motion.div
        key="recording-normal-row"
        animate={archived ? { opacity: 0.55, x: 0 } : { opacity: 1, x: 0 }}
        whileHover={{ x: 2 }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        data-testid="recording-armed-row"
        data-archive-armed={archiveArmed}
        data-delete-armed={deleteArmed}
        data-delete-row-active={deleteActive}
        style={styleString(() => ({
            position: 'relative',
            display: 'flex',
            height: '4rem',
            width: '100%',
            alignItems: 'center',
            gap: '0.75rem',
            border: '1px solid var(--brut-rule-2, #bbc4c0)',
            background: 'var(--brut-bg-2, #eef4f1)',
            padding: '0.75rem',
            boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
        }))}
    >
        <div class="glyph">
            <FileText size={18} />
        </div>

        <div class="copy">
            <p class="eyebrow ink3">{archived ? 'Archived' : row.eyebrow}</p>
            <p class="title ink">{row.title}</p>
        </div>

        <div class="actions">
            <div class="archive-slot">
                {#if coverArchiveSlot}
                    <div class="cover" aria-hidden="true"></div>
                {/if}

                <motion.button
                    type="button"
                    aria-label={archived ? 'Unarchive insight' : 'Archive insight'}
                    aria-hidden={coverArchiveSlot}
                    tabindex={coverArchiveSlot ? -1 : 0}
                    whileHover={{
                        scale: 1.16,
                        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                        color: 'var(--brut-ink, #0a0a0a)'
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                    onclick={() => onArmArchive(row.id)}
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
                            initial={{ opacity: 0, scale: 0.78, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.78, x: 10 }}
                            transition={{ duration: 0.12 }}
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
                                onclick={() => onConfirmArchive(row.id)}
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
                                    key="recording-archive-disarm-meter"
                                    initial={{ scaleX: 1 }}
                                    animate={{ scaleX: 0 }}
                                    transition={{
                                        duration: archiveTimeoutMs / 1000,
                                        ease: 'linear'
                                    }}
                                    aria-hidden="true"
                                    data-testid="recording-archive-disarm-meter"
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
                                {#if archived}
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

            {#if !archived}
                <motion.button
                    type="button"
                    aria-label="Delete insight"
                    whileHover={{
                        scale: 1.16,
                        backgroundColor: 'var(--armed-danger-soft, rgba(185, 28, 28, 0.12))'
                    }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                    onclick={() => onArmDelete(row.id)}
                    style={styleString(() => ({
                        display: 'inline-flex',
                        width: '2rem',
                        height: '2rem',
                        flex: 'none',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid transparent',
                        background: 'transparent',
                        color: 'var(--armed-danger, #b91c1c)',
                        cursor: 'pointer'
                    }))}
                >
                    <Trash2 size={15} />
                </motion.button>
            {/if}
        </div>
    </motion.div>
{/if}

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

    .label {
        min-width: 0;
        flex: 1;
        text-align: left;
    }

    .eyebrow {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        line-height: 1.25;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    .label .eyebrow {
        display: block;
        opacity: 0.62;
    }

    .eyebrow.ink3 {
        color: var(--brut-ink-3, #9a9a9a);
    }

    .title {
        margin: 0.125rem 0 0;
        overflow: hidden;
        font-size: 0.8125rem;
        font-weight: 600;
        line-height: 1.25;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .label .title {
        display: block;
    }

    .title.ink {
        color: var(--brut-ink, #0a0a0a);
    }

    .deleted-line {
        display: block;
        font-size: 0.8125rem;
        line-height: 1.25;
    }

    .trail {
        display: flex;
        width: 4rem;
        flex: none;
        justify-content: flex-end;
    }

    .ready {
        position: relative;
        top: 1px;
        display: inline-flex;
        align-items: center;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        line-height: 1;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }

    .actions {
        display: flex;
        height: 2rem;
        flex: none;
        align-items: center;
        justify-content: flex-end;
        gap: 0.25rem;
    }

    .archive-slot {
        position: relative;
        display: flex;
        width: 2rem;
        height: 2rem;
        align-items: center;
        justify-content: flex-end;
    }

    .cover {
        pointer-events: none;
        position: absolute;
        inset: 0 0 0 auto;
        z-index: 10;
        width: 6.75rem;
        background: var(--brut-bg-2, #eef4f1);
    }
</style>
