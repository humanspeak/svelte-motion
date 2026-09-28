<script lang="ts">
    import { onMount } from 'svelte'

    /**
     * Read-only rAF sampler that classifies each movement of a fixture element
     * as GLIDED (rendered several in-between positions) or SNAPPED (jumped in
     * one frame).
     *
     * It only reads `getBoundingClientRect()` and never touches fixture state
     * or motion props. It is meant to be rendered inside `TesterPanel`, which
     * never mounts under Playwright, so the parity specs' per-id rect-read
     * counts are unaffected.
     *
     * @prop targetId Element whose movement is tracked (e.g. `button`).
     * @prop parentId Optional row/parent element; its offset from the target
     *     is shown and tracked for drift.
     * @prop expectedTop Optional function returning the expected settle top
     *     for the current state (read from the DOM or page state, read-only).
     * @prop emphasizeOffset Show "offset from row" as the headline number.
     */
    let {
        targetId,
        parentId,
        expectedTop,
        emphasizeOffset = false
    }: {
        targetId: string
        parentId?: string
        expectedTop?: () => number | null
        emphasizeOffset?: boolean
    } = $props()

    type Movement = {
        id: number
        verdict: 'GLIDED' | 'SNAPPED'
        from: number
        to: number
        frames: number
        intermediates: number
        maxStep: number
        maxOffsetDrift: number | null
    }

    /** Minimum per-frame movement (px) that counts as "moving". */
    const MOVE_EPSILON = 0.05
    /** Unchanged frames before a movement is considered finished. */
    const SETTLE_FRAMES = 12
    /** Intermediate positions needed for a GLIDED verdict. */
    const GLIDE_MIN_INTERMEDIATES = 3
    /** A single-frame jump at least this large (px) is a teleport, even if
     *  the element glides afterwards (e.g. snap first, then animate). */
    const SNAP_STEP = 15

    let current = $state<{ top: number; left: number; offset: number | null } | null>(null)
    let baselineOffset = $state<number | null>(null)
    let expected = $state<number | null>(null)
    let moving = $state(false)
    let history = $state<Movement[]>([])

    onMount(() => {
        let frame = 0
        let nextId = 1
        let prev: { top: number; left: number; offset: number | null } | null = null
        let active: {
            from: number
            fromLeft: number
            frames: number
            positions: Set<string>
            maxStep: number
            maxOffsetDrift: number
            still: number
        } | null = null

        const sample = () => {
            const target = document.getElementById(targetId)
            const parent = parentId ? document.getElementById(parentId) : null
            if (target) {
                const rect = target.getBoundingClientRect()
                const offset = parent ? rect.top - parent.getBoundingClientRect().top : null
                const next = { top: rect.top, left: rect.left, offset }
                if (baselineOffset === null && offset !== null) baselineOffset = offset

                if (prev) {
                    const step = Math.hypot(next.top - prev.top, next.left - prev.left)
                    const drift =
                        offset !== null && baselineOffset !== null
                            ? Math.abs(offset - baselineOffset)
                            : 0
                    if (step > MOVE_EPSILON) {
                        if (!active) {
                            active = {
                                from: prev.top,
                                fromLeft: prev.left,
                                frames: 0,
                                positions: new Set(),
                                maxStep: 0,
                                maxOffsetDrift: 0,
                                still: 0
                            }
                            moving = true
                        }
                        active.frames += 1
                        active.still = 0
                        active.maxStep = Math.max(active.maxStep, step)
                        active.maxOffsetDrift = Math.max(active.maxOffsetDrift, drift)
                        active.positions.add(`${Math.round(next.top)},${Math.round(next.left)}`)
                    } else if (active) {
                        active.still += 1
                        if (active.still >= SETTLE_FRAMES) {
                            const end = `${Math.round(next.top)},${Math.round(next.left)}`
                            const start = `${Math.round(active.from)},${Math.round(active.fromLeft)}`
                            active.positions.delete(end)
                            active.positions.delete(start)
                            const intermediates = active.positions.size
                            history = [
                                {
                                    id: nextId++,
                                    verdict:
                                        intermediates >= GLIDE_MIN_INTERMEDIATES &&
                                        active.maxStep < SNAP_STEP
                                            ? ('GLIDED' as const)
                                            : ('SNAPPED' as const),
                                    from: active.from,
                                    to: next.top,
                                    frames: active.frames,
                                    intermediates,
                                    maxStep: active.maxStep,
                                    maxOffsetDrift: parent ? active.maxOffsetDrift : null
                                },
                                ...history
                            ].slice(0, 5)
                            active = null
                            moving = false
                        }
                    }
                }
                prev = next
                if (
                    !current ||
                    Math.abs(current.top - next.top) >= 0.05 ||
                    Math.abs(current.left - next.left) >= 0.05 ||
                    (next.offset !== null &&
                        current.offset !== null &&
                        Math.abs(current.offset - next.offset) >= 0.05)
                ) {
                    current = next
                }
            }
            const nextExpected = expectedTop?.() ?? null
            if (nextExpected !== expected) expected = nextExpected
            frame = requestAnimationFrame(sample)
        }
        frame = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(frame)
    })

    const fmt = (value: number | null | undefined) => (value == null ? '—' : value.toFixed(1))
    const offsetDrift = $derived(
        current?.offset != null && baselineOffset !== null ? current.offset - baselineOffset : null
    )
</script>

<div class="meter" aria-label="Live movement readout">
    <dl class:emphasize-offset={emphasizeOffset}>
        <div class="top">
            <dt>#{targetId} top</dt>
            <dd>{fmt(current?.top)} <span>px</span></dd>
        </div>
        {#if parentId}
            <div class="offset">
                <dt>Offset from row (#{parentId})</dt>
                <dd>
                    {fmt(current?.offset)} <span>px</span>
                    {#if offsetDrift !== null}
                        <small class:bad={Math.abs(offsetDrift) > 1}
                            >{Math.abs(offsetDrift) <= 1
                                ? 'holding (±1 px of start)'
                                : `off by ${offsetDrift.toFixed(1)} px`}</small
                        >
                    {/if}
                </dd>
            </div>
        {/if}
        {#if expectedTop}
            <div>
                <dt>Expected settle top</dt>
                <dd>{expected ?? '—'} <span>px</span></dd>
            </div>
        {/if}
    </dl>
    <p class="state">{moving ? 'Moving…' : 'At rest'}</p>

    <h3>Last movements</h3>
    {#if history.length === 0}
        <p class="empty">No movement yet. Try a step above.</p>
    {:else}
        <ul>
            {#each history as move (move.id)}
                <li>
                    <span class="chip" class:snapped={move.verdict === 'SNAPPED'}
                        >{move.verdict}</span
                    >
                    <span class="detail">
                        {#if move.verdict === 'GLIDED'}
                            {fmt(move.from)} → {fmt(move.to)}: moved over {move.frames} frames, {move.intermediates}
                            in-between positions
                        {:else}
                            {fmt(move.from)} → {fmt(move.to)}: moved {fmt(move.maxStep)} px in a single
                            frame
                        {/if}
                        {#if move.maxOffsetDrift !== null}
                            <br />row offset drifted up to {fmt(move.maxOffsetDrift)} px
                        {/if}
                    </span>
                </li>
            {/each}
        </ul>
    {/if}
    <p class="note">
        GLIDED = at least {GLIDE_MIN_INTERMEDIATES} in-between positions were drawn. SNAPPED = it teleported:
        fewer in-between positions, or a single-frame jump of {SNAP_STEP} px or more.
    </p>
</div>

<style>
    dl {
        margin: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
    }
    dl > div {
        padding: 8px 10px;
        border: 1px solid #e6ebf0;
        border-radius: 8px;
    }
    dl.emphasize-offset .offset {
        grid-column: 1 / -1;
        order: -1;
        border-color: #12628e;
        background: #eef8fe;
    }
    dl.emphasize-offset .offset dd {
        font-size: 24px;
    }
    dt {
        color: #556275;
        font-size: 11px;
        margin-bottom: 2px;
    }
    dd {
        margin: 0;
        color: #182437;
        font:
            600 17px/1.3 ui-monospace,
            SFMono-Regular,
            monospace;
        font-variant-numeric: tabular-nums;
    }
    dd span {
        font-size: 11px;
        font-weight: 400;
        color: #657287;
    }
    dd small {
        display: block;
        font:
            600 11px/1.3 system-ui,
            sans-serif;
        color: #16724c;
    }
    dd small.bad {
        color: #b42318;
    }
    .state {
        margin: 8px 0 10px;
        font-size: 11px;
        color: #647185;
    }
    h3 {
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 700;
        color: #556275;
    }
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    li {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        padding: 6px 0;
        border-top: 1px solid #eef1f5;
        font-size: 12px;
        color: #43536a;
    }
    .chip {
        flex-shrink: 0;
        padding: 1px 8px;
        border-radius: 999px;
        font:
            700 10px/1.6 ui-monospace,
            monospace;
        color: #fff;
        background: #16724c;
    }
    .chip.snapped {
        background: #b42318;
    }
    .empty,
    .note {
        margin: 6px 0 0;
        font-size: 11px;
        color: #647185;
    }
</style>
