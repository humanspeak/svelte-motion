<script lang="ts">
    import { motion, MotionConfig } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    /**
     * A layout animation with no configured transition uses upstream's
     * `defaultLayoutTransition`: a 0.45 s tween eased with `[0.4, 0, 0.1, 1]`
     * (`packages/motion-dom/src/projection/node/create-projection-node.ts`
     * `:670-673` and `:2926-2929` @ `v14.14.0`). Driven by
     * `e2e/layout/default-transition.spec.ts`.
     *
     * - `#default`: no `transition` prop and no `MotionConfig` (≈ 450 ms).
     * - `#configured`: a `MotionConfig` transition of 0.2 s still reaches the
     *   layout animation (≈ 200 ms).
     * - `#explicit`: a `transition` prop of 0.3 s wins (≈ 300 ms).
     *
     * Each box times `onLayoutAnimationStart` → `onLayoutAnimationComplete`
     * with `performance.now()` and writes the rounded ms to `data-duration`.
     */
    type BoxId = 'default' | 'configured' | 'explicit'

    const expected: Record<BoxId, number> = { default: 450, configured: 200, explicit: 300 }
    const tolerance = 60

    let moved = $state(false)
    let isTester = $state(false)

    const starts: Record<BoxId, number> = { default: 0, configured: 0, explicit: 0 }
    let durations = $state<Record<BoxId, number | null>>({
        default: null,
        configured: null,
        explicit: null
    })

    const toggle = () => {
        durations = { default: null, configured: null, explicit: null }
        moved = !moved
    }

    const onStart = (id: BoxId) => () => {
        starts[id] = performance.now()
    }
    const onComplete = (id: BoxId) => () => {
        durations[id] = Math.round(performance.now() - starts[id])
    }

    const pass = (id: BoxId) => {
        const d = durations[id]
        return d !== null && Math.abs(d - expected[id]) <= tolerance
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const steps: TesterStep[] = [
        {
            text: 'Press "Toggle". All three boxes slide to the right end of their row.',
            expected:
                'default ≈ 450 ms, configured ≈ 200 ms, explicit ≈ 300 ms. The default box is visibly the slowest and eases out gently.',
            action: { label: 'Toggle', run: toggle }
        },
        {
            text: 'Press "Toggle" again. The boxes slide back to the left.',
            expected: 'The same three durations as before, each within ±60 ms.',
            action: { label: 'Toggle', run: toggle }
        }
    ]

    const boxStyle = { width: '80px', height: '80px', borderRadius: '8px' }
</script>

<svelte:head>
    <title>Layout · default layout transition (0.45 s)</title>
</svelte:head>

<div class="fixture">
    <button id="toggle" onclick={toggle}>Toggle</button>

    <div class="label">default (no transition)</div>
    <div class="row" style:justify-content={moved ? 'flex-end' : 'flex-start'}>
        <motion.div
            id="default"
            layout
            data-duration={durations.default ?? undefined}
            onLayoutAnimationStart={onStart('default')}
            onLayoutAnimationComplete={onComplete('default')}
            style={{ ...boxStyle, background: '#2563eb' }}
        />
    </div>
    <div class="readout" data-testid="readout-default">
        default: {durations.default === null ? '—' : `${durations.default} ms`}
    </div>

    <div class="label">configured (MotionConfig 0.2 s linear)</div>
    <MotionConfig transition={{ duration: 0.2, ease: 'linear' }}>
        <div class="row" style:justify-content={moved ? 'flex-end' : 'flex-start'}>
            <motion.div
                id="configured"
                layout
                data-duration={durations.configured ?? undefined}
                onLayoutAnimationStart={onStart('configured')}
                onLayoutAnimationComplete={onComplete('configured')}
                style={{ ...boxStyle, background: '#16a34a' }}
            />
        </div>
    </MotionConfig>
    <div class="readout" data-testid="readout-configured">
        configured: {durations.configured === null ? '—' : `${durations.configured} ms`}
    </div>

    <div class="label">explicit (transition 0.3 s linear)</div>
    <div class="row" style:justify-content={moved ? 'flex-end' : 'flex-start'}>
        <motion.div
            id="explicit"
            layout
            transition={{ duration: 0.3, ease: 'linear' }}
            data-duration={durations.explicit ?? undefined}
            onLayoutAnimationStart={onStart('explicit')}
            onLayoutAnimationComplete={onComplete('explicit')}
            style={{ ...boxStyle, background: '#dc2626' }}
        />
    </div>
    <div class="readout" data-testid="readout-explicit">
        explicit: {durations.explicit === null ? '—' : `${durations.explicit} ms`}
    </div>
</div>

<TesterPanel
    eyebrow="Motion 14.14 · defaultLayoutTransition"
    title="A layout animation with no transition takes 0.45 s"
    status="Before this fix the default box took ~0.3 s (motion-dom's generic tween)."
    {steps}
>
    {#snippet summary()}
        {#if isTester}
            {#each ['default', 'configured', 'explicit'] as const as id (id)}
                {#if durations[id] === null}
                    <span class="verdict na">{id}: WAITING</span>
                {:else}
                    <span class="verdict {pass(id) ? 'ok' : 'bad'}">
                        {id}: {durations[id]} ms {pass(id) ? 'PASS ✓' : 'FAIL ✗'}
                    </span>
                {/if}
            {/each}
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            Three <code>layout</code> boxes move between the left and right ends of a 600px row.
            Each times its layout animation from <code>onLayoutAnimationStart</code> to
            <code>onLayoutAnimationComplete</code>. Expected: default ≈ 450 ms (upstream's 0.45 s
            <code>[0.4, 0, 0.1, 1]</code> tween), configured ≈ 200 ms (<code>MotionConfig</code>),
            explicit ≈ 300 ms (<code>transition</code> prop). A box passes within ±60 ms. Pressing Toggle
            only moves the boxes; it has no other side effect.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        padding: 16px;
    }

    .row {
        display: flex;
        width: 600px;
        max-width: 100%;
        padding: 4px 0;
        background: #f1f5f9;
    }

    .label {
        margin-top: 16px;
        font-size: 0.85rem;
    }

    .readout {
        font-family: monospace;
        font-size: 0.85rem;
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
