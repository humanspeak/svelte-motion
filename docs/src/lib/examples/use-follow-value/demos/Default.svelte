<script lang="ts">
    import { useFollowValue, useMotionValue } from '@humanspeak/svelte-motion'

    // The source motion values track the pointer position. Every follower
    // below derives from these two — the personality of each trail is
    // entirely down to its transition config.
    const targetX = useMotionValue(0)
    const targetY = useMotionValue(0)

    // Six follower personalities, each picked to be visibly distinct from the
    // others so the trail effect is legible at a glance:
    //
    //   1. crisp spring   — leads close, snaps to position
    //   2. medium spring  — bouncy, classic spring feel
    //   3. floaty spring  — heavy mass, drifts on momentum
    //   4. quick tween    — eased, no overshoot, fast
    //   5. long tween     — eased, laggy ghost
    //   6. wobbly spring  — very underdamped, oscillates around the target
    //
    // Each follower renders as a hue-bordered RING sized by its lag —
    // at rest the six rings nest into a bullseye (all visible at once);
    // in motion they separate into a trail ordered by responsiveness.
    type Follower = {
        label: string
        color: string
        size: number
        x: ReturnType<typeof useFollowValue<number>>
        y: ReturnType<typeof useFollowValue<number>>
    }

    const followers: Follower[] = [
        {
            label: 'crisp spring',
            color: '#ef4444',
            size: 18,
            x: useFollowValue(targetX, { type: 'spring', stiffness: 600, damping: 30 }),
            y: useFollowValue(targetY, { type: 'spring', stiffness: 600, damping: 30 })
        },
        {
            label: 'bouncy spring',
            color: '#f59e0b',
            size: 26,
            x: useFollowValue(targetX, { type: 'spring', stiffness: 220, damping: 14 }),
            y: useFollowValue(targetY, { type: 'spring', stiffness: 220, damping: 14 })
        },
        {
            label: 'floaty spring',
            color: '#10b981',
            size: 34,
            x: useFollowValue(targetX, { type: 'spring', stiffness: 70, damping: 12, mass: 4 }),
            y: useFollowValue(targetY, { type: 'spring', stiffness: 70, damping: 12, mass: 4 })
        },
        {
            label: 'quick tween',
            color: '#3b82f6',
            size: 50,
            x: useFollowValue(targetX, { type: 'tween', duration: 0.35, ease: 'easeOut' }),
            y: useFollowValue(targetY, { type: 'tween', duration: 0.35, ease: 'easeOut' })
        },
        {
            label: 'long tween',
            color: '#8b5cf6',
            size: 50,
            x: useFollowValue(targetX, { type: 'tween', duration: 1.2, ease: 'easeInOut' }),
            y: useFollowValue(targetY, { type: 'tween', duration: 1.2, ease: 'easeInOut' })
        },
        {
            label: 'wobbly spring',
            color: '#ec4899',
            size: 58,
            x: useFollowValue(targetX, { type: 'spring', stiffness: 200, damping: 4 }),
            y: useFollowValue(targetY, { type: 'spring', stiffness: 200, damping: 4 })
        }
    ]

    let stage: HTMLDivElement | undefined = $state()

    const onPointerMove = (event: PointerEvent) => {
        if (!stage) return
        const rect = stage.getBoundingClientRect()
        // Centre-relative coords — easier to work with than top-left since
        // we render trails on a centred stage.
        targetX.set(event.clientX - rect.left - rect.width / 2)
        targetY.set(event.clientY - rect.top - rect.height / 2)
    }

    // On enter, snap the source to the current pointer so the trails
    // don't have to chase a previous resting position.
    const onPointerEnter = (event: PointerEvent) => {
        if (!stage) return
        const rect = stage.getBoundingClientRect()
        const x = event.clientX - rect.left - rect.width / 2
        const y = event.clientY - rect.top - rect.height / 2
        // Skip animating to the entry position — each follower's source is a
        // plain MotionValue; .set on the source still drives followers
        // through their transition, so we use .jump on each follower
        // instead.
        for (const f of followers) {
            f.x.jump(x)
            f.y.jump(y)
        }
        targetX.set(x)
        targetY.set(y)
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-follow-value</span>
            <span class="micro readout">6 followers / 1 source</span>
        </div>

        <div
            class="stage"
            bind:this={stage}
            onpointermove={onPointerMove}
            onpointerenter={onPointerEnter}
            role="presentation"
        >
            <p class="hint">move your cursor over this card</p>

            <div
                class="source-dot"
                style:transform="translate({targetX.current}px, {targetY.current}px)"
                aria-hidden="true"
            ></div>
            {#each followers as f (f.label)}
                <div
                    class="follower"
                    style:width="{f.size}px"
                    style:height="{f.size}px"
                    style:margin-top="{-f.size / 2}px"
                    style:margin-left="{-f.size / 2}px"
                    style:border-color={f.color}
                    style:transform="translate({f.x.current}px, {f.y.current}px)"
                    aria-hidden="true"
                ></div>
            {/each}

            <ul class="legend">
                {#each followers as f (f.label)}
                    <li>
                        <span class="swatch" style:background={f.color}></span>
                        {f.label}
                    </li>
                {/each}
            </ul>
        </div>

        <div class="strip-foot">
            <span class="micro">one source · six transition configs</span>
            <span class="micro">rings sized by lag</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        width: 100%;
    }

    .strip {
        width: 100%;
        max-width: 560px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .stage {
        position: relative;
        width: 100%;
        height: 360px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        background:
            linear-gradient(90deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            linear-gradient(0deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            var(--brut-bg-2, #eef4f1);
        background-size:
            36px 36px,
            36px 36px,
            auto;
        overflow: hidden;
        cursor: crosshair;
        touch-action: none;
        user-select: none;
    }

    .hint {
        position: absolute;
        /* Sits in the upper region so the resting bullseye (centred) never
           overlaps the copy. */
        top: 18%;
        left: 50%;
        transform: translate(-50%, -50%);
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--brut-ink-3, #9a9a9a);
        pointer-events: none;
        /* Above the rings — on first move they sweep through the centre and
           would otherwise crosshatch the hint into illegibility. */
        z-index: 2;
    }

    .source-dot {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 6px;
        height: 6px;
        margin: -3px 0 0 -3px;
        background: var(--brut-ink, #0a0a0a);
        will-change: transform;
        pointer-events: none;
    }

    .follower {
        position: absolute;
        top: 50%;
        left: 50%;
        /* margin-top / margin-left set inline per-follower to `-size/2` so
           every ring centres on the pointer regardless of its diameter.
           Transparent-filled rings never occlude each other: at rest they
           nest into a bullseye, in motion they separate into a trail. */
        border: 3px solid;
        border-radius: 999px;
        will-change: transform;
        pointer-events: none;
    }

    .legend {
        position: absolute;
        bottom: 12px;
        left: 12px;
        margin: 0;
        padding: 8px 10px;
        list-style: none;
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--brut-ink-2, #525252);
        background: var(--brut-bg, #f8fcfb);
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        display: grid;
        grid-template-columns: repeat(2, auto);
        gap: 3px 14px;
        pointer-events: none;
        /* Rings pass under the legend panel, not over its labels. */
        z-index: 2;
    }

    :global(html.dark) .legend {
        color: var(--brut-ink-2, #525252);
    }

    .legend li {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .swatch {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 999px;
    }
</style>
