<script lang="ts">
    /**
     * Port of upstream `dev/react/src/tests/issue-2024.tsx` (Motion 14.7.1;
     * motion-dom `cc260d322`, `cc84e31ad`, `8e2a53308`, `a04f5e6ee`,
     * `6e56b3883`).
     *
     * #2024: a `Reorder.Item` with ref `dragConstraints` inside a scrolled
     * `layoutScroll` group jumped by the scroll offset when grabbed. The ref
     * constraints were measured before the scroll (and against the layout
     * box, which removes that scroll). Since 14.7.1 the drag controls
     * re-measure them when a `layoutScroll` ancestor's scroll changed.
     *
     * - `?constraints=ref` — `dragConstraints` is the group element (default)
     * - `?constraints=object` — `dragConstraints={{ top: 0, bottom: 0 }}`
     * - `?constraints=none` — no `dragConstraints` (control)
     * - `&layoutScroll` — mark the group as a `layoutScroll` container
     * - `&outer` — wrap the group in a scrollable `layoutScroll` container
     *
     * Svelte-only: `window.rebindConstraints()` drops the ref constraints for
     * one tick and restores them. Each change of the items' `dragConstraints`
     * makes `DragGestureFeature.update()` re-fire the projection `'measure'`
     * event ("Svelte deviation 2" in `visualElementCore.ts`), so the spec can
     * check that this re-measure and motion-dom's scroll-keyed one agree.
     * (Nulling `groupEl` is safe: `_MotionContainer`'s `ref` is write-only.)
     *
     * @component
     */
    import { page } from '$app/state'
    import { motion, Reorder, type DragConstraints } from '$lib'
    import { onMount, tick } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import Item from './Item.svelte'

    const mode = page.url.searchParams.get('constraints') || 'ref'
    const hasLayoutScroll = page.url.searchParams.has('layoutScroll')
    const outer = page.url.searchParams.has('outer')

    let items = $state(Array.from({ length: 12 }, (_, i) => i))
    let groupEl = $state<HTMLElement | null>(null)

    const constraints = $derived<DragConstraints | undefined>(
        mode === 'ref'
            ? (groupEl ?? undefined)
            : mode === 'object'
              ? { top: 0, bottom: 0 }
              : undefined
    )

    // ---- Live verdict (tester only) ----
    //
    // While an item is dragged, compare how far it moved with how far the
    // pointer moved. A jump by the scroll offset shows as a large gap.

    let gap = $state<number | null>(null)

    onMount(() => {
        const w = window as unknown as { rebindConstraints?: () => Promise<void> }
        if (mode !== 'none') {
            w.rebindConstraints = async () => {
                const el = groupEl
                groupEl = null
                await tick()
                groupEl = el
                await tick()
            }
        }

        if (window.location.search.includes('@isPlaywright=true')) {
            return () => delete w.rebindConstraints
        }

        let raf = 0
        let item: HTMLElement | null = null
        let pointerY0 = 0
        let pointerY = 0
        let itemY0 = 0
        let worst = 0

        const sample = () => {
            if (!item) return
            const moved = item.getBoundingClientRect().top - itemY0
            const deviation = Math.abs(moved - (pointerY - pointerY0))
            worst = Math.max(worst, deviation)
            gap = worst
            raf = requestAnimationFrame(sample)
        }
        const down = (e: PointerEvent) => {
            const target = (e.target as Element | null)?.closest<HTMLElement>(
                '[data-testid^="item-"]'
            )
            if (!target) return
            item = target
            pointerY0 = pointerY = e.clientY
            itemY0 = target.getBoundingClientRect().top
            worst = 0
            raf = requestAnimationFrame(sample)
        }
        const move = (e: PointerEvent) => {
            pointerY = e.clientY
        }
        const up = () => {
            item = null
            cancelAnimationFrame(raf)
        }
        window.addEventListener('pointerdown', down, true)
        window.addEventListener('pointermove', move, true)
        window.addEventListener('pointerup', up, true)
        return () => {
            delete w.rebindConstraints
            cancelAnimationFrame(raf)
            window.removeEventListener('pointerdown', down, true)
            window.removeEventListener('pointermove', move, true)
            window.removeEventListener('pointerup', up, true)
        }
    })

    const steps: TesterStep[] = [
        {
            text: 'Scroll the list down a bit, then drag item 5 down about 20px and back up.',
            expected: 'It stays under your pointer; it never jumps by the scrolled distance.'
        },
        {
            text: 'Try again with ?constraints=ref&layoutScroll and with &outer added (scroll both).',
            expected: 'Same: the chip reads FOLLOWS ✓ while you hold the item.'
        }
    ]
</script>

<svelte:head>
    <title>Reorder · ref dragConstraints in a scrolled layoutScroll group (#2024)</title>
</svelte:head>

{#snippet group()}
    <Reorder.Group
        bind:ref={groupEl}
        id="group"
        data-testid="group"
        layoutScroll={hasLayoutScroll}
        axis="y"
        values={items}
        onReorder={(next: number[]) => (items = next)}
        style="position: relative; width: 300px; height: 300px; overflow-y: auto; margin: 0; padding: 0; background: #eee"
    >
        {#each items as item (item)}
            <Item {item} {constraints} />
        {/each}
    </Reorder.Group>
{/snippet}

{#if outer}
    <motion.div id="outer" data-testid="outer" layoutScroll style="height: 400px; overflow-y: auto">
        <div style="height: 200px"></div>
        {@render group()}
        <div style="height: 300px"></div>
    </motion.div>
{:else}
    {@render group()}
{/if}

<TesterPanel
    eyebrow="Motion 14.7.1 · #2024"
    title="Ref dragConstraints follow a scrolled layoutScroll group"
    status="Fails on Motion 14.6.0 with ?constraints=ref&layoutScroll once scrolled; passes from Motion 14.7.1."
    {steps}
>
    {#snippet summary()}
        {#if gap === null}
            <span class="verdict na">WAITING</span>
        {:else if gap <= 3}
            <span class="verdict ok">FOLLOWS ✓</span>
        {:else}
            <span class="verdict bad">JUMPED ✗ ({Math.round(gap)}px)</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            A scrollable <code>Reorder.Group</code> whose items use the group itself as
            <code>dragConstraints</code>. Mode: <code>{mode}</code>{hasLayoutScroll
                ? ', layoutScroll'
                : ''}{outer ? ', inside a scrolled layoutScroll wrapper' : ''}.
        </p>
        <p>
            Before Motion 14.7.1 the constraints were measured before the group scrolled, so
            grabbing an item in a scrolled <code>layoutScroll</code> group moved it by the scroll offset
            (about 65px up for a 20px drag). The chip shows the largest gap between the item's movement
            and the pointer's during the current drag.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .verdict {
        display: inline-block;
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
