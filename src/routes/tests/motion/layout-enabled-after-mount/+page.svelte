<script lang="ts">
    /**
     * `layout` turned on AFTER mount must animate the next layout change.
     *
     * Port of upstream #2567 (`packages/framer-motion/src/motion/__tests__/dynamic-layout.test.tsx`,
     * commit `550d03223`): from Motion 14.3.1 the projection node registers its
     * layout listener from `setOptions()` too, not only from `mount()`, so a
     * box that mounts with `layout={false}` and later flips to `layout={true}`
     * FLIPs its width instead of snapping. Without clicking "Enable layout" the
     * width change must snap, proving the prop is what drives the animation.
     *
     * @component
     */
    import { motion, styleString } from '$lib'

    let layoutOn = $state(false)
    let wide = $state(false)
</script>

<svelte:head>
    <title>Motion · layout enabled after mount</title>
</svelte:head>

<main>
    <h1>layout enabled after mount</h1>

    <div class="controls">
        <button type="button" data-testid="enable-layout" onclick={() => (layoutOn = true)}>
            Enable layout
        </button>
        <button type="button" data-testid="toggle-width" onclick={() => (wide = !wide)}>
            Toggle width
        </button>
        <span data-testid="readout">layout={layoutOn} wide={wide}</span>
    </div>

    <motion.div
        data-testid="box"
        layout={layoutOn}
        transition={{ duration: 0.6, ease: 'linear' }}
        style={styleString(() => ({
            width: `${wide ? 300 : 100}px`,
            height: '100px',
            background: '#4ff0b7'
        }))}
    />
</main>

<style>
    :global(body) {
        margin: 0;
        background: #07100f;
        color: #e8fffa;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    main {
        width: min(920px, calc(100% - 32px));
        margin: 0 auto;
        padding: 24px 0 48px;
    }

    .controls {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 24px;
    }
</style>
