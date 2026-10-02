<script lang="ts">
    import { motion, type Variants } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Ports Motion 13.5.1's `inherit={false}` tests (upstream commit b63833cb0,
     * `variant.test.tsx`). Each scenario's target element has a static
     * `style={{ opacity: 0.5 }}` and variants `a: 0.2` / `b: 0.8`. When it
     * opts out of inheritance it must stay at 0.5 no matter what the outer
     * parent does. The control scenario inherits normally and tracks its parent.
     *
     * The `data-testid`s are what `e2e/variants/inherit-false.spec.ts` drives;
     * keep them stable.
     */
    type Label = 'a' | 'b'
    let control = $state<Label>('a')
    let one = $state<Label>('a')
    let two = $state<Label>('a')
    let three = $state<Label>('a')
    let hovering = $state(false)

    const variants: Variants = { a: { opacity: 0.2 }, b: { opacity: 0.8 } }
    const hoverVariants: Variants = { rest: { opacity: 0.2 }, hover: { opacity: 0.8 } }
    const transition = { type: false } as const

    const flip = (label: Label): Label => (label === 'a' ? 'b' : 'a')
    const setAll = (label: Label) => {
        control = one = two = three = label
    }

    // ---- Live readouts (tester only; never under `@isPlaywright=true`) ----
    const TARGETS = ['child-control', 'child-1', 'grandchild-2', 'grandchild-3', 'child-4'] as const
    type Target = (typeof TARGETS)[number]
    let isTester = $state(false)
    let readings = $state<Partial<Record<Target, number>>>({})

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return
        isTester = true
        const timer = setInterval(() => {
            const next: Partial<Record<Target, number>> = {}
            for (const id of TARGETS) {
                const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
                if (el) next[id] = Number.parseFloat(getComputedStyle(el).opacity)
            }
            readings = next
        }, 100)
        return () => clearInterval(timer)
    })

    /** What each target should read right now. */
    const expected = $derived<Record<Target, number>>({
        'child-control': control === 'a' ? 0.2 : 0.8,
        'child-1': 0.5,
        'grandchild-2': 0.5,
        'grandchild-3': 0.5,
        'child-4': 0.5
    })
    const isOk = (id: Target) =>
        readings[id] !== undefined && Math.abs((readings[id] as number) - expected[id]) < 0.02
    const failures = $derived(isTester ? TARGETS.filter((id) => !isOk(id)).length : 0)

    const steps: TesterStep[] = [
        {
            text: 'Press "Switch parent" on the Control card a few times.',
            expected:
                'The parent badge flips "a" (grey) / "b" (indigo) and the child follows: faint at 0.20, solid at 0.80. Chip stays ✓.'
        },
        {
            text: 'On cards 1, 2 and 3, press "Switch parent" back and forth (or use "Switch all parents").',
            expected:
                'The italic "reference · follows parent" block flips faint/solid on every click, which proves the button works. The inherit={false} child or grandchild below it never changes (mid-tone 0.50, chip ✓).'
        },
        {
            text: 'Move the mouse over the indigo-outlined box in card 4.',
            expected:
                'The badge shows "hover" and the reference block brightens. The inherit={false} child stays at 0.50 (✓).'
        }
    ]
</script>

<svelte:head>
    <title>Variants — inherit={false}</title>
</svelte:head>

<main class="page">
    <header class="intro">
        <p class="kicker">Variants · inherit={'{false}'}</p>
        <h1>Opt an element out of its parent's variants.</h1>
        <p class="lede">
            Every parent below switches between variant <code>a</code> (0.2 opacity) and
            <code>b</code> (0.8 opacity). Only the <strong>Control</strong> child is allowed to
            follow. Every element marked <code>inherit={'{false}'}</code> must stay at its own 0.5.
        </p>
        <div class="legend" aria-label="Opacity reference">
            <span class="legend-title">Reference:</span>
            {#each [0.2, 0.5, 0.8] as level (level)}
                <span class="swatch-wrap">
                    <span class="swatch-frame"
                        ><span class="swatch" style="opacity: {level}"></span></span
                    >
                    {level.toFixed(1)}
                </span>
            {/each}
        </div>
        <div class="global-controls">
            <button type="button" class="primary" onclick={() => setAll(flip(control))}>
                Switch all parents to "{flip(control)}"
            </button>
            <button type="button" onclick={() => setAll('a')}>Reset all to "a"</button>
        </div>
    </header>

    <section class="grid">
        <article class="card control">
            <h2>Control <span class="tag">inherits</span></h2>
            <p class="expect">Follows the parent: 0.20 on "a", 0.80 on "b".</p>
            <button
                type="button"
                data-testid="switch-control"
                onclick={() => (control = flip(control))}
            >
                Switch parent to "{flip(control)}"
            </button>
            <motion.div animate={control} initial="a" data-testid="parent-control" class="parent">
                <span class="parent-label"
                    >parent <b class="badge" class:b={control === 'b'}>"{control}"</b></span
                >
                <motion.div
                    data-testid="child-control"
                    {variants}
                    {transition}
                    style="opacity: 0.5"
                >
                    child
                </motion.div>
            </motion.div>
            {@render readout('child-control')}
        </article>

        <article class="card">
            <h2>1 · Child opts out</h2>
            <p class="expect">
                Each click flips the <b>reference</b>; the <code>inherit={'{false}'}</code> child stays
                at 0.50.
            </p>
            <button type="button" data-testid="switch-1" onclick={() => (one = flip(one))}>
                Switch parent to "{flip(one)}"
            </button>
            <motion.div animate={one} initial="a" data-testid="parent-1" class="parent">
                <span class="parent-label"
                    >parent <b class="badge" class:b={one === 'b'}>"{one}"</b></span
                >
                <motion.div class="ref block" {variants} {transition} style="opacity: 0.5">
                    reference · follows parent
                </motion.div>
                <motion.div
                    inherit={false}
                    data-testid="child-1"
                    {variants}
                    {transition}
                    style="opacity: 0.5"
                >
                    child · inherit={'{false}'}
                </motion.div>
            </motion.div>
            {@render readout('child-1')}
        </article>

        <article class="card">
            <h2>2 · Middle node opts out (has variants)</h2>
            <p class="expect">
                Each click flips the <b>reference</b>; the grandchild stays at 0.50.
            </p>
            <button type="button" data-testid="switch-2" onclick={() => (two = flip(two))}>
                Switch parent to "{flip(two)}"
            </button>
            <motion.div animate={two} initial="a" data-testid="parent-2" class="parent">
                <span class="parent-label"
                    >parent <b class="badge" class:b={two === 'b'}>"{two}"</b></span
                >
                <motion.div class="ref block" {variants} {transition} style="opacity: 0.5">
                    reference · follows parent
                </motion.div>
                <motion.div inherit={false} variants={{}} class="middle">
                    <span class="parent-label">middle · inherit={'{false}'}</span>
                    <motion.div
                        data-testid="grandchild-2"
                        {variants}
                        {transition}
                        style="opacity: 0.5"
                    >
                        grandchild
                    </motion.div>
                </motion.div>
            </motion.div>
            {@render readout('grandchild-2')}
        </article>

        <article class="card">
            <h2>3 · Plain middle node opts out</h2>
            <p class="expect">
                Each click flips the <b>reference</b>; the grandchild stays at 0.50.
            </p>
            <button type="button" data-testid="switch-3" onclick={() => (three = flip(three))}>
                Switch parent to "{flip(three)}"
            </button>
            <motion.div animate={three} initial="a" data-testid="parent-3" class="parent">
                <span class="parent-label"
                    >parent <b class="badge" class:b={three === 'b'}>"{three}"</b></span
                >
                <motion.div class="ref block" {variants} {transition} style="opacity: 0.5">
                    reference · follows parent
                </motion.div>
                <motion.div inherit={false} class="middle">
                    <span class="parent-label">middle · inherit={'{false}'} (no variants)</span>
                    <motion.div
                        data-testid="grandchild-3"
                        {variants}
                        {transition}
                        style="opacity: 0.5"
                    >
                        grandchild
                    </motion.div>
                </motion.div>
            </motion.div>
            {@render readout('grandchild-3')}
        </article>

        <article class="card">
            <h2>4 · Child ignores parent gestures</h2>
            <p class="expect">
                Hover the outlined box: the <b>reference</b> brightens; the
                <code>inherit={'{false}'}</code> child stays at 0.50.
            </p>
            <motion.div
                animate="rest"
                whileHover="hover"
                data-testid="parent-4"
                class="parent hover-box"
                onHoverStart={() => (hovering = true)}
                onHoverEnd={() => (hovering = false)}
            >
                <span class="parent-label"
                    >parent <b class="badge" class:b={hovering}>{hovering ? '"hover"' : '"rest"'}</b
                    >{hovering ? '' : ' — hover me'}</span
                >
                <motion.div
                    class="ref block"
                    variants={hoverVariants}
                    {transition}
                    style="opacity: 0.5"
                >
                    reference · follows parent
                </motion.div>
                <motion.div
                    inherit={false}
                    data-testid="child-4"
                    variants={hoverVariants}
                    {transition}
                    style="opacity: 0.5"
                >
                    child · inherit={'{false}'}
                </motion.div>
            </motion.div>
            {@render readout('child-4')}
        </article>
    </section>
</main>

{#snippet readout(id: Target)}
    {#if isTester}
        <p class="readout">
            opacity <strong>{readings[id]?.toFixed(2) ?? '–'}</strong>
            · expected {expected[id].toFixed(2)}
            <span class="chip" class:ok={isOk(id)} class:bad={!isOk(id)}
                >{isOk(id) ? '✓' : '✗'}</span
            >
        </p>
    {/if}
{/snippet}

<TesterPanel
    eyebrow="Variants · inherit={false} (Motion 13.5.1)"
    title="Only the control child may follow its parent"
    status="Expected to pass on this build: every chip ✓, before and after switching or hovering."
    {steps}
>
    {#snippet summary()}
        {#if failures === 0}
            <span class="verdict ok">ALL ✓</span>
        {:else}
            <span class="verdict bad">{failures} ✗</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            A motion element normally inherits its parent's variant label: when the parent switches
            to "b", every child with a "b" variant animates too. <code>inherit={'{false}'}</code> opts
            an element (and everything inside it) out of that.
        </p>
        <p>
            Each card's highlighted element has its own fixed 0.5 opacity. Only the Control child
            should ever change.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        padding: 2rem;
        max-width: 72rem;
        font-family: system-ui, sans-serif;
    }
    .kicker {
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #64748b;
    }
    h1 {
        font-size: 1.6rem;
        font-weight: 700;
        margin: 0.25rem 0 0.5rem;
    }
    .lede {
        max-width: 48rem;
        color: #334155;
    }
    .global-controls {
        display: flex;
        gap: 0.5rem;
        margin: 1rem 0 1.5rem;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
        gap: 1rem;
    }
    .card {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        padding: 1rem;
        border: 1px solid #e2e8f0;
        border-radius: 0.75rem;
        background: white;
    }
    .card.control {
        border-color: #a5b4fc;
        background: #f5f7ff;
    }
    h2 {
        font-size: 0.95rem;
        font-weight: 600;
    }
    .tag {
        font-size: 0.7rem;
        font-weight: 600;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        background: #e0e7ff;
        color: #3730a3;
    }
    .expect {
        font-size: 0.8rem;
        color: #475569;
    }
    button {
        align-self: flex-start;
        border: 1px solid #cbd5e1;
        border-radius: 0.5rem;
        background: #f8fafc;
        padding: 0.35rem 0.8rem;
        font-size: 0.85rem;
        cursor: pointer;
    }
    button:hover {
        background: #eef2ff;
    }
    button.primary {
        background: #4f46e5;
        border-color: #4f46e5;
        color: white;
    }
    button.primary:hover {
        background: #4338ca;
    }
    /* Checkerboard behind the blocks so translucency is obvious at a glance. */
    :global(.parent),
    .swatch-frame {
        --checker: conic-gradient(#cbd5e1 25%, #ffffff 0 50%, #cbd5e1 0 75%, #ffffff 0) 0 0 / 14px
            14px;
    }
    :global(.parent),
    :global(.middle) {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.6rem;
        border: 1.5px dashed #94a3b8;
        border-radius: 0.6rem;
    }
    :global(.parent) {
        background: var(--checker);
    }
    :global(.middle) {
        border-color: #f59e0b;
        background: rgba(255, 255, 255, 0.55);
    }
    :global(.hover-box) {
        cursor: pointer;
        border-color: #6366f1;
    }
    :global(.hover-box:hover) {
        outline: 3px solid #a5b4fc;
    }
    .legend {
        display: flex;
        align-items: center;
        gap: 0.9rem;
        margin-top: 0.75rem;
        font-size: 0.8rem;
        color: #475569;
    }
    .legend-title {
        font-weight: 600;
    }
    .swatch-wrap {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-family: ui-monospace, monospace;
    }
    .swatch-frame {
        display: inline-flex;
        padding: 3px;
        border-radius: 0.4rem;
        background: var(--checker);
        box-shadow: 0 0 0 1px #cbd5e1;
    }
    .swatch {
        display: inline-block;
        width: 2.25rem;
        height: 1.25rem;
        border-radius: 0.3rem;
        background: #3730a3;
    }
    .parent-label {
        font-size: 0.7rem;
        font-family: ui-monospace, monospace;
        color: #64748b;
    }
    :global([data-testid^='child-']),
    :global([data-testid^='grandchild-']),
    :global(.block) {
        display: flex;
        align-items: center;
        height: 2.75rem;
        padding: 0 0.75rem;
        border-radius: 0.5rem;
        background: #3730a3;
        color: white;
        font-size: 0.8rem;
        font-weight: 600;
    }
    :global(.block.ref) {
        font-weight: 500;
        font-style: italic;
    }
    .badge {
        display: inline-block;
        margin-left: 0.2rem;
        padding: 0 0.4rem;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
        font-weight: 700;
        font-style: normal;
    }
    .badge.b {
        background: #4f46e5;
        color: white;
    }
    .readout {
        font-size: 0.8rem;
        font-family: ui-monospace, monospace;
        color: #334155;
    }
    .chip,
    .verdict {
        display: inline-block;
        margin-left: 0.25rem;
        padding: 0.05rem 0.45rem;
        border-radius: 999px;
        font-weight: 700;
    }
    .ok {
        background: #dcfce7;
        color: #166534;
    }
    .bad {
        background: #fee2e2;
        color: #991b1b;
    }
</style>
