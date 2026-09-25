<script lang="ts">
    import { motion } from '$lib'
    import ResizeMetrics from './ResizeMetrics.svelte'

    const originalWidth = 400
    const resizedWidth = 200

    let { data }: { data: { slow: boolean } } = $props()
    let containerWidth = $state(originalWidth)
    let momentumReset = $state(0)
    const containerTransition = $derived(
        data.slow ? 'width 3200ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
    )
    const dragTransition = $derived(
        data.slow
            ? {
                  bounceStiffness: 4,
                  bounceDamping: 3,
                  timeConstant: 5200,
                  restDelta: 0.04,
                  restSpeed: 0.3
              }
            : undefined
    )
    const toggleWidth = () => {
        containerWidth = containerWidth === originalWidth ? resizedWidth : originalWidth
    }
    let containerEl: HTMLDivElement | null = $state(null)

    let idleContainer: HTMLDivElement | null = $state(null)
    let idleReset = $state(0)

    const resizeIdle = (width: number) => {
        // Change only DOM geometry so reactive drag options cannot remeasure first.
        if (idleContainer) idleContainer.style.width = `${width}px`
    }

    const resetIdle = () => {
        resizeIdle(originalWidth)
        idleReset += 1
    }

    const resetMomentum = () => {
        containerWidth = originalWidth
        momentumReset += 1
    }
</script>

<svelte:head><title>Drag constraint resize · Visual review</title></svelte:head>

<div class="review-page">
    <div class="review-content">
        <header class="page-header">
            <p class="eyebrow">004 / Drag constraints</p>
            <h1>Resize without surprises.</h1>
            <p>
                Two quick checks for cards inside a changing boundary. Start with blue, then try
                orange.
            </p>
        </header>

        <section class="test-panel blue" aria-labelledby="resting-title">
            <div class="section-heading">
                <span class="section-number">01</span>
                <div>
                    <p class="eyebrow">Start here · No momentum</p>
                    <h2 id="resting-title">Keep a resting card still</h2>
                </div>
            </div>
            <div class="guide">
                <ol>
                    <li>
                        Click <strong>Reset</strong>, then <strong>Shrink to 200</strong> and
                        <strong>Grow to 400</strong> without dragging.
                    </li>
                    <li>
                        Watch the blue card: its <strong>left inset stays 40 px</strong> and
                        <strong>From reset stays 0 px</strong>.
                    </li>
                    <li>
                        Now drag it right, then shrink and grow again. Its dragged offset should
                        remap with the boundary.
                    </li>
                </ol>
                <p class="expected">
                    <strong>Look for:</strong> no sideways jump before dragging. After dragging, a changing
                    reset delta is expected.
                </p>
            </div>
            <div class="controls" aria-label="Resting card controls">
                <button
                    class="primary"
                    type="button"
                    data-testid="idle-shrink"
                    onclick={() => resizeIdle(resizedWidth)}>Shrink to 200</button
                >
                <button
                    type="button"
                    data-testid="idle-grow"
                    onclick={() => resizeIdle(originalWidth)}>Grow to 400</button
                >
                <button class="reset" type="button" data-testid="idle-reset" onclick={resetIdle}
                    >Reset</button
                >
            </div>
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable regions need focus for keyboard scrolling.) -->
            <div
                class="stage-scroll"
                role="region"
                aria-label="Blue card drag area; scroll horizontally on small screens"
                tabindex="0"
            >
                <div class="stage">
                    <div
                        bind:this={idleContainer}
                        data-testid="idle-container"
                        class="constraint idle-constraint"
                        style="box-sizing:content-box;width:400px;height:160px;"
                    >
                        {#key idleReset}
                            <motion.div
                                drag="x"
                                dragConstraints={idleContainer}
                                dragMomentum={false}
                                dragElastic={0}
                                data-testid="idle-card"
                                style="position:absolute;left:40px;top:40px;width:80px;height:80px;background:#38bdf8;border-radius:8px;cursor:grab;user-select:none;display:grid;place-items:center;color:#073850;font-weight:700;font-size:12px;"
                            >
                                Drag ↔
                            </motion.div>
                        {/key}
                    </div>
                </div>
            </div>
            <ResizeMetrics container={idleContainer} cardId="idle-card" prefix="idle-metric" />
            <p class="metric-note">
                Left inset is measured from the inside of the border. From reset tracks horizontal
                movement from the card’s fresh starting position.
            </p>
        </section>

        <section class="test-panel orange" aria-labelledby="momentum-title">
            <div class="section-heading">
                <span class="section-number">02</span>
                <div>
                    <p class="eyebrow">Then try · Momentum + resize</p>
                    <h2 id="momentum-title">Catch a moving card</h2>
                </div>
            </div>
            <div class="guide">
                <ol>
                    <li>
                        Click <strong>Reset</strong>. Drag the orange card quickly to the right and
                        release.
                    </li>
                    <li>
                        While it is moving, click <strong>Shrink to 200</strong>. Repeat with
                        <strong>Grow to 400</strong>.
                    </li>
                    <li>
                        After it settles, the card should be inside the resized boundary with <strong
                            >0 px overflow</strong
                        >.
                    </li>
                </ol>
                <p class="expected">
                    <strong>Look for:</strong> the card follows the new bounds. Temporary overflow during
                    a drag or bounce is expected.
                </p>
            </div>
            <div class="controls" aria-label="Momentum card controls">
                <button class="primary" type="button" data-testid="resize-btn" onclick={toggleWidth}
                    >{containerWidth === originalWidth ? 'Shrink to 200' : 'Grow to 400'}</button
                >
                <button
                    class="reset"
                    type="button"
                    data-testid="momentum-reset"
                    onclick={resetMomentum}>Reset</button
                >
                <a class="speed-link" href={data.slow ? '?' : '?slow'}
                    >{data.slow ? 'Use normal speed' : 'Try slow motion'}
                    <span aria-hidden="true">→</span></a
                >
            </div>
            <p class="speed-note">
                {data.slow
                    ? 'Slow motion: a 3.2-second resize and a gentler spring give you time to watch.'
                    : 'Normal speed. Use slow motion for more time to click while the card is moving.'}
            </p>
            <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable regions need focus for keyboard scrolling.) -->
            <div
                class="stage-scroll"
                role="region"
                aria-label="Orange card drag area; scroll horizontally on small screens"
                tabindex="0"
            >
                <div class="stage">
                    {#key momentumReset}
                        <div
                            bind:this={containerEl}
                            data-testid="container"
                            class="constraint"
                            style="height:200px;width:{containerWidth}px;display:grid;place-items:center;transition:{containerTransition};"
                        >
                            <motion.div
                                drag
                                dragConstraints={containerEl}
                                {dragTransition}
                                data-testid="drag-card"
                                style="width:80px;height:80px;background:#fb923c;border-radius:8px;cursor:grab;user-select:none;display:grid;place-items:center;color:#542900;font-weight:700;font-size:12px;"
                            >
                                Drag me
                            </motion.div>
                        </div>
                    {/key}
                </div>
            </div>
            <ResizeMetrics container={containerEl} cardId="drag-card" prefix="momentum-metric" />
            <p class="metric-note">
                Overflow is the furthest edge outside the inner boundary, on either axis. Check it
                after settling; the live label is not a pass/fail verdict. The orange width buttons
                include the 2 px border on each side.
            </p>
        </section>
        <footer>
            Reset snaps each fixture back to its starting state so you can repeat the same check.
        </footer>
    </div>
</div>

<style>
    .review-page {
        width: 100%;
        min-width: 0;
        min-height: 100vh;
        background: #f4f6f9;
        color: #182437;
        font:
            14px/1.6 system-ui,
            sans-serif;
        padding: 48px 24px;
        box-sizing: border-box;
    }
    .review-content {
        max-width: 820px;
        margin: 0 auto;
    }
    .page-header {
        margin-bottom: 28px;
    }
    .eyebrow {
        margin: 0 0 4px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 11px;
        font-weight: 700;
        color: #5c6b80;
    }
    h1 {
        margin: 0 0 10px;
        font-size: clamp(27px, 4vw, 38px);
        line-height: 1.15;
        letter-spacing: -0.04em;
        font-weight: 750;
    }
    .page-header > p:last-child {
        color: #536176;
        margin: 0;
        max-width: 570px;
    }
    .test-panel {
        --accent: #12628e;
        --wash: #eef8fe;
        padding: 28px;
        border: 1px solid #dce3eb;
        border-radius: 18px;
        margin-bottom: 24px;
        background: #fff;
        box-shadow: 0 3px 12px #1b2b4505;
    }
    .orange {
        --accent: #9a500c;
        --wash: #fff6eb;
    }
    .section-heading {
        display: flex;
        gap: 14px;
        align-items: center;
        margin-bottom: 20px;
    }
    .section-number {
        display: grid;
        place-items: center;
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        background: var(--wash);
        color: var(--accent);
        border-radius: 12px;
        font:
            600 16px ui-monospace,
            monospace;
    }
    h2 {
        font-size: 22px;
        letter-spacing: -0.025em;
        line-height: 1.25;
        font-weight: 700;
        margin: 0;
    }
    ol {
        list-style: decimal;
        padding-left: 22px;
        margin: 0 0 16px;
        color: #4c5b6e;
    }
    li {
        padding-left: 3px;
        margin-bottom: 7px;
    }
    strong {
        font-weight: 650;
        color: #26364b;
    }
    .expected {
        padding: 12px 15px;
        background: var(--wash);
        border-left: 3px solid var(--accent);
        border-radius: 0 8px 8px 0;
        color: #43536a;
        font-size: 13px;
        margin: 0 0 20px;
    }
    .controls {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
    }
    button,
    .speed-link {
        font:
            600 13px/1.4 system-ui,
            sans-serif;
    }
    button {
        border: 1px solid #ccd6e2;
        border-radius: 8px;
        padding: 10px 14px;
        background: #fff;
        color: #34465d;
        cursor: pointer;
    }
    button:hover {
        background: #f0f4f8;
    }
    button.primary {
        color: #fff;
        background: var(--accent);
        border-color: var(--accent);
    }
    button.primary:hover {
        filter: brightness(0.9);
    }
    button.reset {
        margin-left: auto;
    }
    button:focus-visible,
    a:focus-visible,
    .stage-scroll:focus-visible {
        outline: 3px solid #4093cc;
        outline-offset: 3px;
    }
    .speed-link {
        color: var(--accent);
        text-decoration: underline;
        text-underline-offset: 3px;
        margin-left: 8px;
    }
    .speed-note {
        font-size: 12px;
        color: #647185;
        margin: 10px 0 0;
    }
    .stage-scroll {
        overflow-x: auto;
        margin: 18px 0;
        border: 1px solid #e3e8ee;
        border-radius: 12px;
        background: #f8fafc;
    }
    .stage {
        padding: 24px;
        width: max-content;
        min-width: 100%;
        box-sizing: border-box;
    }
    .constraint {
        border: 2px dashed #8b9cb0;
        position: relative;
        background: #edf2f7;
    }
    .metric-note {
        font-size: 12px;
        color: #647185;
        margin: 12px 0 0;
    }
    footer {
        color: #657287;
        font-size: 12px;
        padding: 0 4px;
    }
    @media (max-width: 600px) {
        .review-page {
            padding: 28px 12px;
        }
        .test-panel {
            padding: 18px;
            border-radius: 14px;
        }
        h2 {
            font-size: 19px;
        }
        .stage {
            padding: 16px;
        }
        button.reset {
            margin-left: 0;
        }
        .speed-link {
            flex-basis: 100%;
            margin: 7px 0 0;
        }
    }
</style>
