<script lang="ts">
    import { motion, type Variants } from '$lib'

    type VariantState = 'rest' | 'play'

    const cells = Array.from({ length: 12 }, (_, i) => i)
    const count = cells.length
    const variants: Variants = {
        rest: { y: 0, scale: 1, rotate: 0 },
        play: { y: -48, scale: 1.08, rotate: -3 }
    }

    let variantState = $state<VariantState>('rest')
    let staggerMs = $state(80)
    let forward = $state(true)

    const delayFor = (i: number) =>
        variantState === 'play' ? ((forward ? i : count - 1 - i) * staggerMs) / 1000 : 0
</script>

<svelte:head>
    <title>Variants — stagger interrupt</title>
</svelte:head>

<div class="page" data-testid="variants-stagger-interrupt-page">
    <header>
        <p class="eyebrow">Variants regression harness</p>
        <h1>Staggered play should stop cleanly.</h1>
        <p>
            Play uses per-child delay to mimic the homepage variants lab. Stop returns every cell to <code
                >rest</code
            > without its own delay, so interrupted cells should not keep popping up after the stop command.
        </p>
    </header>

    <section class="controls" aria-label="Controls">
        <button type="button" data-testid="play" onclick={() => (variantState = 'play')}
            >play</button
        >
        <button type="button" data-testid="stop" onclick={() => (variantState = 'rest')}
            >stop</button
        >
        <button
            type="button"
            data-testid="toggle"
            onclick={() => (variantState = variantState === 'play' ? 'rest' : 'play')}
        >
            toggle
        </button>
        <button type="button" data-testid="direction" onclick={() => (forward = !forward)}>
            direction {forward ? '01 -> 12' : '12 -> 01'}
        </button>
        <label>
            stagger
            <input
                type="range"
                min="0"
                max="200"
                step="10"
                bind:value={staggerMs}
                data-testid="stagger"
            />
            <span data-testid="stagger-readout">{staggerMs}ms</span>
        </label>
    </section>

    <section class="readout" aria-label="Readout">
        <div>
            <span>state</span>
            <strong data-testid="state">{variantState}</strong>
        </div>
        <div>
            <span>direction</span>
            <strong data-testid="direction-readout">{forward ? 'forward' : 'reverse'}</strong>
        </div>
    </section>

    <section class="stage" data-testid="stage">
        <div class="grid">
            {#each cells as i (i)}
                <motion.div
                    class="cell"
                    {variants}
                    initial="rest"
                    animate={variantState}
                    transition={{
                        type: 'spring',
                        stiffness: 360,
                        damping: 22,
                        delay: delayFor(i)
                    }}
                    data-testid="variant-cell"
                    data-index={i}
                    data-state={variantState}
                    data-delay={delayFor(i)}
                >
                    {String(i + 1).padStart(2, '0')}
                </motion.div>
            {/each}
        </div>
    </section>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 2rem;
        background: #050807;
        color: #f5f5f5;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    header {
        max-width: 760px;
    }
    .eyebrow {
        margin: 0 0 0.5rem;
        color: #5eead4;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.75rem;
    }
    h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 4rem);
        line-height: 1;
        letter-spacing: -0.06em;
    }
    p {
        color: #a7adab;
        line-height: 1.55;
    }
    code {
        color: #5eead4;
    }
    .controls,
    .readout {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
        margin-top: 1.5rem;
    }
    button,
    label,
    .readout > div {
        display: inline-flex;
        align-items: center;
        gap: 0.55rem;
        min-height: 2.5rem;
        border: 1px solid #26302d;
        background: #0d1210;
        color: #f5f5f5;
        padding: 0 0.85rem;
        font: inherit;
    }
    button {
        cursor: pointer;
    }
    button:hover {
        border-color: #5eead4;
    }
    label,
    .readout span {
        color: #777f7c;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.75rem;
    }
    .readout strong {
        color: #5eead4;
    }
    .stage {
        margin-top: 2rem;
        border: 1px solid #26302d;
        background:
            linear-gradient(#141a18 1px, transparent 1px),
            linear-gradient(90deg, #141a18 1px, transparent 1px);
        background-size: 32px 32px;
        padding: 2rem;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(72px, 1fr));
        gap: 0.75rem;
    }
    :global(.cell) {
        aspect-ratio: 1 / 1;
        display: grid;
        place-items: center;
        border: 1px solid #26302d;
        background: #0d1210;
        color: #a7adab;
        will-change: transform;
    }
    @media (max-width: 720px) {
        .grid {
            grid-template-columns: repeat(3, minmax(72px, 1fr));
        }
    }
</style>
