<script lang="ts">
    import { animate, useReducedMotion } from '@humanspeak/svelte-motion'

    const reduced = useReducedMotion()
    const route =
        'M 50 160 C 50 50 160 50 160 120 S 270 240 270 130 S 390 40 390 140 S 490 240 510 130'
    let stroke = $state<SVGPathElement | null>(null)
    let glow = $state<SVGPathElement | null>(null)
    let start = $state(0)
    let end = $state(65)
    let animation: ReturnType<typeof animate> | undefined

    /** Animate CSS variables on the SVG itself, preserving the current origin. */
    const setRange = (from: number, to: number, duration = 0.65) => {
        if (!stroke || !glow) return
        animation?.stop()
        start = from
        end = to
        animation = animate(
            [stroke, glow],
            { '--trim-start': from / 100, '--trim-end': to / 100 },
            { duration: reduced.current ? 0 : duration, ease: 'easeInOut' }
        )
    }

    /** Draw, erase from the tail, and return using Motion's sequence API. */
    const replay = () => {
        if (!stroke || !glow) return
        if (reduced.current) {
            setRange(0, 65, 0)
            return
        }
        animation?.stop()
        start = 0
        end = 65
        const paths = [stroke, glow]
        animation = animate([
            [paths, { '--trim-start': 0, '--trim-end': 0 }, { duration: 0 }],
            [paths, { '--trim-end': 1 }, { duration: 1.3, ease: 'easeInOut' }],
            [paths, { '--trim-start': 1 }, { duration: 1, ease: 'easeInOut' }],
            [paths, { '--trim-start': 0, '--trim-end': 0.65 }, { duration: 0.9, ease: 'easeInOut' }]
        ])
    }

    $effect(() => () => animation?.stop())
</script>

<!-- dk-strip: positioning shell, omitted from the copyable example. -->
<div class="dk-demo-shell">
    <div class="playground">
        <div class="heading">
            <span>light on a line</span>
            <span>SVG / CSS VARIABLES</span>
        </div>
        <div class="stage">
            <svg
                viewBox="0 0 560 280"
                role="img"
                aria-label="A glowing winding path with an adjustable visible segment"
            >
                <path class="rail" d={route} fill="none" stroke-width="2" />
                <path
                    bind:this={glow}
                    class="trim glow"
                    d={route}
                    pathLength="1"
                    fill="none"
                    stroke="#5eead4"
                    stroke-width="16"
                    style="--trim-start: 0; --trim-end: 0.65;"
                />
                <path
                    bind:this={stroke}
                    class="trim"
                    d={route}
                    pathLength="1"
                    fill="none"
                    stroke="#99f6e4"
                    stroke-width="4"
                    style="--trim-start: 0; --trim-end: 0.65;"
                />
                <circle cx="50" cy="160" r="3" fill="#607779" />
                <circle cx="510" cy="130" r="3" fill="#607779" />
                <text x="50" y="198">IN</text>
                <text x="502" y="168">OUT</text>
            </svg>
            <div class="caption">draw a little. leave a little.</div>
        </div>
        <div class="sliders">
            <label>
                <span>Start <output>{start}%</output></span>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={start}
                    aria-label="Trim start"
                    oninput={(event) =>
                        setRange(
                            Number(event.currentTarget.value),
                            Math.max(Number(event.currentTarget.value), end),
                            0.15
                        )}
                />
            </label>
            <label>
                <span>End <output>{end}%</output></span>
                <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={end}
                    aria-label="Trim end"
                    oninput={(event) =>
                        setRange(
                            Math.min(start, Number(event.currentTarget.value)),
                            Number(event.currentTarget.value),
                            0.15
                        )}
                />
            </label>
        </div>
        <div class="toolbar">
            <button type="button" onclick={() => setRange(0, 100)}>Draw</button>
            <button type="button" onclick={() => setRange(0, 0)}>Erase</button>
            <button type="button" onclick={replay}>Replay</button>
            <button type="button" onclick={() => setRange(0, 65, 0)}>Reset</button>
        </div>
        <p class="hint">
            {reduced.current
                ? 'Reduced motion: changes apply immediately.'
                : 'Scrub either end, or replay the complete draw-and-erase sequence.'}
        </p>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        padding: clamp(1rem, 4vw, 2rem);
    }
    .playground {
        max-width: 660px;
        margin: auto;
    }
    .heading {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.8rem;
        font: 10px var(--brut-mono, monospace);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #747b79);
    }
    .stage {
        position: relative;
        overflow: hidden;
        border: 1px solid #293b3b;
        border-radius: 16px;
        background: radial-gradient(ellipse at 50% 50%, #142f34, #0d171d 75%);
    }
    svg {
        display: block;
        width: 100%;
        height: auto;
        min-height: 240px;
    }
    .rail {
        stroke: #2d494c;
    }
    .trim {
        /* SVG calc() must resolve to a length; unitless results fail in Firefox. */
        stroke-dasharray: calc((var(--trim-end) - var(--trim-start)) * 1px) 1px;
        stroke-dashoffset: calc(var(--trim-start) * -1px);
        stroke-linecap: butt;
    }
    .glow {
        filter: blur(9px);
        opacity: 0.7;
    }
    text {
        fill: #789497;
        font: 9px monospace;
        letter-spacing: 0.12em;
    }
    .caption {
        padding: 0 1rem 1.3rem;
        text-align: center;
        font: 10px var(--brut-mono, monospace);
        letter-spacing: 0.12em;
        color: #789497;
    }
    .sliders {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        margin: 1.2rem 0;
    }
    label span {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.5rem;
        color: var(--brut-ink-2, #555e5a);
        font: 11px var(--brut-mono, monospace);
    }
    output {
        font-variant-numeric: tabular-nums;
    }
    input {
        display: block;
        width: 100%;
        accent-color: var(--brut-accent, #247768);
    }
    .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }
    button {
        flex: 1;
        padding: 0.6rem 0.9rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
        font: 11px var(--brut-mono, monospace);
        cursor: pointer;
    }
    button:first-child {
        color: var(--brut-accent-ink, #f8fcfb);
        background: var(--brut-accent, #247768);
        border-color: var(--brut-accent, #247768);
    }
    button:focus-visible,
    input:focus-visible {
        outline: 2px solid var(--brut-accent, #247768);
        outline-offset: 4px;
    }
    .hint {
        margin: 0.9rem 0 0;
        color: var(--brut-ink-3, #747b79);
        font-size: 12px;
    }
    @media (max-width: 480px) {
        .sliders {
            gap: 1rem;
        }
    }
</style>
