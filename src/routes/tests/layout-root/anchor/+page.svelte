<script lang="ts">
    /**
     * Port of upstream motion `dev/react/src/tests/layout-anchor.tsx` @ v14.7.1.
     * e2e/layout/layout-anchor.spec.ts (from
     * `packages/framer-motion/cypress/integration/layout-anchor.ts`).
     *
     * Click a parent box to toggle every parent between 200px and 400px. Each
     * green child has a `layoutAnchor`, set with the sliders or presets. The
     * red child has none, for comparison, and the blue one has
     * `layoutAnchor={false}`. The children's layout transition is delayed by
     * 0.5 s, so for the first half of the parent's 1 s animation they only
     * follow it through relative projection: anchored to the centre, the
     * green child stays centred; the red one is anchored top-left and drifts.
     *
     * @component
     */
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    let expanded = $state(false)
    let anchorX = $state(0.5)
    let anchorY = $state(0.5)

    const presets = [
        { label: 'TL', x: 0, y: 0 },
        { label: 'TC', x: 0.5, y: 0 },
        { label: 'TR', x: 1, y: 0 },
        { label: 'CL', x: 0, y: 0.5 },
        { label: 'C', x: 0.5, y: 0.5 },
        { label: 'CR', x: 1, y: 0.5 },
        { label: 'BL', x: 0, y: 1 },
        { label: 'BC', x: 0.5, y: 1 },
        { label: 'BR', x: 1, y: 1 }
    ]

    const parentTransition = { type: 'tween', ease: 'linear', duration: 1 } as const
    const childTransition = { type: 'tween', ease: 'linear', duration: 1, delay: 0.5 } as const

    const parentStyle = $derived({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: expanded ? 400 : 200,
        height: expanded ? 400 : 200,
        background: 'rgba(0,0,0,0.1)',
        cursor: 'pointer'
    })

    // Set on mount, so the spec doesn't click before hydration
    let hydrated = $state(false)
    onMount(() => {
        hydrated = true
    })

    const toggle = () => (expanded = !expanded)

    // ---- Live verdict (tester only) ----
    //
    // For 0.5 s after each toggle (before the children's own animation
    // starts), track the largest distance between the green child's centre
    // and its parent's centre. CENTRED if it never exceeds 15px with the C
    // preset, DRIFTED otherwise.

    type Verdict = 'waiting' | 'sampling' | 'centred' | 'drifted'
    let verdict = $state<Verdict>('waiting')
    let maxDrift = $state<number | null>(null)

    const sampleDrift = () => {
        if (window.location.search.includes('@isPlaywright=true')) return
        verdict = 'sampling'
        const start = performance.now()
        let worst = 0
        const step = () => {
            const parent = document.getElementById('parent')
            const child = document.getElementById('child-anchored')
            if (parent && child) {
                const p = parent.getBoundingClientRect()
                const c = child.getBoundingClientRect()
                const dx = c.left + c.width / 2 - (p.left + p.width / 2)
                const dy = c.top + c.height / 2 - (p.top + p.height / 2)
                worst = Math.max(worst, Math.abs(dx), Math.abs(dy))
            }
            if (performance.now() - start < 500) {
                requestAnimationFrame(step)
                return
            }
            maxDrift = worst
            verdict = worst <= 15 ? 'centred' : 'drifted'
        }
        requestAnimationFrame(step)
    }

    const onParentClick = () => {
        toggle()
        sampleDrift()
    }

    const steps: TesterStep[] = [
        {
            text: 'Keep the "C" preset and click the green box\'s parent.',
            expected:
                "All three grey parents grow to 400px over one second. For the first half the green square stays in the centre of its parent; the red square slides toward the bottom-right with its parent's top-left corner first, then catches up. The chip reads CENTRED ✓.",
            action: { label: 'Toggle', run: onParentClick }
        },
        {
            text: 'Click again to shrink them back.',
            expected: 'Same on the way back: the green square stays centred. CENTRED ✓.',
            action: { label: 'Toggle', run: onParentClick }
        },
        {
            text: 'Pick the "TL" preset and toggle again.',
            expected:
                'The green square now behaves like the red one (anchored top-left). The chip reads DRIFTED, which is expected for TL.'
        }
    ]
</script>

<svelte:head>
    <title>layoutAnchor · centred child stays centred</title>
</svelte:head>

<div class="controls">
    <div class="controls-title">layoutAnchor</div>
    <label>
        x: {anchorX.toFixed(2)}
        <input type="range" min="0" max="1" step="0.01" bind:value={anchorX} />
    </label>
    <label>
        y: {anchorY.toFixed(2)}
        <input type="range" min="0" max="1" step="0.01" bind:value={anchorY} />
    </label>
    <div class="presets">
        {#each presets as preset (preset.label)}
            <button
                type="button"
                class:active={anchorX === preset.x && anchorY === preset.y}
                onclick={() => {
                    anchorX = preset.x
                    anchorY = preset.y
                }}
            >
                {preset.label}
            </button>
        {/each}
    </div>
    <div class="value">{`{ x: ${anchorX}, y: ${anchorY} }`}</div>
</div>

<div class="row" data-hydrated={hydrated || undefined}>
    <div>
        <div class="caption">With layoutAnchor (green)</div>
        <motion.div
            id="parent"
            layout
            onclick={onParentClick}
            style={parentStyle}
            transition={parentTransition}
        >
            <motion.div
                id="child-anchored"
                layout
                layoutAnchor={{ x: anchorX, y: anchorY }}
                style={{ width: 50, height: 50, background: 'green' }}
                transition={childTransition}
            />
        </motion.div>
    </div>

    <div>
        <div class="caption">Without layoutAnchor (red)</div>
        <motion.div
            id="parent-no-anchor"
            layout
            onclick={onParentClick}
            style={parentStyle}
            transition={parentTransition}
        >
            <motion.div
                id="child-no-anchor"
                layout
                style={{ width: 50, height: 50, background: 'red' }}
                transition={childTransition}
            />
        </motion.div>
    </div>

    <div>
        <div class="caption">layoutAnchor=&#123;false&#125; (blue)</div>
        <motion.div
            id="parent-false-anchor"
            layout
            onclick={onParentClick}
            style={parentStyle}
            transition={parentTransition}
        >
            <motion.div
                id="child-false-anchor"
                layout
                layoutAnchor={false}
                style={{ width: 50, height: 50, background: 'dodgerblue' }}
                transition={childTransition}
            />
        </motion.div>
    </div>
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · layoutAnchor"
    title="layoutAnchor keeps a centred child centred"
    status="Passes on this build (Motion 14.7.1)."
    {steps}
>
    {#snippet summary()}
        <span class="verdict {verdict === 'centred' ? 'ok' : verdict === 'drifted' ? 'bad' : 'na'}">
            {verdict === 'centred'
                ? 'CENTRED ✓'
                : verdict === 'drifted'
                  ? 'DRIFTED'
                  : verdict === 'sampling'
                    ? 'SAMPLING'
                    : 'WAITING'}
        </span>
        {#if maxDrift !== null}
            <span class="readout">max drift {maxDrift.toFixed(1)}px</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            A <code>layout</code> child of a <code>layout</code> parent follows the parent through
            relative projection. <code>layoutAnchor</code> picks the point on the parent it is
            anchored to: the default top-left, <code>{'{ x: 0.5, y: 0.5 }'}</code> for a centred
            child, or
            <code>false</code> to turn relative projection off.
        </p>
        <p>
            The children's own layout animation is delayed by 0.5 s, so the first half of each
            toggle shows only the anchor's effect.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .controls {
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 10;
        min-width: 200px;
        padding: 16px;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        color: #333;
        font-family: system-ui, sans-serif;
        font-size: 14px;
    }
    .controls-title {
        margin-bottom: 12px;
        font-weight: 600;
    }
    .controls label {
        display: block;
        margin-bottom: 8px;
    }
    .controls input {
        display: block;
        width: 100%;
    }
    .presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 4px;
    }
    .presets button {
        padding: 4px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #fff;
        cursor: pointer;
        font-size: 12px;
    }
    .presets button.active {
        border: 2px solid #007aff;
        background: #e8f0fe;
    }
    .value {
        margin-top: 12px;
        padding: 8px;
        border-radius: 4px;
        background: #f5f5f5;
        font-family: monospace;
        font-size: 12px;
    }
    .row {
        display: flex;
        gap: 40px;
        padding: 20px;
        margin-top: 240px;
    }
    .caption {
        margin-bottom: 8px;
        color: #aaa;
        font-family: system-ui, sans-serif;
        font-size: 13px;
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
    .readout {
        font-size: 0.75rem;
        color: #475569;
    }
</style>
