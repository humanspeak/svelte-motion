<script lang="ts">
    /**
     * Repro of the FIG-002 drag demo from the svelte-motion docs landing
     * (motion.svelte.page). User reported the card escaping the
     * dragConstraints box — far past +200 right boundary, with rotation.
     *
     * The setup mirrors the docs exactly:
     *   - dragConstraints { left: -200, right: 200, top: -120, bottom: 120 }
     *   - dragElastic: 0.18
     *   - dragTransition { bounceStiffness: 360, bounceDamping: 24 }
     *   - Motion object-style `rotate` derived from rendered x via $state,
     *     matching React Framer Motion's `style={{ rotate }}` transform path
     *
     * Telemetry side panel logs x / y / rotate, peak x / peak y, and a
     * "frames" counter so we can see whether onDrag stops firing while
     * the constraint snap-back is animating. Knobs below let us flip
     * rotation off, change elastic/stiffness/damping, and toggle
     * dragMomentum — narrowing the suspect bag.
     */
    import { motion } from '$lib'
    import { onDestroy } from 'svelte'

    // ── Drag state ────────────────────────────────────────────────────
    // Telemetry tracks the card's *rendered* translate (not info.offset,
    // which is the raw pointer offset and diverges wildly from where the
    // card actually sits once elastic clamping kicks in). We sample
    // getComputedStyle every rAF so the readouts mirror what the user
    // sees — including during the post-release spring-back (when onDrag
    // is silent).
    let x = $state(0)
    let y = $state(0)
    let peakX = $state(0)
    let peakY = $state(0)
    let active = $state(false)
    let landingX = $state<number | null>(null) // translate at release
    let landingY = $state<number | null>(null)
    let restingX = $state<number | null>(null) // translate after settle
    let restingY = $state<number | null>(null)
    let postReleaseFrames = $state(0)
    let settleFrames = $state<number | null>(null) // frames until settled
    let cardEl: HTMLElement | null = $state(null)

    // Locate the actual rendered card element via querySelector — bind:this
    // on a `motion.div` would bind the Svelte component instance, not the
    // DOM node we need for readMatrix.
    $effect(() => {
        if (typeof document === 'undefined') return
        cardEl = document.querySelector<HTMLElement>('[data-testid="drag-card"]')
    })

    // ── Knobs ─────────────────────────────────────────────────────────
    let rotateEnabled = $state(true)
    let elastic = $state(0.18)
    let stiffness = $state(360)
    let damping = $state(24)
    let momentum = $state(true) // svelte-motion default is true

    const rotateClamped = $derived(rotateEnabled ? Math.max(-12, Math.min(12, (x / 200) * 12)) : 0)
    const rotateStr = $derived(`${Math.round(rotateClamped * 10) / 10}`)

    // Computed dragConstraints + dragTransition rebuild reactively
    // whenever a knob flips so changes take effect mid-session.
    const constraints = { left: -200, right: 200, top: -120, bottom: 120 }
    const dragTransition = $derived({
        bounceStiffness: stiffness,
        bounceDamping: damping
    })

    // ── Rendered-transform sampler ────────────────────────────────────
    // rAF loop reads the actual matrix(...) on the card each frame so
    // telemetry shows where the card *really* is, not the raw pointer
    // offset. Also counts post-release frames and detects "settled"
    // (translate stable for N consecutive frames after release).
    let rafHandle = 0
    let stableCount = 0
    const STABLE_FRAMES_TO_SETTLE = 8
    let lastTx = 0
    let lastTy = 0

    const readMatrix = (el: HTMLElement): { tx: number; ty: number } => {
        const t = window.getComputedStyle(el).transform
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return { tx: 0, ty: 0 }
        const parts = m[1].split(',').map((s) => Number.parseFloat(s.trim()))
        return { tx: parts[4] ?? 0, ty: parts[5] ?? 0 }
    }

    const tick = () => {
        if (cardEl) {
            const { tx, ty } = readMatrix(cardEl)
            x = Math.round(tx)
            y = Math.round(ty)
            if (Math.abs(x) > Math.abs(peakX)) peakX = x
            if (Math.abs(y) > Math.abs(peakY)) peakY = y

            // Post-release accounting: tick frames + detect settle by
            // comparing this frame's translate to last frame's.
            if (!active && landingX !== null && settleFrames === null) {
                postReleaseFrames++
                const dx = Math.abs(tx - lastTx)
                const dy = Math.abs(ty - lastTy)
                if (dx < 0.5 && dy < 0.5) {
                    stableCount++
                    if (stableCount >= STABLE_FRAMES_TO_SETTLE) {
                        settleFrames = postReleaseFrames - STABLE_FRAMES_TO_SETTLE
                        restingX = Math.round(tx)
                        restingY = Math.round(ty)
                    }
                } else {
                    stableCount = 0
                }
            }
            lastTx = tx
            lastTy = ty
        }
        rafHandle = requestAnimationFrame(tick)
    }
    if (typeof window !== 'undefined') {
        rafHandle = requestAnimationFrame(tick)
    }
    onDestroy(() => {
        if (typeof window !== 'undefined' && rafHandle) cancelAnimationFrame(rafHandle)
    })

    const onDragStart = () => {
        active = true
        landingX = null
        landingY = null
        restingX = null
        restingY = null
        postReleaseFrames = 0
        settleFrames = null
        stableCount = 0
    }
    const onDragEnd = () => {
        active = false
        // Snapshot the card's translate AT release (next rAF reads from
        // here as the baseline for settle detection).
        if (cardEl) {
            const { tx, ty } = readMatrix(cardEl)
            landingX = Math.round(tx)
            landingY = Math.round(ty)
        }
    }

    const reset = () => {
        x = 0
        y = 0
        peakX = 0
        peakY = 0
        landingX = null
        landingY = null
        restingX = null
        restingY = null
        postReleaseFrames = 0
        settleFrames = null
        stableCount = 0
    }
</script>

<svelte:head>
    <title>Drag · brutalist-stage repro</title>
</svelte:head>

<div class="page">
    <h1>Brutalist drag-stage repro</h1>
    <p class="hint">
        Drag the card. Watch x/y/rotate in the telemetry side panel. If the card ever ends up
        outside the dashed constraint box after release, that's the bug we're chasing.
    </p>

    <div class="layout">
        <aside class="telemetry">
            <div><span class="k">file</span> · <span class="v">drag.svelte</span></div>
            <div><span class="k">x</span> · <span class="v">{x}px</span></div>
            <div><span class="k">y</span> · <span class="v">{y}px</span></div>
            <div><span class="k">rotate</span> · <span class="v">{rotateStr}°</span></div>
            <div><span class="k">peak x</span> · <span class="v">{peakX}px</span></div>
            <div><span class="k">peak y</span> · <span class="v">{peakY}px</span></div>
            <div>
                <span class="k">landing x</span> ·
                <span class="v">{landingX === null ? '—' : `${landingX}px`}</span>
            </div>
            <div>
                <span class="k">landing y</span> ·
                <span class="v">{landingY === null ? '—' : `${landingY}px`}</span>
            </div>
            <div>
                <span class="k">resting x</span> ·
                <span class="v">{restingX === null ? '—' : `${restingX}px`}</span>
            </div>
            <div>
                <span class="k">resting y</span> ·
                <span class="v">{restingY === null ? '—' : `${restingY}px`}</span>
            </div>
            <div>
                <span class="k">settle frames</span> ·
                <span class="v">{settleFrames === null ? '—' : settleFrames}</span>
            </div>
            <div>
                <span class="k">post-release frames</span> ·
                <span class="v">{postReleaseFrames}</span>
            </div>
            <div>
                <span class="k">status</span> ·
                <span class="v" class:active>{active ? 'dragging' : 'idle'}</span>
            </div>
            <hr />
            <div><span class="k">elastic</span> · <span class="v">{elastic}</span></div>
            <div><span class="k">bounceStiffness</span> · <span class="v">{stiffness}</span></div>
            <div><span class="k">bounceDamping</span> · <span class="v">{damping}</span></div>
            <div>
                <span class="k">dragMomentum</span> ·
                <span class="v">{momentum ? 'on' : 'off'}</span>
            </div>
            <button type="button" onclick={reset}>↻ reset</button>
        </aside>

        <div class="stage">
            <div class="constraints-box" aria-hidden="true">
                <span class="cb-tl">−200, −120</span>
                <span class="cb-tr">+200, −120</span>
                <span class="cb-bl">−200, +120</span>
                <span class="cb-br">+200, +120</span>
                <span class="cb-label">dragConstraints · 400 × 240</span>
            </div>
            <motion.div
                class="card"
                drag
                dragConstraints={constraints}
                dragElastic={elastic}
                dragMomentum={momentum}
                {dragTransition}
                whileHover={{ scale: 1.02 }}
                whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                {onDragStart}
                {onDragEnd}
                data-testid="drag-card"
                style={{ rotate: `${rotateClamped}deg` }}
            >
                <span class="card-label">motion.div</span>
                <ul class="card-props">
                    <li>drag</li>
                    <li>dragConstraints</li>
                    <li>dragElastic</li>
                </ul>
            </motion.div>
        </div>
    </div>

    <fieldset class="knobs">
        <legend>knobs</legend>
        <label>
            <input type="checkbox" bind:checked={rotateEnabled} />
            apply CSS rotate (suspect: rotation might confuse constraint hit-tests)
        </label>
        <label>
            <input type="checkbox" bind:checked={momentum} />
            dragMomentum (off = no inertia after release, only elastic snap-back)
        </label>
        <label>
            elastic
            <input type="range" min="0" max="1" step="0.02" bind:value={elastic} />
            <span class="v">{elastic}</span>
        </label>
        <label>
            bounceStiffness
            <input type="range" min="50" max="1000" step="10" bind:value={stiffness} />
            <span class="v">{stiffness}</span>
        </label>
        <label>
            bounceDamping
            <input type="range" min="2" max="60" step="1" bind:value={damping} />
            <span class="v">{damping}</span>
        </label>
    </fieldset>
</div>

<style>
    .page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 24px 56px;
        color: #ededed;
        background: #06090a;
        min-height: 100vh;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 13px;
    }
    h1 {
        font-size: 20px;
        font-weight: 500;
        margin: 0 0 8px;
        letter-spacing: -0.02em;
        text-transform: lowercase;
    }
    .hint {
        font-family: system-ui, sans-serif;
        font-size: 13px;
        color: #9a9a9a;
        margin: 0 0 24px;
        max-width: 640px;
        line-height: 1.55;
    }
    .layout {
        display: grid;
        grid-template-columns: 220px 1fr;
        gap: 16px;
        margin-bottom: 24px;
    }
    .telemetry {
        font-size: 11px;
        color: #9a9a9a;
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px;
        border: 1px solid #1c2422;
        background: #0d1110;
    }
    .telemetry .k {
        color: #5a5a5a;
    }
    .telemetry .v {
        color: #ededed;
        font-variant-numeric: tabular-nums;
    }
    .telemetry .v.active {
        color: #54dbbc;
    }
    .telemetry hr {
        border: 0;
        border-top: 1px dashed #1c2422;
        margin: 8px 0;
    }
    .telemetry button {
        background: transparent;
        border: 1px solid #1c2422;
        color: #ededed;
        padding: 6px 10px;
        font: inherit;
        cursor: pointer;
        margin-top: 8px;
    }
    .telemetry button:hover {
        border-color: #54dbbc;
    }
    .stage {
        position: relative;
        height: 480px;
        border: 1px solid #1c2422;
        background:
            linear-gradient(#1c2422 1px, transparent 1px) center center / 32px 32px,
            linear-gradient(90deg, #1c2422 1px, transparent 1px) center center / 32px 32px;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .constraints-box {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 400px;
        height: 240px;
        transform: translate(-50%, -50%);
        border: 1px dashed #2a332f;
        pointer-events: none;
    }
    .constraints-box span {
        position: absolute;
        font-size: 9.5px;
        letter-spacing: 0.12em;
        color: #5a5a5a;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        white-space: nowrap;
    }
    .constraints-box .cb-tl {
        top: -16px;
        left: -2px;
    }
    .constraints-box .cb-tr {
        top: -16px;
        right: -2px;
    }
    .constraints-box .cb-bl {
        bottom: -16px;
        left: -2px;
    }
    .constraints-box .cb-br {
        bottom: -16px;
        right: -2px;
    }
    .constraints-box .cb-label {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 10px;
        opacity: 0.55;
    }
    :global(.card) {
        width: 280px;
        height: 132px;
        padding: 14px 18px;
        background: #06090a;
        border: 1px solid #54dbbc;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        cursor: grab;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        user-select: none;
        will-change: transform;
        box-sizing: border-box;
    }
    :global(.card .card-label) {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 17px;
        color: #ededed;
        letter-spacing: -0.02em;
        line-height: 1;
    }
    :global(.card .card-props) {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 4px;
        max-width: 100%;
    }
    :global(.card .card-props li) {
        font-family: 'JetBrains Mono', ui-monospace, monospace;
        font-size: 9.5px;
        line-height: 1;
        letter-spacing: 0.04em;
        padding: 4px 6px;
        border: 1px solid #1c2422;
        color: #9a9a9a;
        background: #0d1110;
        white-space: nowrap;
    }

    .knobs {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px 24px;
        padding: 16px 20px;
        border: 1px solid #1c2422;
        background: #0d1110;
    }
    .knobs legend {
        padding: 0 8px;
        font-size: 10.5px;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #5a5a5a;
    }
    .knobs label {
        font-size: 12px;
        color: #ededed;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
    .knobs input[type='range'] {
        accent-color: #54dbbc;
        width: 160px;
    }
    .knobs .v {
        font-variant-numeric: tabular-nums;
        color: #9a9a9a;
    }
</style>
