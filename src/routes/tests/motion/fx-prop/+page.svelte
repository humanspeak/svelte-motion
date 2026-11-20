<script lang="ts">
    import { motion } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Motion 14.14.0 `fx` prop: it marks the element for an `<FX>` canvas
    // layer by rendering an empty `fx` attribute. Upstream
    // `framer-motion/src/render/dom/utils/filter-props.ts:32-39` and
    // `motion/__tests__/fx-prop.test.tsx` at v14.14.0.

    let on = $state(true)
    let box = $state<HTMLElement | null>(null)
    let attr = $state<string | null | undefined>(undefined)

    $effect(() => {
        void on
        if (!box) return
        attr = box.getAttribute('fx')
    })

    const readout = $derived(attr === undefined ? '…' : attr === null ? 'none' : `"${attr}"`)
    const expectedAttr = $derived(on ? '' : null)
    const pass = $derived(attr === expectedAttr)

    const steps: TesterStep[] = [
        {
            text: 'Look at the readout under the box.',
            expected: 'fx=""'
        },
        {
            text: 'Click Toggle.',
            expected: 'no fx attribute (the readout says none)',
            action: { label: 'Toggle', run: () => (on = !on) }
        }
    ]
</script>

<svelte:head>
    <title>fx prop: renders an fx attribute</title>
</svelte:head>

<main class="fx-prop">
    <motion.div id="box" class="box" fx={on} bind:ref={box}>fx={String(on)}</motion.div>
    <button id="toggle" type="button" onclick={() => (on = !on)}>Toggle</button>
    <p>fx attribute: <output id="attr">{readout}</output></p>
</main>

<TesterPanel eyebrow="fx-prop.test.tsx" title="fx prop: renders an fx attribute" {steps}>
    {#snippet checks()}
        <p>
            <code>fx</code> renders an empty <code>fx</code> attribute when it is on and no
            attribute when it is off. It marks the element for an <code>&lt;FX&gt;</code> canvas
            layer, which is not part of Motion 14.14, so <code>fx</code> has no visual effect in this
            release.
        </p>
    {/snippet}
    {#snippet summary()}
        <span class="verdict" class:ok={pass} class:bad={!pass}>
            {pass ? '✓ attribute matches' : '✗ attribute mismatch'}
        </span>
        fx: <b>{readout}</b> · expected: <b>{expectedAttr === null ? 'none' : '""'}</b>
    {/snippet}
</TesterPanel>

<style>
    main {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
        padding: 2rem;
    }
    :global(.box) {
        width: 120px;
        height: 120px;
        border-radius: 12px;
        background-color: #e11d48;
        color: white;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    button {
        padding: 0.5rem 1rem;
        border-radius: 8px;
        background: #334155;
        color: white;
    }
    .verdict {
        display: inline-block;
        padding: 1px 8px;
        margin-right: 6px;
        border-radius: 999px;
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
</style>
