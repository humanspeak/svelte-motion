<script lang="ts">
    import { animate, motion, useMotionTemplate, useMotionValue, useTransform } from '$lib'

    const x = useMotionValue(24)
    const opacity = useTransform(x, [24, 168], [0.58, 1])
    const scale = useTransform(x, [24, 168], [0.92, 1.08])
    const glowX = useMotionTemplate`${x}px`
    const shadowAlpha = useTransform(x, [24, 168], [0.18, 0.46])
    const shadow = useMotionTemplate`0 26px 90px rgba(56, 189, 248, ${shadowAlpha})`

    let moved = $state(false)

    async function toggle() {
        moved = !moved
        await animate(x, moved ? 168 : 24, {
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1]
        })
    }

    function reset() {
        moved = false
        x.jump(24)
    }
</script>

<svelte:head>
    <title>Object style MotionValues</title>
</svelte:head>

<main>
    <section class="intro">
        <p class="kicker">Object style MotionValues (#317)</p>
        <h1>MotionValues can live directly in style objects.</h1>
        <p>
            The card uses <code
                >style=&#123;&#123; x, opacity, scale, '--glow-x': glowX &#125;&#125;</code
            >
            without <code>styleString</code>. MotionValue entries update the inline style through
            <code>motion-dom</code>'s style effect.
        </p>
    </section>

    <section class="stage" data-testid="object-style-stage">
        <div class="rail">
            <motion.div
                class="card"
                data-testid="object-style-card"
                style={{
                    x,
                    opacity,
                    scale,
                    '--glow-x': glowX,
                    boxShadow: shadow,
                    width: 172,
                    height: 112,
                    borderRadius: 18,
                    backgroundColor: '#123244'
                }}
            >
                <span>live style</span>
            </motion.div>
        </div>

        <div class="controls">
            <button type="button" data-testid="object-style-toggle" onclick={toggle}>
                {moved ? 'Move back' : 'Move right'}
            </button>
            <button type="button" data-testid="object-style-reset" onclick={reset}>Reset</button>
        </div>
    </section>
</main>

<style>
    :global(html),
    :global(body) {
        min-height: 100%;
        height: auto;
        margin: 0;
        overflow-y: auto;
        background: #071012;
        color: #ecfdf5;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    :global(body > .h-full),
    :global(body > .h-full > .h-full),
    :global(.container),
    :global(#sandbox) {
        min-height: 100vh;
        height: auto;
    }

    main {
        min-height: 100vh;
        width: min(920px, calc(100vw - 32px));
        display: grid;
        align-content: center;
        gap: 28px;
        margin: 0 auto;
        padding: 48px 0;
    }

    .intro {
        max-width: 720px;
    }

    .kicker {
        margin: 0 0 8px;
        color: #67e8f9;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: clamp(32px, 5vw, 58px);
        line-height: 0.95;
        letter-spacing: 0;
    }

    .intro p:not(.kicker) {
        margin: 14px 0 0;
        color: #a7c7c9;
        font-size: 16px;
        line-height: 1.65;
    }

    code {
        color: #f0abfc;
    }

    .stage {
        display: grid;
        gap: 22px;
        padding: 28px;
        border: 1px solid rgba(103, 232, 249, 0.28);
        background:
            linear-gradient(90deg, rgba(103, 232, 249, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(103, 232, 249, 0.1) 1px, transparent 1px), #0b171a;
        background-size: 42px 42px;
    }

    .rail {
        position: relative;
        height: 220px;
        border: 1px solid rgba(103, 232, 249, 0.22);
        background:
            radial-gradient(
                circle at var(--glow-x, 24px) 50%,
                rgba(56, 189, 248, 0.28),
                transparent 34%
            ),
            rgba(5, 12, 15, 0.62);
        overflow: hidden;
    }

    :global(.card) {
        position: absolute;
        top: 54px;
        left: 0;
        display: grid;
        place-items: center;
        border: 1px solid rgba(186, 230, 253, 0.42);
        color: #e0f2fe;
        font-size: 18px;
        font-weight: 850;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        transform-origin: 50% 50%;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
    }

    button {
        min-width: 126px;
        border: 1px solid rgba(125, 211, 252, 0.45);
        border-radius: 6px;
        background: #102332;
        color: #ecfeff;
        padding: 10px 14px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
    }

    button:hover {
        border-color: #67e8f9;
        background: #153247;
    }
</style>
