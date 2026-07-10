<script lang="ts">
    import {
        AnimatePresence,
        motion,
        useAnimationFrame,
        useMotionValue,
        useReducedMotion,
        useSpring,
        useTransform
    } from '@humanspeak/svelte-motion'

    /**
     * Apple Intelligence wavy glow border — a compositor-friendly rebuild of the
     * Apple Intelligence prompt border.
     *
     * Architecture (the four performance MUSTs):
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
    let hovered = $state(false)
    // Hover deliberately does NOT drive the label: pointer jitter at the card
    // edge would spawn overlapping enter/exit labels (sync mode keeps every
    // interrupted exit alive). The hover invite lives on the glow spring and
    // hairline instead — springs absorb jitter; text swaps don't.
    const stateLabel = $derived(listening ? 'listening' : 'idle')

    // --- MotionValue channel map --------------------------------------------
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
    /** Hover invitation: nudges the idle glow up so the border "leans in". */
    const HOVER_GLOW_BOOST = 1.25

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

    // Slider + toggle + hover → spring targets. The frame loop re-targets
    // dispScale each frame with the swell on top; these effects are what make
    // the sliders live on the reduced-motion path, where no loop runs. The
    // hover boost is the click affordance: the border visibly "leans in".
    $effect(() => {
        glow.set(brightness * (listening ? LISTENING_GLOW_BOOST : hovered ? HOVER_GLOW_BOOST : 1))
    })
    $effect(() => {
        dispScale.set(waveAmp * (listening ? LISTENING_WAVE_BOOST : 1))
    })
    // Hover lift: a small compositor-only scale so the invite is unmissable in
    // both themes (the glow-opacity nudge alone is too subtle on light). The
    // frame loop owns `pulse` while listening, so only drive it when idle.
    $effect(() => {
        if (!listening) pulse.set(hovered ? 1.015 : 1)
    })

    const toggleListening = () => {
        listening = !listening
        flow.set(listening ? 1.9 : 1)
        if (!listening) pulse.set(1)
    }
</script>

<!--
  Uses <span> rather than <strong>/<code>: docs pages wrap embedded demos in
  `.prose-v2`, whose `strong`/`code` rules match this markup at equal specificity
  and win on cascade order, repainting the text in the page's ink colour.
-->
<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <!-- The wavy-edge filter. JS-visible channels: both feoffset dx/dy values
         (bound declaratively via SVG MotionValue attributes) and the
         feDisplacementMap scale (attrScale — a plain `scale` prop would be
         routed to the CSS transform instead). Displace first, blur after (in
         the CSS filter list) — reversing the order makes the waves crunchy. -->
    <svg width="0" height="0" aria-hidden="true" style="position: absolute">
        <defs>
            <!-- The region margins must exceed the offset oscillation bounds
                 plus the displacement scale, or the noise raster's straight
                 edge sweeps into the band as boxy artifacts (~130px margins vs
                 ~90px worst-case excursion). Keep the region as small as that
                 allows: the displaced layers re-raster it every frame. -->
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
                <!-- Average (not `over`) so the two independently-drifting
                     fields interfere — that beat pattern is what lets a wave
                     rise on one side of the ring while another side subsides. -->
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

    <div class="demo-body">
        <div class="stage" style="--t: {thickness}px">
            <motion.div class="frame" style={{ scale: pulse }}>
                <!-- Haze: STATIC wide blurred ring. No filter animation, no
                     children, no per-frame changes — only its opacity springs
                     on toggle. -->
                <motion.div class="ring haze" style={{ opacity: hazeOpacity }} aria-hidden="true" />

                <!-- Bloom: mid ring, displaced + blurred. -->
                <motion.div class="ring bloom" style={{ opacity: bloomOpacity }} aria-hidden="true">
                    <!-- The band extends ~16px UNDER the opaque card so its
                         displaced inner edge can never pull away and open a
                         dark gap between card and glow. -->
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
                <motion.div class="ring base" style={{ opacity: baseOpacity }} aria-hidden="true">
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

                <button
                    class="card"
                    aria-pressed={listening}
                    onclick={toggleListening}
                    onmouseenter={() => (hovered = true)}
                    onmouseleave={() => (hovered = false)}
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
                    <span class="state" class:active={listening}>
                        <!-- The ghost pins the pill's box: labels animate as
                             absolute overlays, so mid-swap the pill never has
                             zero in-flow content (which briefly collapsed it). -->
                        <span class="state-ghost" aria-hidden="true">listening</span>
                        <!-- Same AnimatePresence label treatment as the
                             MultiStateBadge example: sync mode crossfades the
                             outgoing word down while the new one drops in. -->
                        <AnimatePresence mode="sync" initial={false}>
                            <!-- The {#key} block is load-bearing: it mounts a
                                 NEW element per label so the outgoing one
                                 stays alive to exit while the incoming one
                                 enters. Without it Svelte reuses the node —
                                 the text swaps instantly, then exit+enter run
                                 back-to-back on the same element. -->
                            {#key stateLabel}
                                <motion.div
                                    key={stateLabel}
                                    class="state-label"
                                    initial={{ y: -10, opacity: 0, filter: 'blur(6px)' }}
                                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                    exit={{ y: 10, opacity: 0, filter: 'blur(6px)' }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                >
                                    {stateLabel}
                                </motion.div>
                            {/key}
                        </AnimatePresence>
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
                <input id="wave-amp" type="range" min="0" max="60" step="1" bind:value={waveAmp} />
            </div>
            <div class="control">
                <label for="swell-depth">
                    Swell
                    <output>±{Math.round(swellDepth * 100)}%</output>
                </label>
                <input
                    id="swell-depth"
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
                    type="range"
                    min="0.2"
                    max="1.4"
                    step="0.05"
                    bind:value={brightness}
                />
            </div>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        /* Light theme by default; overridden under `html.dark` below. The
           stage follows the docs theme too. `mix-blend-mode: screen` only
           reads on a dark canvas, so light mode switches the bloom/haze rings
           to normal blending (--ring-blend) and damps them slightly
           (--ring-damp, a CSS opacity() appended to the rings' existing
           filter chains — the MotionValue opacity channel stays untouched). */
        --demo-bg: #f1f5f9;
        --demo-ink: #0f172a;
        --demo-ink-soft: #475569;
        --demo-border: #cbd5e1;
        --demo-panel-bg: #ffffff;
        --demo-accent: #7c3aed;

        --stage-ink: #16161e;
        --stage-ink-soft: #64646e;
        --card-bg: linear-gradient(180deg, #ffffff, #f2f3f7);
        --card-hairline: rgba(0, 0, 0, 0.1);
        --card-hairline-hover: rgba(0, 0, 0, 0.28);
        --state-active: #a21caf;
        --state-active-border: rgba(162, 28, 175, 0.35);
        --ring-blend: normal;
        --ring-damp: 0.75;

        /* Content-driven height: the card plus the stage's glow clearance —
           no viewport-derived minimum. docs-kit's dk-demo-shell base rule
           sets `flex: 1 1 auto` inside the column-flex example body, which
           would stretch us to the notes column's height; opt out and let the
           auto margins center the compact demo instead. */
        width: 100%;
        flex: 0 0 auto;
        margin: auto 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        /* No shell background: the card, glow and panel float directly on the
           page — a tinted band here reads as "the demo is in a box". */
        background: transparent;
        color: var(--demo-ink);
    }

    :global(html.dark) .dk-demo-shell {
        --demo-bg: #0d1518;
        --demo-ink: #ecfeff;
        --demo-ink-soft: #9fb9c4;
        --demo-border: #2b4650;
        --demo-panel-bg: #0f1c22;
        --demo-accent: #a78bfa;

        --stage-ink: #f5f5fa;
        --stage-ink-soft: #86868e;
        --card-bg: linear-gradient(180deg, #16161e, #101016);
        --card-hairline: rgba(255, 255, 255, 0.08);
        --card-hairline-hover: rgba(255, 255, 255, 0.32);
        --state-active: #f5b9ea;
        --state-active-border: rgba(245, 185, 234, 0.35);
        --ring-blend: screen;
        --ring-damp: 1;
    }

    /* Stage flexes; the tuning panel rides beside it as a fixed column. */
    .demo-body {
        display: flex;
        gap: 14px;
    }

    .stage {
        position: relative;
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        /* Fixed compact padding, NO overflow clip and NO paint containment:
           the glow is free to spill past the stage onto the shell background
           at any thickness. Scaling the padding with the slider instead kept
           reflowing the whole demo on every tick. */
        padding: 56px 24px;
        /* No border/background of its own: the card + glow float straight on
           the demo shell background. */
        color: var(--stage-ink);
        font-family:
            -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif;
    }

    .stage :global(.frame) {
        position: relative;
        width: min(480px, 100%);
        /* Optical centering: shade the card left so it doesn't read as
           crowding the slider panel. */
        margin-right: 16px;
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
       just the thin base band under it. Displace first, blur after. The
       trailing opacity() is the light-mode damp; the MotionValue still owns
       the element's own opacity channel. */
    .stage :global(.ring.bloom) {
        inset: calc(var(--t) * -1.5);
        border-radius: calc(28px + var(--t) * 1.5);
        /* Blur must stay well under the wave amplitude or it rounds the
           displaced contour smooth again. */
        filter: url(#aiWave) blur(calc(var(--t) * 2)) saturate(1.2) opacity(var(--ring-damp));
        will-change: filter;
        mix-blend-mode: var(--ring-blend);
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
        filter: blur(calc(var(--t) * 6)) opacity(var(--ring-damp));
        mix-blend-mode: var(--ring-blend);
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

    .stage :global(.rotor-pos) {
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
        background: var(--card-bg);
        border: none;
        border-radius: 28px;
        padding: 22px 24px;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        user-select: none;
    }

    /* Crisp 1px inner hairline — the sharp/soft contrast that sells depth.
       Brightens on hover as part of the click affordance. */
    .stage :global(.card)::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 28px;
        border: 1px solid var(--card-hairline);
        pointer-events: none;
        transition: border-color 0.25s;
    }

    .stage :global(.state-ghost) {
        visibility: hidden;
        white-space: nowrap;
    }

    .stage :global(.state-label) {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
    }

    .stage :global(.card:hover)::after {
        border-color: var(--card-hairline-hover);
    }

    .stage :global(.card:focus-visible) {
        outline: 2px solid var(--demo-accent);
        outline-offset: 4px;
    }

    .stage :global(.spark) {
        flex: none;
        width: 26px;
        height: 26px;
    }

    .stage :global(.prompt) {
        flex: 1;
        min-width: 0;
        display: block;
    }

    .stage :global(.prompt .ask) {
        display: block;
        font-size: 17px;
        font-weight: 500;
    }

    .stage :global(.prompt .hint) {
        display: block;
        margin-top: 3px;
        font-size: 12px;
        color: var(--stage-ink-soft);
    }

    .stage :global(.state) {
        flex: none;
        /* Wide enough for the longest state ("listening") from the start —
           the hover/toggle text swaps must not resize the pill and shove the
           card content around. */
        min-width: 8.5em;
        text-align: center;
        /* Presence stage: exiting labels go absolute and must stay centered
           in the pill while the incoming one drops in over them. */
        position: relative;
        display: inline-flex;
        justify-content: center;
        overflow: hidden;
        font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--stage-ink-soft);
        border: 1px solid var(--card-hairline);
        border-radius: 999px;
        padding: 5px 10px;
        transition:
            color 0.4s,
            border-color 0.4s;
    }

    .stage :global(.state.active) {
        color: var(--state-active);
        border-color: var(--state-active-border);
    }

    /* ---- Controls ---------------------------------------------------- */

    .controls {
        flex: none;
        width: 240px;
        /* Hug the five controls and sit vertically centered beside the stage,
           rather than stretching the demo's full height. */
        align-self: center;
        display: flex;
        flex-direction: column;
        gap: 18px;
        padding: 16px 20px;
        background: var(--demo-panel-bg);
        border: 1px solid var(--demo-border);
    }

    .control {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .controls label {
        display: flex;
        justify-content: space-between;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--demo-ink-soft);
    }

    .controls output {
        color: var(--demo-ink);
        font-variant-numeric: tabular-nums;
    }

    .controls input[type='range'] {
        width: 100%;
        accent-color: var(--demo-accent);
    }

    @media (max-width: 900px) {
        .dk-demo-shell {
            padding: 1rem;
        }

        .demo-body {
            flex-direction: column;
        }

        .stage {
            padding: 96px 16px;
        }

        .controls {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 14px 24px;
        }
    }
</style>
