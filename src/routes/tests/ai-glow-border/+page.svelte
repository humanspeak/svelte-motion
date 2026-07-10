<script lang="ts">
    import {
        motion,
        useMotionValue,
        useReducedMotion,
        useSpring,
        useTransform,
        useAnimationFrame
    } from '$lib'

    /**
     * Apple Intelligence wavy glow border — the smooth rebuild of the archived
     * prototype (.agents/.plans/upstream-parity-top3/assets/ai-glow-prototype.html).
     *
     * Architecture (the four performance MUSTs from plan 005):
     * 1. No per-frame CSS-variable writes on :root — every animated channel is a
     *    MotionValue bound to a component-scoped element.
     * 2. Hot spots are transform-driven divs (translate3d via x/y springs), not
     *    repainting radial-gradient background positions.
     * 3. The conic field rotates via transform: rotate() on an oversized square
     *    rotor child, not by animating the gradient's `from` angle.
     * 4. The displacement filter is applied ONLY to the thin base ring band; the
     *    wide haze ring is a static blurred gradient with no per-frame changes.
     */

    // Canonical Apple Intelligence palette (SwiftUI reference implementation).
    // Apple Intelligence palette + the humanspeak brand mint as the signature stop.
    const P = [
        '#BC82F3',
        '#F5B9EA',
        '#8D9FFF',
        '#AA6EEE',
        '#FF6778',
        '#FFBA71',
        '#C686FF',
        '#54DBBC'
    ]

    // Blobs orbit at incommensurate angular speeds (rad/s) so the combined
    // brightness travel never visibly repeats.
    const BLOBS = [
        { color: P[4], w: 140, h: 110, speed: 0.21, phase: 0.0, wob: 0.13 },
        { color: P[7], w: 160, h: 130, speed: -0.16, phase: 2.1, wob: 0.19 },
        { color: P[5], w: 130, h: 100, speed: 0.12, phase: 4.2, wob: 0.11 },
        { color: P[1], w: 150, h: 120, speed: -0.26, phase: 1.3, wob: 0.16 }
    ]

    const reducedMotion = useReducedMotion()

    let listening = $state(false)

    // --- MotionValue channel map (see plan 005) ------------------------------
    // Flow multiplier: scales conic rotation, noise scroll and blob orbits
    // together, so the listening boost accelerates everything smoothly instead
    // of restarting animations.
    const flow = useSpring(1, { stiffness: 60, damping: 18 })
    // --- Tuning panel -------------------------------------------------------
    // Every animated channel that reduces to one number gets a slider; the
    // defaults ARE the shipped look, so the panel starts neutral. The
    // listening boosts are fixed ratios of whatever the sliders choose.
    /** Base ring outward reach in px; every ring dimension derives from it. */
    let thickness = $state(2)
    /** Multiplier on every travel speed (rotation, drift, orbits, swell). */
    let flowSpeed = $state(1)
    /** Idle displacement amplitude; listening boosts it ×1.6. */
    let waveAmp = $state(20)
    /** Fraction of amplitude the two-sine swell adds/removes over time. */
    let swellDepth = $state(0.32)
    /** Idle glow opacity; listening boosts it ×1.28. */
    let brightness = $state(0.9)

    const LISTENING_WAVE_BOOST = 1.6
    const LISTENING_GLOW_BOOST = 1.28

    // feDisplacementMap scale — the frame loop layers a slow two-sine swell on
    // top so the waviness itself rises and relaxes like rolling water.
    const dispScale = useSpring(20, { stiffness: 80, damping: 20 })
    // Glow opacity — each ring derives its own share.
    const glow = useSpring(0.9, { stiffness: 80, damping: 20 })
    const baseOpacity = useTransform(glow, (v: number) => Math.min(v, 1))
    const bloomOpacity = useTransform(glow, (v: number) => v * 0.75)
    const hazeOpacity = useTransform(glow, (v: number) => v * 0.4)
    // Breathing pulse on the whole frame — compositor-only scale.
    const pulse = useSpring(1, { stiffness: 120, damping: 16 })

    // Conic rotation, integrated in the frame loop below (transform-driven).
    const rotate = useMotionValue(0)

    // Noise drift: the two fields move on different axes as BOUNDED dual-sine
    // oscillations (max ~±70px), never linear scroll. Turbulence only rasters
    // inside its primitive subregion, so an ever-growing offset walks the
    // pattern off the noise field — the straight raster boundary then sweeps
    // through the band as boxy rigid-shift artifacts. Bounded phases stay on
    // the field forever, and the incommensurate sine pairs never repeat, so
    // the interference still swells and subsides per-side.
    // Each field drifts along a full (dx, dy) vector whose DIRECTION slowly
    // orbits the compass while its magnitude breathes through zero — so wave
    // travel sweeps angularly around the ring. DOM-rotating the noise field
    // instead (spin wrapper + counter-spun band) leaks the content raster's
    // boundary through the displacement as a tilted ghost ring — the drift
    // vector achieves the angular motion without touching geometry.
    const drift1x = useMotionValue(0)
    const drift1y = useMotionValue(0)
    const drift2x = useMotionValue(0)
    const drift2y = useMotionValue(0)

    // Per-blob position springs; targets are retargeted every frame from the
    // orbit math, the spring adds the organic lag.
    const blobSprings = BLOBS.map(() => ({
        x: useSpring(0, { stiffness: 90, damping: 22 }),
        y: useSpring(0, { stiffness: 90, damping: 22 })
    }))

    // Measured card box → orbit radii in px (transforms, not percentages).
    let cardEl = $state<HTMLButtonElement>()

    // Frame-loop integrator state. Lives OUTSIDE the $effect: reading a
    // reactive value (incl. AugmentedMotionValue.get(), which routes through
    // the reactive `current`) in the effect body subscribes the effect to it,
    // and any per-frame write would then tear down and restart the loop every
    // frame — resetting local state and halving every integrated speed.
    let angle = 0
    let phase = 0
    let lastFrame: number | undefined

    const blobTarget = (index: number, t: number, w: number, h: number) => {
        const b = BLOBS[index]
        const a = b.phase + t * b.speed * flow.get()
        const wobble = Math.sin(t * (0.7 + b.wob) + b.phase) * 14
        return {
            x: Math.cos(a) * (w * 0.53 + wobble),
            y: Math.sin(a) * (h * 0.85 + wobble)
        }
    }

    $effect(() => {
        const w = cardEl?.clientWidth ?? 520
        const h = cardEl?.clientHeight ?? 90

        if (reducedMotion.current) {
            // Static glow: place the blobs at their t=0 orbit spots and leave
            // every channel at rest — no frame loop at all.
            blobSprings.forEach((spring, i) => {
                const { x, y } = blobTarget(i, 0, w, h)
                spring.x.jump(x)
                spring.y.jump(y)
            })
            return
        }

        lastFrame = undefined

        return useAnimationFrame((now) => {
            if (lastFrame === undefined) lastFrame = now
            const dt = Math.min((now - lastFrame) / 1000, 0.05)
            lastFrame = now
            const t = now / 1000
            const speed = flow.get() * flowSpeed

            angle = (angle + dt * speed * 24) % 360
            rotate.set(angle)

            // Accumulate phase (not offset) so the listening speed boost only
            // accelerates the oscillation, never grows its bounds.
            phase += dt * speed
            // Magnitudes breathe through zero, so the direction swings never
            // cause a visible jump; both stay bounded ≤ ~72px, inside the
            // noise raster's margins.
            const m1 = 46 * Math.sin(phase * 0.42) + 20 * Math.sin(phase * 0.9)
            const a1 = 0.13 * phase + 0.9 * Math.sin(phase * 0.11)
            drift1x.set(m1 * Math.cos(a1))
            drift1y.set(m1 * Math.sin(a1))
            const m2 = 50 * Math.sin(phase * 0.31 + 2.1) + 22 * Math.sin(phase * 0.77)
            const a2 = -0.09 * phase + 1.1 * Math.sin(phase * 0.07 + 1)
            drift2x.set(m2 * Math.cos(a2))
            drift2y.set(m2 * Math.sin(a2))

            // Swell: two incommensurate sines modulate the displacement, so
            // wave height travels and breathes instead of staying uniform.
            const dispBase = waveAmp * (listening ? LISTENING_WAVE_BOOST : 1)
            const swell = swellDepth * (0.625 * Math.sin(t * 0.8) + 0.375 * Math.sin(t * 1.31))
            dispScale.set(dispBase * (1 + swell))

            for (let i = 0; i < BLOBS.length; i++) {
                const { x, y } = blobTarget(i, t, w, h)
                blobSprings[i].x.set(x)
                blobSprings[i].y.set(y)
            }

            if (listening) {
                pulse.set(1.008 + Math.sin(t * 2.2) * 0.006)
            }
        })
    })

    // Slider + toggle → spring targets. The frame loop re-targets dispScale
    // each frame with the swell on top; these effects are what make the
    // sliders live on the reduced-motion path, where no loop runs.
    $effect(() => {
        glow.set(brightness * (listening ? LISTENING_GLOW_BOOST : 1))
    })
    $effect(() => {
        dispScale.set(waveAmp * (listening ? LISTENING_WAVE_BOOST : 1))
    })

    const toggleListening = () => {
        listening = !listening
        flow.set(listening ? 1.9 : 1)
        if (!listening) pulse.set(1)
    }
</script>

<svelte:head>
    <title>AI glow border (wavy, smooth)</title>
</svelte:head>

<!-- The wavy-edge filter. JS-visible channels: both feOffset dy values (bound
     declaratively via plan 002's SVG MotionValue attributes) and the
     feDisplacementMap scale (attrScale — a plain `scale` prop would be routed
     to the CSS transform instead). Displace first, blur after (in the CSS
     filter list) — reversing the order makes the waves crunchy. -->
<svg width="0" height="0" aria-hidden="true" style="position: absolute">
    <defs>
        <!-- The region margins must exceed the offset oscillation bounds plus
             the displacement scale, or the noise raster's straight edge sweeps
             into the band as boxy artifacts (~130px margins vs ~90px
             worst-case excursion). Keep the region as small as that allows:
             the displaced layers re-raster it every frame. -->
        <filter
            id="aiWave"
            x="-25%"
            y="-100%"
            width="150%"
            height="300%"
            color-interpolation-filters="sRGB"
        >
            <feTurbulence
                type="fractalNoise"
                baseFrequency="0.014 0.018"
                numOctaves="3"
                seed="7"
                result="n1"
            />
            <motion.feoffset in="n1" dx={drift1x} dy={drift1y} result="o1" />
            <feTurbulence
                type="fractalNoise"
                baseFrequency="0.014 0.018"
                numOctaves="3"
                seed="23"
                result="n2"
            />
            <motion.feoffset in="n2" dx={drift2x} dy={drift2y} result="o2" />
            <!-- Average (not `over`) so the two independently-drifting fields
                 interfere — that beat pattern is what lets a wave rise on one
                 side of the ring while another side subsides. -->
            <feComposite
                in="o1"
                in2="o2"
                operator="arithmetic"
                k1="0"
                k2="0.5"
                k3="0.5"
                k4="0"
                result="mergedNoise"
            />
            <motion.fedisplacementmap
                data-testid="displacement-map"
                in="SourceGraphic"
                in2="mergedNoise"
                attrScale={dispScale}
                xChannelSelector="R"
                yChannelSelector="G"
            />
        </filter>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color={P[1]} />
            <stop offset="0.5" stop-color={P[3]} />
            <stop offset="1" stop-color={P[2]} />
        </linearGradient>
    </defs>
</svg>

<main class="page">
    <header>
        <h1>AI glow border — wavy, smooth</h1>
        <p>
            Compositor-friendly rebuild of the Apple Intelligence border: conic rotor + orbiting
            blobs behind a displaced ring band. Click the card to enter the listening state.
        </p>
    </header>

    <div class="stage" style="--t: {thickness}px">
        <motion.div class="frame" style={{ scale: pulse }}>
            <!-- Haze: STATIC wide blurred ring. No filter animation, no children,
                 no per-frame changes — only its opacity springs on toggle. -->
            <motion.div class="ring haze" style={{ opacity: hazeOpacity }} aria-hidden="true" />

            <!-- Bloom: mid ring, displaced + blurred. -->
            <motion.div class="ring bloom" style={{ opacity: bloomOpacity }} aria-hidden="true">
                <!-- The band extends ~16px UNDER the opaque card so its
                     displaced inner edge can never pull away and open a dark
                     gap between card and glow. -->
                <div class="ring-mask">
                    <div class="rotor-pos">
                        <motion.div class="rotor" style={{ rotate }} />
                    </div>
                    {#each BLOBS as blob, i (i)}
                        <motion.div
                            class="blob"
                            style={{
                                x: blobSprings[i].x,
                                y: blobSprings[i].y,
                                width: `${blob.w}px`,
                                height: `${blob.h}px`,
                                marginLeft: `${-blob.w / 2}px`,
                                marginTop: `${-blob.h / 2}px`,
                                background: `radial-gradient(closest-side, ${blob.color}, transparent)`
                            }}
                        />
                    {/each}
                </div>
            </motion.div>

            <!-- Base: thin crisp band hugging the card. -->
            <motion.div
                class="ring base"
                style={{ opacity: baseOpacity }}
                aria-hidden="true"
                data-testid="ring-base"
            >
                <div class="ring-mask">
                    <div class="rotor-pos">
                        <motion.div class="rotor" data-testid="rotor" style={{ rotate }} />
                    </div>
                    {#each BLOBS as blob, i (i)}
                        <motion.div
                            class="blob"
                            style={{
                                x: blobSprings[i].x,
                                y: blobSprings[i].y,
                                width: `${blob.w}px`,
                                height: `${blob.h}px`,
                                marginLeft: `${-blob.w / 2}px`,
                                marginTop: `${-blob.h / 2}px`,
                                background: `radial-gradient(closest-side, ${blob.color}, transparent)`
                            }}
                        />
                    {/each}
                </div>
            </motion.div>

            <button
                class="card"
                data-testid="card"
                aria-pressed={listening}
                onclick={toggleListening}
                bind:this={cardEl}
            >
                <svg class="spark" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M12 1.5c.6 4.9 4 8.4 9 9-5 .6-8.4 4.1-9 9-.6-4.9-4-8.4-9-9 5-.6 8.4-4.1 9-9Z"
                        fill="url(#sparkGrad)"
                    />
                </svg>
                <span class="prompt">
                    <span class="ask">Ask anything…</span>
                    <span class="hint">Summarize, rewrite, or generate — on-device</span>
                </span>
                <span class="state" data-testid="state-chip" class:active={listening}>
                    {listening ? 'listening' : 'idle'}
                </span>
            </button>
        </motion.div>
    </div>

    <!-- Tuning panel: defaults are the shipped look. -->
    <div class="controls">
        <div class="control">
            <label for="thickness">
                Thickness
                <output>{thickness.toFixed(1)}px</output>
            </label>
            <input
                id="thickness"
                data-testid="thickness-slider"
                type="range"
                min="1"
                max="14"
                step="0.5"
                bind:value={thickness}
            />
        </div>
        <div class="control">
            <label for="flow-speed">
                Flow
                <output>{flowSpeed.toFixed(1)}×</output>
            </label>
            <input
                id="flow-speed"
                data-testid="flow-slider"
                type="range"
                min="0.2"
                max="3"
                step="0.1"
                bind:value={flowSpeed}
            />
        </div>
        <div class="control">
            <label for="wave-amp">
                Waviness
                <output>{waveAmp.toFixed(0)}</output>
            </label>
            <input
                id="wave-amp"
                data-testid="wave-slider"
                type="range"
                min="0"
                max="60"
                step="1"
                bind:value={waveAmp}
            />
        </div>
        <div class="control">
            <label for="swell-depth">
                Swell
                <output>±{Math.round(swellDepth * 100)}%</output>
            </label>
            <input
                id="swell-depth"
                data-testid="swell-slider"
                type="range"
                min="0"
                max="0.6"
                step="0.02"
                bind:value={swellDepth}
            />
        </div>
        <div class="control">
            <label for="brightness">
                Brightness
                <output>{brightness.toFixed(2)}</output>
            </label>
            <input
                id="brightness"
                data-testid="brightness-slider"
                type="range"
                min="0.2"
                max="1.4"
                step="0.05"
                bind:value={brightness}
            />
        </div>
    </div>
</main>

<style>
    /* 100vw includes the scrollbar gutter, so the full-bleed canvas overflows
       the client width by ~15px and would otherwise summon a horizontal
       scrollbar (whose height then causes vertical overflow too). */
    :global(body) {
        overflow-x: hidden;
    }

    .page {
        /* Full-bleed: the root layout's Tailwind `.container` caps width at the
           left edge of the viewport, and #sandbox is a centering flex row that
           would otherwise shrink us into it (or center our overhang). The
           negative right margin collapses our outer size back to the parent's,
           pinning the left edge to viewport 0 so the dark canvas spans
           edge-to-edge. */
        width: 100vw;
        flex-shrink: 0;
        margin-right: calc(100% - 100vw);
        min-height: 100vh;
        background: #08080d;
        color: #f5f5fa;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 48px 24px 64px;
        font-family:
            -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
    }

    header {
        width: 100%;
        max-width: 720px;
    }

    header h1 {
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    header p {
        margin-top: 8px;
        color: #86868e;
        font-size: 15px;
        line-height: 1.5;
        max-width: 60ch;
    }

    /* MUST #4 (part): confine layout + paint of the whole glow stage. The
       72px padding keeps the widest ring inside the containment box. */
    .stage {
        width: 100%;
        max-width: 720px;
        display: flex;
        align-items: center;
        justify-content: center;
        /* Wide enough that the haze's blur reach (inset -30px + 58px blur)
           never hits the containment clip — scaled with the thickness slider
           on ALL sides (the 24px horizontal padding clipped the haze). */
        padding: calc(28px + var(--t) * 15);
        contain: layout paint;
    }

    .stage :global(.frame) {
        position: relative;
        width: min(520px, 100%);
    }

    /* ---- Glow rings -------------------------------------------------- */

    /* Concentric rounding: each ring's outer radius is the card radius (28px)
       plus its inset, so the punched-out hole's corners match the card exactly.
       A smaller radius leaves an uncovered dark square at each card corner. */
    .stage :global(.ring) {
        position: absolute;
        pointer-events: none;
    }

    .stage :global(.ring.base) {
        inset: calc(var(--t) * -1);
        border-radius: calc(28px + var(--t));
        /* Displace FIRST, soften after. */
        filter: url(#aiWave) blur(calc(var(--t) * 0.8)) saturate(1.3);
        will-change: filter;
    }

    /* The bloom shares the displacement so the OUTER contour reads wavy, not
       just the thin base band under it (plan 005 allows this if the frame
       budget holds — verified). Displace first, blur after. */
    .stage :global(.ring.bloom) {
        inset: calc(var(--t) * -1.5);
        border-radius: calc(28px + var(--t) * 1.5);
        /* Blur must stay well under the wave amplitude or it rounds the
           displaced contour smooth again. */
        filter: url(#aiWave) blur(calc(var(--t) * 2)) saturate(1.2);
        will-change: filter;
        mix-blend-mode: screen;
    }

    .stage :global(.ring.haze) {
        inset: calc(var(--t) * -2.5);
        border-radius: calc(28px + var(--t) * 2.5);
        padding: calc(var(--t) * 2.5);
        background: conic-gradient(
            from 0deg,
            #bc82f3,
            #8d9fff,
            #54dbbc,
            #aa6eee,
            #ff6778,
            #ffba71,
            #f5b9ea,
            #c686ff,
            #bc82f3
        );
        filter: blur(calc(var(--t) * 6));
        mix-blend-mode: screen;
        -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
        mask-composite: exclude;
    }

    /* Punches the center out of the animated field, leaving a band ring.
       The mask applies to the rotor/blob descendants too, and it sits on a
       CHILD of the filtered element so the displacement warps the
       already-masked ring edges (filter would otherwise run first). */
    .stage :global(.ring-mask) {
        position: absolute;
        inset: 0;
        border-radius: inherit;
        overflow: hidden;
        -webkit-mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask:
            linear-gradient(#000 0 0) content-box,
            linear-gradient(#000 0 0);
        mask-composite: exclude;
    }

    /* Band widths: the ring's inset (outward reach) + ~16px hidden under the
       opaque card, so displaced inner edges never open a gap. */
    .stage :global(.ring.base .ring-mask) {
        padding: calc(var(--t) + 16px);
    }

    .stage :global(.ring.bloom .ring-mask) {
        padding: calc(var(--t) * 1.5 + 16px);
    }

    .rotor-pos {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 150%;
        aspect-ratio: 1;
    }

    /* MUST #3: the color field rotates as a GPU-composited transform on an
       oversized square, never by repainting the gradient's `from` angle. */
    .stage :global(.rotor) {
        position: absolute;
        inset: 0;
        background: conic-gradient(
            from 0deg,
            #bc82f3,
            #8d9fff,
            #54dbbc,
            #aa6eee,
            #ff6778,
            #ffba71,
            #f5b9ea,
            #c686ff,
            #bc82f3
        );
    }

    /* MUST #2: hot spots are transform-driven elements. */
    .stage :global(.blob) {
        position: absolute;
        left: 50%;
        top: 50%;
    }

    /* ---- Card -------------------------------------------------------- */

    .stage :global(.card) {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        gap: 16px;
        background: linear-gradient(180deg, #16161e, #101016);
        border: none;
        border-radius: 28px;
        padding: 22px 24px;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        user-select: none;
    }

    /* Crisp 1px inner hairline — the sharp/soft contrast that sells depth. */
    .stage :global(.card)::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 28px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        pointer-events: none;
    }

    .spark {
        flex: none;
        width: 26px;
        height: 26px;
    }

    .prompt {
        flex: 1;
        min-width: 0;
        display: block;
    }

    .prompt .ask {
        display: block;
        font-size: 17px;
        font-weight: 500;
    }

    .prompt .hint {
        display: block;
        margin-top: 3px;
        font-size: 12px;
        color: #86868e;
    }

    .state {
        flex: none;
        font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #86868e;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        padding: 5px 10px;
        transition:
            color 0.4s,
            border-color 0.4s;
    }

    .state.active {
        color: #f5b9ea;
        border-color: rgba(245, 185, 234, 0.35);
    }

    /* ---- Controls ---------------------------------------------------- */

    .controls {
        width: min(720px, 100%);
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 14px 24px;
        padding: 16px 20px;
        background: #101016;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 14px;
    }

    .control {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .controls label {
        display: flex;
        justify-content: space-between;
        font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: #86868e;
    }

    .controls output {
        color: #f5f5fa;
        font-variant-numeric: tabular-nums;
    }

    .controls input[type='range'] {
        width: 100%;
        accent-color: #aa6eee;
    }
</style>
