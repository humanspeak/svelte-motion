<script lang="ts">
    /**
     * Port of upstream `dev/react/src/tests/issue-2248.tsx` (Motion 14.6.0).
     *
     * #2248: changing layout from `onDrag` (mid-drag) should still animate the
     * element back to its original slot, as it does from `onDragEnd`. Turning
     * `drag` off while the gesture is live ends it as if released, on the axes
     * it was dragging (upstream `b0060fd42`). The card's `layout` child keeps
     * animating with it instead of jumping ahead (motion-dom `cbc357bab`).
     *
     * Card 0 closes from `onDragEnd`, card 1 from `onDrag`, both once the drag
     * has travelled more than 100px down.
     *
     * Deviation: upstream keeps `isSelected` in a per-card component. Here the
     * two flags live in one page-local `$state` array so the fixture stays a
     * single file; each card still reads and writes only its own flag.
     *
     * @component
     */
    import { motion, type DragInfo } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const selected = $state([false, false])

    const handleDrag = (id: number) => (_event: PointerEvent, info: DragInfo) => {
        if (info.offset.y > 100) selected[id] = false
    }

    const selectedStyle = {
        position: 'fixed',
        inset: 0,
        width: '50%',
        height: 'auto',
        margin: '48px auto',
        background: 'orange'
    } as const
    const closedStyle = { width: '100%', height: '100%', background: 'red' } as const

    // ---- Live verdict (tester only) ----
    //
    // Once a card has been opened and closed again, watch whether it ends up
    // back in its slot (within 1px) while it is closed.

    type Verdict = 'waiting' | 'returning' | 'in-slot' | 'stuck'
    const verdicts = $state<Verdict[]>(['waiting', 'waiting'])

    /** How long a closed card may take to settle before it counts as stuck, in ms. */
    const SETTLE_MS = 2000

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return

        const closedAt = [-1, -1]
        const wasSelected = [false, false]
        let raf = 0
        const sample = () => {
            raf = requestAnimationFrame(sample)
            const now = performance.now()
            for (const id of [0, 1]) {
                if (selected[id]) {
                    wasSelected[id] = true
                    closedAt[id] = -1
                    verdicts[id] = 'waiting'
                    continue
                }
                if (!wasSelected[id]) continue
                if (closedAt[id] < 0) closedAt[id] = now
                const slot = document.querySelector(`[data-testid="slot-${id}"]`)
                const card = document.querySelector(`[data-testid="card-${id}"]`)
                if (!slot || !card) continue
                const s = slot.getBoundingClientRect()
                const c = card.getBoundingClientRect()
                const inSlot =
                    Math.abs(s.x - c.x) <= 1 &&
                    Math.abs(s.y - c.y) <= 1 &&
                    Math.abs(s.width - c.width) <= 1 &&
                    Math.abs(s.height - c.height) <= 1
                verdicts[id] = inSlot
                    ? 'in-slot'
                    : now - closedAt[id] > SETTLE_MS
                      ? 'stuck'
                      : 'returning'
            }
        }
        raf = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(raf)
    })

    const steps: TesterStep[] = [
        {
            text: 'Click the top red card ("onDragEnd"). It opens as a centred orange card.',
            expected: 'It animates open from its slot.'
        },
        {
            text: 'Grab it, drag down more than ~100px, then release.',
            expected:
                'On release it closes and springs back into its slot. The "onDragEnd" chip reads IN SLOT ✓.'
        },
        {
            text: 'Click the second red card ("onDrag") to open it. Grab it and drag slowly down, keeping the pointer held.',
            expected:
                'Once past ~100px it closes while you are still holding: it animates back to its slot (shrinking, not jumping) and the blue square stays in its top-left corner the whole way.'
        },
        {
            text: 'Keep moving the pointer, then release.',
            expected:
                'The card stays in its slot; it no longer follows the pointer and does not jump on release. The "onDrag" chip reads IN SLOT ✓.'
        }
    ]
</script>

<svelte:head>
    <title>Drag · disable drag from onDrag (#2248)</title>
</svelte:head>

<div class="cards">
    {#each [0, 1] as id (id)}
        <div class="slot" data-testid="slot-{id}">
            {#if selected[id]}
                <div class="backdrop"></div>
            {/if}
            <motion.div
                data-testid="card-{id}"
                data-selected={selected[id]}
                style={selected[id] ? selectedStyle : closedStyle}
                onclick={() => (selected[id] = true)}
                layout
                transition={{ type: 'spring' }}
                drag={selected[id] ? 'y' : false}
                dragSnapToOrigin
                onDragEnd={id === 0 ? handleDrag(0) : undefined}
                onDrag={id === 1 ? handleDrag(1) : undefined}
            >
                <motion.div data-testid="child-{id}" class="child" layout />
                <p>{id === 0 ? 'onDragEnd' : 'onDrag'}</p>
            </motion.div>
        </div>
    {/each}
</div>

<TesterPanel
    eyebrow="Motion 14.6.0 · #2248"
    title="Turning drag off from onDrag returns the card"
    status="Passes on this build (Motion 14.6.0)."
    {steps}
>
    {#snippet summary()}
        {#each [0, 1] as id (id)}
            {@const v = verdicts[id]}
            <span class="verdict {v === 'in-slot' ? 'ok' : v === 'stuck' ? 'bad' : 'na'}">
                {id === 0 ? 'onDragEnd' : 'onDrag'}:
                {v === 'in-slot'
                    ? 'IN SLOT ✓'
                    : v === 'stuck'
                      ? 'STUCK ✗'
                      : v === 'returning'
                        ? 'RETURNING'
                        : 'WAITING'}
            </span>
        {/each}
    {/snippet}
    {#snippet checks()}
        <p>
            Each card is draggable on y only while it is open. The top card closes from
            <code>onDragEnd</code>, the second from <code>onDrag</code>, i.e. while the pointer is
            still down.
        </p>
        <p>
            Since Motion 14.6, turning <code>drag</code> off mid-gesture ends the drag as if
            released. Before, the second card stayed animation-blocked: it jumped to its slot's
            layout, kept the jump as a drag offset, and nothing animated it back on release because
            <code>drag</code> was already off.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /* Not `.container`: app.css styles that class globally as a flex row. */
    .cards {
        width: 600px;
    }

    .slot {
        height: 192px;
    }

    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
    }

    .child {
        width: 40px;
        height: 40px;
        background: blue;
    }

    .verdict {
        display: inline-block;
        margin-right: 0.25rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
