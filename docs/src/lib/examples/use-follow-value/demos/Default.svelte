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
    // Each label gets a matching colour + size so the personalities are
    // identifiable in the trail.
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
            size: 26,
            x: useFollowValue(targetX, { type: 'spring', stiffness: 600, damping: 30 }),
            y: useFollowValue(targetY, { type: 'spring', stiffness: 600, damping: 30 })
        },
        {
            label: 'bouncy spring',
            color: '#f59e0b',
            size: 30,
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
            size: 38,
            x: useFollowValue(targetX, { type: 'tween', duration: 0.35, ease: 'easeOut' }),
            y: useFollowValue(targetY, { type: 'tween', duration: 0.35, ease: 'easeOut' })
        },
        {
            label: 'long tween',
            color: '#8b5cf6',
            size: 42,
            x: useFollowValue(targetX, { type: 'tween', duration: 1.2, ease: 'easeInOut' }),
            y: useFollowValue(targetY, { type: 'tween', duration: 1.2, ease: 'easeInOut' })
        },
        {
            label: 'wobbly spring',
            color: '#ec4899',
            size: 46,
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
    <div
        class="stage"
        bind:this={stage}
        onpointermove={onPointerMove}
        onpointerenter={onPointerEnter}
    >
        <p class="hint">Move your cursor over this card</p>

        {#each followers as f (f.label)}
            <div
                class="follower"
                style:width="{f.size}px"
                style:height="{f.size}px"
                style:margin-top="{-f.size / 2}px"
                style:margin-left="{-f.size / 2}px"
                style:background={f.color}
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
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        width: 100%;
    }

    .stage {
        position: relative;
        width: 100%;
        max-width: 560px;
        height: 360px;
        border-radius: 14px;
        /* Default = light mode. Branded teal wash sits on a near-white
           brand-50 base so the page doesn't get a stark slab on light. */
        background:
            radial-gradient(
                circle at 50% 50%,
                color-mix(in oklab, var(--color-brand-500) 26%, transparent) 0%,
                color-mix(in oklab, var(--color-brand-500) 0%, transparent) 60%
            ),
            var(--color-brand-50);
        overflow: hidden;
        cursor: crosshair;
        touch-action: none;
        user-select: none;
    }

    :global(html.dark) .stage {
        /* Dark mode = deep teal slab (brand-900) with the same wash. */
        background:
            radial-gradient(
                circle at 50% 50%,
                color-mix(in oklab, var(--color-brand-500) 22%, transparent) 0%,
                color-mix(in oklab, var(--color-brand-500) 0%, transparent) 60%
            ),
            var(--color-brand-900);
    }

    .hint {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        margin: 0;
        font-size: 13px;
        color: color-mix(in oklab, var(--color-brand-900) 55%, transparent);
        font-family: ui-sans-serif, system-ui, sans-serif;
        letter-spacing: 0.02em;
        pointer-events: none;
    }

    :global(html.dark) .hint {
        color: color-mix(in oklab, var(--color-brand-100) 55%, transparent);
    }

    .follower {
        position: absolute;
        top: 50%;
        left: 50%;
        /* margin-top / margin-left set inline per-follower to `-size/2` so
           every dot centres on the pointer regardless of its diameter. */
        border-radius: 999px;
        /* Light: multiply darkens overlaps against the brand-50 base. */
        mix-blend-mode: multiply;
        box-shadow: 0 0 24px currentColor;
        opacity: 0.88;
        will-change: transform;
        pointer-events: none;
    }

    :global(html.dark) .follower {
        /* Dark: screen brightens overlaps against the brand-900 base. */
        mix-blend-mode: screen;
    }

    .legend {
        position: absolute;
        bottom: 12px;
        left: 12px;
        margin: 0;
        padding: 8px 10px;
        list-style: none;
        font-size: 11px;
        font-family: ui-monospace, monospace;
        color: color-mix(in oklab, var(--color-brand-900) 75%, transparent);
        background: color-mix(in oklab, var(--color-brand-50) 78%, transparent);
        backdrop-filter: blur(4px);
        border-radius: 8px;
        display: grid;
        grid-template-columns: repeat(2, auto);
        gap: 2px 14px;
        pointer-events: none;
    }

    :global(html.dark) .legend {
        color: color-mix(in oklab, var(--color-brand-100) 78%, transparent);
        background: color-mix(in oklab, var(--color-brand-900) 72%, transparent);
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
