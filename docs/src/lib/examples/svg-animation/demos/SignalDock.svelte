<script lang="ts">
    import { ArrowLeft, Radio, RotateCcw, Send } from '@lucide/svelte'
    import { motion, styleString, useReducedMotion } from '@humanspeak/svelte-motion'
    import { tick } from 'svelte'

    const reducedMotion = useReducedMotion()
    let docked = $state(false)
    let opacity = $state('1')
    let transform = $state('none')
    let fill = $state('rgb(36, 119, 104)')
    let packetElement = $state<HTMLElement>()

    const isDocked = $derived(docked)
    const duration = $derived(reducedMotion.current ? 0 : 0.9)

    /** Moves the vector packet to its marked destination and commits its final styles. */
    const launch = () => (docked = true)

    /** Restores the packet's exact source styles. */
    const reverse = () => (docked = false)

    /** Restarts the full signal sequence, including a fresh source frame. */
    const replay = async () => {
        docked = false
        await tick()
        requestAnimationFrame(launch)
    }

    /** Samples computed values to show the styles actually committed by the browser. */
    $effect(() => {
        let frame = 0
        const sample = () => {
            if (packetElement) {
                const computed = getComputedStyle(packetElement)
                opacity = computed.opacity
                transform = computed.transform
                fill = computed.fill
            }
            frame = requestAnimationFrame(sample)
        }
        sample()
        return () => cancelAnimationFrame(frame)
    })

    const buttonBase = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.45rem',
        padding: '0.55rem 0.85rem',
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: 'pointer'
    } as const
    const buttonStyle = styleString(() => ({
        ...buttonBase,
        backgroundColor: 'var(--brut-bg, #f8fcfb)',
        color: 'var(--brut-ink, #0a0a0a)'
    }))
    const primaryStyle = styleString(() => ({
        ...buttonBase,
        borderColor: 'var(--brut-accent, #247768)',
        backgroundColor: 'var(--brut-accent, #247768)',
        color: 'var(--brut-accent-ink, #f8fcfb)'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell - stripped from the published code. -->
<div class="dk-demo-shell">
    <header class="masthead">
        <div>
            <span class="eyebrow">vector relay / motion 13</span>
            <h3>Final styles, actually committed.</h3>
        </div>
        <div class="status" class:online={isDocked}>
            <Radio size={14} />
            {isDocked ? 'packet docked' : 'uplink ready'}
        </div>
    </header>

    <div class="stage">
        <div class="grid" aria-hidden="true"></div>
        <svg viewBox="0 0 760 280" role="img" aria-label="A luminous signal packet docking">
            <defs>
                <filter id="signal-bloom" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="10" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <linearGradient id="signal-rail" x1="0" x2="1">
                    <stop offset="0" stop-color="#247768" stop-opacity="0.15" />
                    <stop offset="0.72" stop-color="#247768" />
                    <stop offset="1" stop-color="#a855f7" />
                </linearGradient>
            </defs>

            <path d="M 92 140 H 655" class="rail" />
            <path d="M 92 140 H 655" class="rail-live" />
            <g class="source-marker">
                <circle cx="92" cy="140" r="31" />
                <text x="92" y="198">SOURCE / 00</text>
            </g>
            <g class="dock-marker">
                <circle cx="655" cy="140" r="39" />
                <circle cx="655" cy="140" r="29" />
                <text x="655" y="198">DOCK / 01</text>
            </g>

            <motion.circle
                class="arrival-bloom"
                cx={655}
                cy={140}
                r={46}
                initial={false}
                animate={{ opacity: isDocked ? 0.8 : 0, scale: isDocked ? 1.15 : 0.35 }}
                transition={{
                    duration: reducedMotion.current ? 0 : 0.45,
                    delay: isDocked ? duration : 0
                }}
            />
            <motion.g
                bind:ref={packetElement}
                data-signal-packet
                data-testid="signal-packet"
                initial={false}
                animate={{
                    opacity: isDocked ? 0 : 1,
                    transform: isDocked ? 'translateX(563px)' : 'translateX(0px)',
                    fill: isDocked ? '#a855f7' : '#247768'
                }}
                transition={{
                    duration,
                    ease: [0.22, 1, 0.36, 1],
                    opacity: {
                        duration: reducedMotion.current ? 0 : 0.2,
                        delay: isDocked ? duration : 0
                    },
                    fill: { duration: reducedMotion.current ? 0 : 0.35 }
                }}
            >
                <circle cx="92" cy="140" r="17" class="packet-halo" />
                <path d="M82 132 L106 140 L82 148 Z" class="packet-core" />
            </motion.g>
        </svg>

        <div class="telemetry" aria-live="polite">
            <div><span>opacity</span><strong data-testid="signal-opacity">{opacity}</strong></div>
            <div>
                <span>transform</span><strong data-testid="signal-transform">{transform}</strong>
            </div>
            <div><span>fill</span><strong data-testid="signal-fill">{fill}</strong></div>
            <div><span>commit</span><strong>{isDocked ? 'FINAL' : 'SOURCE'}</strong></div>
        </div>
    </div>

    <div class="controls" role="toolbar" aria-label="Signal controls">
        <motion.button
            style={primaryStyle}
            onclick={launch}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
        >
            <Send size={15} /> Launch signal
        </motion.button>
        <motion.button
            style={buttonStyle}
            onclick={reverse}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
        >
            <ArrowLeft size={15} /> Reverse
        </motion.button>
        <motion.button
            style={buttonStyle}
            onclick={replay}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
        >
            <RotateCcw size={15} /> Replay
        </motion.button>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        min-height: clamp(480px, calc(100vh - 220px), 650px);
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px;
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
    }
    .masthead {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        border-bottom: 1px solid var(--brut-rule-2, #bbc4c0);
        padding-bottom: 12px;
    }
    .masthead h3 {
        margin: 3px 0 0;
        font-size: clamp(20px, 3vw, 32px);
        line-height: 1;
        letter-spacing: -0.04em;
    }
    .eyebrow,
    .status,
    .telemetry span {
        font-family: var(--brut-mono, monospace);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }
    .eyebrow {
        color: var(--brut-accent, #247768);
    }
    .status {
        display: flex;
        align-items: center;
        gap: 6px;
        white-space: nowrap;
        color: var(--brut-ink-2, #525252);
    }
    .status.online {
        color: #a855f7;
    }
    .stage {
        position: relative;
        flex: 1;
        min-height: 360px;
        overflow: hidden;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: #07110f;
        box-shadow: 7px 7px 0 var(--brut-rule, #d6dedb);
    }
    .grid {
        position: absolute;
        inset: 0;
        opacity: 0.18;
        background-image:
            linear-gradient(#54dbbc 1px, transparent 1px),
            linear-gradient(90deg, #54dbbc 1px, transparent 1px);
        background-size: 32px 32px;
        mask-image: linear-gradient(to bottom, #000, transparent);
    }
    svg {
        position: relative;
        z-index: 1;
        display: block;
        width: 100%;
        height: auto;
        min-height: 280px;
    }
    .rail {
        fill: none;
        stroke: #24413b;
        stroke-width: 2;
        stroke-dasharray: 4 9;
    }
    .rail-live {
        fill: none;
        stroke: url(#signal-rail);
        stroke-width: 3;
        opacity: 0.8;
    }
    .source-marker circle,
    .dock-marker circle {
        fill: none;
        stroke: #54dbbc;
        stroke-width: 1;
        stroke-dasharray: 5 6;
        opacity: 0.65;
    }
    .dock-marker circle:first-child {
        stroke: #a855f7;
        animation: orbit 8s linear infinite;
        transform-origin: 655px 140px;
    }
    text {
        fill: #8ca59f;
        font-family: var(--brut-mono, monospace);
        font-size: 10px;
        letter-spacing: 0.12em;
        text-anchor: middle;
    }
    .dk-demo-shell :global(.packet-halo) {
        fill: inherit;
        opacity: 0.28;
        filter: url(#signal-bloom);
    }
    .dk-demo-shell :global(.packet-core) {
        fill: inherit;
        filter: url(#signal-bloom);
    }
    .dk-demo-shell :global(.arrival-bloom) {
        fill: #a855f7;
        filter: url(#signal-bloom);
        transform-origin: 655px 140px;
    }
    .telemetry {
        position: absolute;
        z-index: 2;
        right: 14px;
        bottom: 14px;
        left: 14px;
        display: grid;
        grid-template-columns: 0.7fr 1.5fr 1fr 0.7fr;
        border: 1px solid #31534c;
        background: rgba(4, 14, 12, 0.88);
        backdrop-filter: blur(8px);
    }
    .telemetry div {
        min-width: 0;
        padding: 10px 12px;
        border-right: 1px solid #31534c;
    }
    .telemetry div:last-child {
        border: 0;
    }
    .telemetry span {
        display: block;
        margin-bottom: 5px;
        color: #68837d;
    }
    .telemetry strong {
        display: block;
        overflow: hidden;
        color: #d6fff6;
        font-family: var(--brut-mono, monospace);
        font-size: 11px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    @keyframes orbit {
        to {
            transform: rotate(360deg);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .dock-marker circle:first-child {
            animation: none;
        }
    }
    @media (max-width: 640px) {
        .dk-demo-shell {
            padding: 12px;
        }
        .masthead {
            align-items: flex-start;
            flex-direction: column;
        }
        .telemetry {
            grid-template-columns: 1fr 1fr;
        }
        .telemetry div:nth-child(2) {
            border-right: 0;
        }
        .telemetry div:nth-child(-n + 2) {
            border-bottom: 1px solid #31534c;
        }
    }
</style>
