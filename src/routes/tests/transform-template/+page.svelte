<script lang="ts">
    import { onMount } from 'svelte'
    import {
        animate,
        motion,
        useAnimationControls,
        useMotionValue,
        type RawMotionValue
    } from '$lib'
    import type { TransformTemplate } from 'motion-dom'

    const liveX = useMotionValue(24)
    const controls = useAnimationControls()

    let moved = $state(false)
    let animated = $state(false)
    let liveAnimation: { stop: () => void } | null = null
    let templateVersion = $state<'single' | 'double'>('single')
    let removeChangedTemplate = $state(true)
    let removeChangedX = $state(10)
    let removeSameTemplate = $state(true)
    let removeOnlyTemplate = $state(true)
    let slowAnimated = $state(false)
    let controlsSent = $state(false)
    let styleAnimated = $state(false)
    let mixedFrame = $state(0)
    let mixedInlineTransform = $state('')
    let mixedInlineRotate = $state('')
    let mixedComputedTransform = $state('')
    let mixedComputedRotate = $state('')
    let mixedComputedAngle = $state('')

    const transformTemplate: TransformTemplate = ({ x, rotate }, generated) => {
        const lift = x ?? '0px'
        const tilt = rotate ?? '0deg'
        return `translateY(${lift}) rotateZ(${tilt}) ${generated}`.trim()
    }

    const xMirrorTemplate: TransformTemplate = ({ x }, generated) => {
        const lift = x ?? '0px'
        return `translateY(${lift}) ${generated}`.trim()
    }

    const upstreamInitialTemplate: TransformTemplate = ({ x }, generated) =>
        `translateY(${x}) ${generated}`.trim()

    const upstreamStyleTemplate: TransformTemplate = (_latest, generated) =>
        `translateY(20px) ${generated}`.trim()

    const upstreamUpdatedTemplate: TransformTemplate = ({ x }, generated) => {
        const nextX = typeof x === 'string' ? Number.parseFloat(x) : Number(x)
        return `translateY(${nextX * 2}px) ${generated}`.trim()
    }

    const fixedTemplate: TransformTemplate = () => 'translateY(20px)'
    const perspectiveTemplate: TransformTemplate = (_latest, generated) =>
        `${generated} translateZ(80px)`.trim()

    const readMatrixAngle = (matrix: string): string => {
        const match = matrix.match(/^matrix\(([^,]+),\s*([^,]+)/)
        if (!match) return 'none'
        const radians = Math.atan2(Number.parseFloat(match[2]), Number.parseFloat(match[1]))
        return `${Math.round((radians * 180) / Math.PI)}deg`
    }

    const currentTemplate = $derived(
        templateVersion === 'single' ? upstreamInitialTemplate : upstreamUpdatedTemplate
    )
    const removeChangedTransformTemplate = $derived(
        removeChangedTemplate ? fixedTemplate : undefined
    )
    const removeSameTransformTemplate = $derived(removeSameTemplate ? fixedTemplate : undefined)
    const removeOnlyTransformTemplateProp = $derived(removeOnlyTemplate ? fixedTemplate : undefined)

    async function toggleLive() {
        liveAnimation?.stop()
        moved = !moved
        const animation = animate(liveX as unknown as RawMotionValue<number>, moved ? 180 : 24, {
            duration: 0.35,
            ease: [0.22, 1, 0.36, 1]
        })
        liveAnimation = animation
        await animation
        if (liveAnimation === animation) liveAnimation = null
    }

    function resetLive() {
        liveAnimation?.stop()
        liveAnimation = null
        moved = false
        liveX.jump(24)
    }

    function toggleAnimated() {
        animated = !animated
    }

    function toggleSlowAnimated() {
        slowAnimated = !slowAnimated
    }

    function toggleControlsAnimation() {
        controlsSent = !controlsSent
        void controls.start(
            {
                x: controlsSent ? 120 : 0,
                rotate: controlsSent ? 30 : 0
            },
            { duration: 2.4, ease: 'linear' }
        )
    }

    function stopControlsAnimation() {
        controls.stop()
    }

    function toggleStyleAnimation() {
        styleAnimated = !styleAnimated
    }

    function updateTemplate() {
        templateVersion = templateVersion === 'single' ? 'double' : 'single'
    }

    function removeTemplateAndChangeTransform() {
        removeChangedTemplate = false
        removeChangedX = 20
    }

    function removeTemplateAndKeepTransform() {
        removeSameTemplate = false
    }

    function removeOnlyTransformTemplate() {
        removeOnlyTemplate = false
    }

    onMount(() => {
        let raf = 0

        const tick = () => {
            mixedFrame += 1
            const element = document.querySelector<HTMLElement>(
                '[data-testid="template-style-animated"]'
            )

            if (element) {
                mixedInlineTransform = element.style.transform || 'none'
                mixedInlineRotate = element.style.rotate || 'none'
                mixedComputedTransform = getComputedStyle(element).transform
                mixedComputedRotate = getComputedStyle(element).rotate
                mixedComputedAngle = readMatrixAngle(mixedComputedTransform)
            }

            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    })
</script>

<svelte:head>
    <title>transformTemplate</title>
</svelte:head>

<main>
    <section class="intro">
        <p class="kicker">transformTemplate (#316)</p>
        <h1>Generated transforms can be reshaped before they hit CSS.</h1>
        <p>
            Each element still uses Motion shortcuts like <code>x</code> and <code>rotate</code>,
            then <code>transformTemplate</code> wraps the generated transform with another ordered transform
            string.
        </p>
    </section>

    <section class="grid">
        <article>
            <h2>Initial render</h2>
            <p class="expectation">
                Starts already offset. Expected transform:
                <code>translateY(10px)</code> wrapping <code>translateX(10px)</code>.
            </p>
            <motion.div
                class="orb cyan"
                data-testid="template-initial"
                initial={{ x: 10 }}
                transformTemplate={upstreamInitialTemplate}
            >
                static
            </motion.div>
        </article>

        <article>
            <h2>Style transform</h2>
            <p class="expectation">
                Static style <code>x: 10</code> should be wrapped by a fixed
                <code>translateY(20px)</code>.
            </p>
            <motion.div
                class="orb cyan"
                data-testid="template-style"
                style={{ x: 10 }}
                transformTemplate={upstreamStyleTemplate}
            >
                style
            </motion.div>
        </article>

        <article>
            <h2>Template only</h2>
            <p class="expectation">
                No Motion transform props. The template alone should render
                <code>translateY(20px)</code>.
            </p>
            <motion.div
                class="orb cyan"
                data-testid="template-only"
                transformTemplate={fixedTemplate}
            >
                only
            </motion.div>
        </article>

        <article>
            <h2>MotionValue style</h2>
            <p class="expectation">
                Move animates a live MotionValue from <code>x: 24</code> to <code>x: 180</code>. The
                box should travel diagonally because the template mirrors x into y.
            </p>
            <motion.div
                class="orb pink"
                data-testid="template-live"
                style={{ x: liveX, rotate: 8 }}
                {transformTemplate}
            >
                live
            </motion.div>
            <div class="controls">
                <button type="button" data-testid="template-live-toggle" onclick={toggleLive}>
                    {moved ? 'Return' : 'Move'}
                </button>
                <button type="button" data-testid="template-live-reset" onclick={resetLive}>
                    Reset
                </button>
            </div>
        </article>

        <article>
            <h2>Animate target</h2>
            <p class="expectation">
                Send animates to <code>x: 120</code> and <code>rotate: 30</code>. It should land
                diagonally down-right and stay there without losing the template.
            </p>
            <motion.div
                class="orb green"
                data-testid="template-animated"
                initial={{ x: 0, rotate: 0 }}
                animate={animated ? { x: 120, rotate: 30 } : { x: 0, rotate: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                {transformTemplate}
            >
                target
            </motion.div>
            <div class="controls">
                <button
                    type="button"
                    data-testid="template-animated-toggle"
                    onclick={toggleAnimated}
                >
                    {animated ? 'Back' : 'Send'}
                </button>
            </div>
        </article>

        <article>
            <h2>Animated template frames</h2>
            <p class="expectation">
                Slow version of Animate target. Every in-between frame should keep
                <code>translateY</code> and <code>translateX</code> matched.
            </p>
            <motion.div
                class="orb mint"
                data-testid="template-slow-animated"
                initial={{ x: 0, rotate: 0 }}
                animate={slowAnimated ? { x: 120, rotate: 30 } : { x: 0, rotate: 0 }}
                transition={{ duration: 2.4, ease: 'linear' }}
                {transformTemplate}
            >
                frames
            </motion.div>
            <div class="controls">
                <button
                    type="button"
                    data-testid="template-slow-animated-toggle"
                    onclick={toggleSlowAnimated}
                >
                    {slowAnimated ? 'Back' : 'Send'}
                </button>
            </div>
        </article>

        <article>
            <h2>Controls template frames</h2>
            <p class="expectation">
                Same transformTemplate path, but started by animation controls. It should move
                smoothly and preserve the template during the whole controls animation.
            </p>
            <motion.div
                class="orb pink"
                data-testid="template-controls-animated"
                initial={{ x: 0, rotate: 0 }}
                animate={controls}
                {transformTemplate}
            >
                controls
            </motion.div>
            <div class="controls">
                <button
                    type="button"
                    data-testid="template-controls-animated-toggle"
                    onclick={toggleControlsAnimation}
                >
                    {controlsSent ? 'Back' : 'Send'}
                </button>
                <button
                    type="button"
                    data-testid="template-controls-animated-stop"
                    onclick={stopControlsAnimation}
                >
                    Stop
                </button>
            </div>
        </article>

        <article>
            <h2>Style + animated transform</h2>
            <p class="expectation">
                Style keeps one <code>rotate: 8</code> while Send animates <code>x: 120</code>. It
                should move diagonally, keep that single tilt, and not twitch after landing.
            </p>
            <dl class="frame-readout" data-testid="template-style-animated-readout">
                <div>
                    <dt>frame</dt>
                    <dd>{mixedFrame}</dd>
                </div>
                <div>
                    <dt>inline</dt>
                    <dd>{mixedInlineTransform}</dd>
                </div>
                <div>
                    <dt>i rotate</dt>
                    <dd>{mixedInlineRotate}</dd>
                </div>
                <div>
                    <dt>computed</dt>
                    <dd>{mixedComputedTransform}</dd>
                </div>
                <div>
                    <dt>c rotate</dt>
                    <dd>{mixedComputedRotate}</dd>
                </div>
                <div>
                    <dt>c angle</dt>
                    <dd>{mixedComputedAngle}</dd>
                </div>
            </dl>
            <motion.div
                class="orb green"
                data-testid="template-style-animated"
                style={{ rotate: 8 }}
                initial={{ x: 0 }}
                animate={styleAnimated ? { x: 120 } : { x: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                transformTemplate={xMirrorTemplate}
            >
                mixed
            </motion.div>
            <div class="controls">
                <button
                    type="button"
                    data-testid="template-style-animated-toggle"
                    onclick={toggleStyleAnimation}
                >
                    {styleAnimated ? 'Back' : 'Send'}
                </button>
            </div>
        </article>

        <article>
            <h2>Updated template</h2>
            <p class="expectation">
                Double swaps the template from <code>translateY(x)</code> to
                <code>translateY(x * 2)</code>, so the box should jump from y 10 to y 20.
            </p>
            <motion.div
                class="orb blue"
                data-testid="template-updated"
                style={{ x: 10 }}
                transformTemplate={currentTemplate}
            >
                update
            </motion.div>
            <div class="controls">
                <button type="button" data-testid="template-update-toggle" onclick={updateTemplate}>
                    Double
                </button>
            </div>
        </article>

        <article>
            <h2>Perspective template</h2>
            <p class="expectation">
                Adds <code>translateZ(80px)</code> after Motion's generated
                <code>perspective(400px) translateX(100px)</code>. The lens should remain visible
                and look slightly enlarged.
            </p>
            <motion.div
                class="orb cyan"
                data-testid="template-perspective"
                style={{ x: '100px', transformPerspective: '400px' }}
                transformTemplate={perspectiveTemplate}
            >
                lens
            </motion.div>
        </article>

        <article>
            <h2>Optimized appear under template (transform)</h2>
            <p class="expectation">
                Animates <code>x</code> on mount under a template. Optimized appear must be
                suppressed (no <code>data-framer-appear-id</code>) so the WAAPI bootstrap never
                paints an untemplated transform. First frame: <code>translateY(0px)</code>; settles
                at <code>translateY(120px) translateX(120px)</code>.
            </p>
            <motion.div
                class="orb slate"
                data-testid="template-appear"
                initial={{ opacity: 0, x: 0 }}
                animate={{ opacity: 1, x: 120 }}
                transformTemplate={xMirrorTemplate}
                transition={{ duration: 0.4, ease: 'linear' }}
            >
                appear
            </motion.div>
        </article>

        <article>
            <h2>Optimized appear under template (opacity only)</h2>
            <p class="expectation">
                Animates only <code>opacity</code> on mount under a fixed template. No transform is
                accelerated, so optimized appear stays on (keeps
                <code>data-framer-appear-id</code>) while the template still renders
                <code>translateY(20px)</code>.
            </p>
            <motion.div
                class="orb mint"
                data-testid="template-appear-opacity"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transformTemplate={fixedTemplate}
                transition={{ duration: 0.4, ease: 'linear' }}
            >
                fade
            </motion.div>
        </article>

        <article>
            <h2>Remove template + change transform</h2>
            <p class="expectation">
                Remove drops the template and changes x from 10 to 20. Expected final transform:
                only <code>translateX(20px)</code>.
            </p>
            <motion.div
                class="orb amber"
                data-testid="template-remove-changed"
                style={{ x: removeChangedX }}
                transformTemplate={removeChangedTransformTemplate}
            >
                changed
            </motion.div>
            <div class="controls">
                <button
                    type="button"
                    data-testid="template-remove-changed-toggle"
                    onclick={removeTemplateAndChangeTransform}
                >
                    Remove
                </button>
            </div>
        </article>

        <article>
            <h2>Remove template + keep transform</h2>
            <p class="expectation">
                Remove drops the template but keeps x at 10. Expected final transform: only
                <code>translateX(10px)</code>.
            </p>
            <motion.div
                class="orb violet"
                data-testid="template-remove-same"
                style={{ x: 10 }}
                transformTemplate={removeSameTransformTemplate}
            >
                same
            </motion.div>
            <div class="controls">
                <button
                    type="button"
                    data-testid="template-remove-same-toggle"
                    onclick={removeTemplateAndKeepTransform}
                >
                    Remove
                </button>
            </div>
        </article>

        <article>
            <h2>Remove template only</h2>
            <p class="expectation">
                Remove drops a template that was the only transform source. The box should return to
                no CSS transform.
            </p>
            <motion.div
                class="orb slate"
                data-testid="template-remove-only"
                transformTemplate={removeOnlyTransformTemplateProp}
            >
                none
            </motion.div>
            <div class="controls">
                <button
                    type="button"
                    data-testid="template-remove-only-toggle"
                    onclick={removeOnlyTransformTemplate}
                >
                    Remove
                </button>
            </div>
        </article>
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
        width: min(1080px, calc(100vw - 32px));
        display: grid;
        align-content: center;
        gap: 32px;
        margin: 0 auto;
        padding: 48px 0;
    }

    .intro {
        max-width: 760px;
    }

    .kicker {
        margin: 0 0 8px;
        color: #67e8f9;
        font-size: 13px;
        font-weight: 850;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: clamp(34px, 5vw, 64px);
        line-height: 0.95;
        letter-spacing: 0;
    }

    .intro p:not(.kicker) {
        margin: 14px 0 0;
        color: #b7d4d8;
        font-size: 16px;
        line-height: 1.65;
    }

    code {
        color: #f0abfc;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 18px;
    }

    article {
        min-height: 330px;
        display: grid;
        align-content: start;
        gap: 24px;
        padding: 24px;
        border: 1px solid rgba(125, 211, 252, 0.3);
        background:
            linear-gradient(90deg, rgba(103, 232, 249, 0.08) 1px, transparent 1px),
            linear-gradient(0deg, rgba(103, 232, 249, 0.08) 1px, transparent 1px), #0b171a;
        background-size: 42px 42px;
        overflow: hidden;
    }

    h2 {
        margin: 0;
        color: #dff8ff;
        font-size: 18px;
        line-height: 1;
    }

    .expectation {
        margin: -12px 0 0;
        color: #a9c9cf;
        font-size: 13px;
        line-height: 1.45;
    }

    .frame-readout {
        height: 148px;
        box-sizing: border-box;
        display: grid;
        gap: 6px;
        grid-template-rows: repeat(6, 1fr);
        margin: -10px 0 0;
        padding: 10px;
        border: 1px solid rgba(125, 211, 252, 0.24);
        background: rgba(3, 19, 22, 0.72);
        color: #c8f7ff;
        font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace;
        font-size: 11px;
        line-height: 1.35;
        overflow: hidden;
    }

    .frame-readout div {
        min-width: 0;
        display: grid;
        grid-template-columns: 72px minmax(0, 1fr);
        gap: 8px;
    }

    .frame-readout dt {
        color: #67e8f9;
        font-weight: 800;
        text-transform: uppercase;
    }

    .frame-readout dd {
        min-width: 0;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    :global(.orb) {
        width: 116px;
        height: 116px;
        display: grid;
        place-items: center;
        border-radius: 28px;
        color: #031316;
        font-size: 15px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        transform-origin: 50% 50%;
    }

    :global(.cyan) {
        background: linear-gradient(135deg, #67e8f9, #2dd4bf);
        box-shadow: 0 22px 80px rgba(45, 212, 191, 0.38);
    }

    :global(.pink) {
        background: linear-gradient(135deg, #f0abfc, #fb7185);
        box-shadow: 0 22px 80px rgba(240, 171, 252, 0.34);
    }

    :global(.green) {
        background: linear-gradient(135deg, #bef264, #34d399);
        box-shadow: 0 22px 80px rgba(52, 211, 153, 0.34);
    }

    :global(.mint) {
        background: linear-gradient(135deg, #99f6e4, #22d3ee);
        box-shadow: 0 22px 80px rgba(34, 211, 238, 0.34);
    }

    :global(.blue) {
        background: linear-gradient(135deg, #93c5fd, #38bdf8);
        box-shadow: 0 22px 80px rgba(56, 189, 248, 0.34);
    }

    :global(.amber) {
        background: linear-gradient(135deg, #fde68a, #f59e0b);
        box-shadow: 0 22px 80px rgba(245, 158, 11, 0.34);
    }

    :global(.violet) {
        background: linear-gradient(135deg, #c4b5fd, #8b5cf6);
        box-shadow: 0 22px 80px rgba(139, 92, 246, 0.34);
    }

    :global(.slate) {
        background: linear-gradient(135deg, #cbd5e1, #64748b);
        box-shadow: 0 22px 80px rgba(100, 116, 139, 0.34);
    }

    .controls {
        display: flex;
        gap: 10px;
        margin-top: 12px;
    }

    button {
        min-width: 96px;
        border: 1px solid rgba(125, 211, 252, 0.45);
        border-radius: 6px;
        background: #102332;
        color: #ecfeff;
        padding: 10px 14px;
        font: inherit;
        font-weight: 850;
        cursor: pointer;
    }

    button:hover {
        border-color: #67e8f9;
        background: #153247;
    }

    @media (max-width: 860px) {
        .grid {
            grid-template-columns: 1fr;
        }
    }
</style>
