<script lang="ts">
    /**
     * THROWAWAY SPIKE — Candidate B: data-driven children ("list API").
     *
     *   <SpikeAnimatePresenceList {items} getKey={…} mode="wait">
     *       {#snippet child(item)}<motion.div … exit={{…}} />{/snippet}
     *   </SpikeAnimatePresenceList>
     *
     * This is upstream's model made explicit: the component OWNS the `{#each}`
     * over an INTERNAL array that lags the consumer's array, so a removed item
     * stays rendered — inside the existing `<PresenceChild>` — until its exit
     * completes. It adds NO animation code: the exit is whatever
     * `_MotionContainer` already does inside a `PresenceChild`
     * (`buildPresenceContext()` → `ExitAnimationFeature` → `setActive('exit')`
     * → `onExitComplete` → `safeToRemove`, plans visual-element-core 004).
     *
     * mode='wait' is likewise NOT reimplemented here: `PresenceChild`'s own
     * `enter-blocked` phase (PresenceChild.svelte:92-109) holds the incoming
     * item out of the tree until the shared exit counter drains.
     */
    import type { Snippet } from 'svelte'
    import type { AnimatePresenceMode } from '$lib/types'
    import { AnimatePresence, PresenceChild } from '$lib/index'
    import SpikeExitProbe from './SpikeExitProbe.svelte'
    import { spikeLog } from './spike-log'

    type Props = {
        items: unknown[]
        getKey: (item: unknown) => string
        mode?: AnimatePresenceMode
        initial?: boolean
        popLayout?: boolean
        child: Snippet<[unknown]>
        onExitComplete?: () => void
    }
    const {
        items,
        getKey,
        mode = 'sync',
        initial = true,
        popLayout = false,
        child,
        onExitComplete
    }: Props = $props()

    type Entry = { key: string; item: unknown; exiting: boolean }

    // The lagging array. Exiting entries keep their slot until the exit reports
    // completion, which is the whole trick: the consumer's array can drop an
    // item while ours still renders it.
    let entries = $state<Entry[]>(
        items.map((item) => ({ key: getKey(item), item, exiting: false }))
    )

    const reconcile = (next: unknown[]) => {
        const nextKeys = next.map(getKey)
        const nextSet = new Set(nextKeys)
        const byKey = new Map(entries.map((entry) => [entry.key, entry]))
        const merged: Entry[] = []

        // Keep exiting entries in their original position so the DOM order and
        // layout stay stable while they animate out.
        entries.forEach((entry) => {
            if (nextSet.has(entry.key)) return
            merged.push({ ...entry, exiting: true })
        })

        next.forEach((item, index) => {
            const key = nextKeys[index]
            const existing = byKey.get(key)
            merged.push(
                existing ? { ...existing, item, exiting: false } : { key, item, exiting: false }
            )
        })

        const changed =
            merged.length !== entries.length ||
            merged.some(
                (entry, i) => entry.key !== entries[i].key || entry.exiting !== entries[i].exiting
            )
        if (changed) {
            spikeLog('list-reconcile', {
                incoming: nextKeys.join(','),
                rendered: merged.map((e) => `${e.key}${e.exiting ? '*' : ''}`).join(',')
            })
            entries = merged
        }
    }

    $effect.pre(() => {
        reconcile(items)
    })

    const dropEntry = (key: string) => {
        entries = entries.filter((entry) => entry.key !== key || !entry.exiting)
        spikeLog('list-dropped', { key, rendered: entries.map((e) => e.key).join(',') })
    }
</script>

<AnimatePresence {mode} {initial} {onExitComplete}>
    {#each entries as entry (entry.key)}
        <PresenceChild present={!entry.exiting}>
            <SpikeExitProbe id={entry.key} {popLayout} onExitComplete={dropEntry}>
                {@render child(entry.item)}
            </SpikeExitProbe>
        </PresenceChild>
    {/each}
</AnimatePresence>
