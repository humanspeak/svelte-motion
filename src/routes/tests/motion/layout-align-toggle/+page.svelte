<script lang="ts">
    /**
     * Characterization page for `layout` FLIP driven by a PARENT's reactive
     * inline-style change. Clicking flips the track's `align-items`
     * (flex-start ↔ flex-end); the ball carries `layout` and its
     * `transition` identity changes in the same flush, so the reactive
     * measurement path must snapshot the old slot and FLIP to the new one —
     * upstream's classic toggle-switch mechanic.
     *
     * @component
     */
    import { motion, styleString, type MotionTransition } from '$lib'

    let isOn = $state(false)

    const spring: MotionTransition = { type: 'spring', stiffness: 700, damping: 30 }
    const tween: MotionTransition = { duration: 0.6, ease: 'easeOut' }
    const currentTransition = $derived(isOn ? spring : tween)
</script>

<svelte:head>
    <title>Motion · layout FLIP on parent align toggle</title>
</svelte:head>

<main>
    <h1>layout FLIP on parent align toggle</h1>

    <motion.button
        data-testid="align-toggle-track"
        onclick={() => (isOn = !isOn)}
        type="button"
        style={styleString(() => ({
            width: '80px',
            height: '200px',
            display: 'flex',
            alignItems: isOn ? 'flex-start' : 'flex-end',
            padding: '10px',
            border: '1px solid #4ff0b7',
            background: 'rgba(79, 240, 183, 0.08)',
            cursor: 'pointer'
        }))}
    >
        <motion.div
            data-testid="align-toggle-ball"
            layout
            transition={currentTransition}
            style={styleString(() => ({
                width: '60px',
                height: '60px',
                background: '#4ff0b7'
            }))}
        ></motion.div>
    </motion.button>
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
</style>
