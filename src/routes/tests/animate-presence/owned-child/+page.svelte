<script lang="ts">
    import { AnimatePresence, motion } from '$lib'

    let legacyVisible = $state(true)
    let ownedVisible = $state(true)
    let legacyExitCount = $state(0)
    let ownedExitCount = $state(0)
    let ownedCanvas: HTMLCanvasElement | undefined = $state()
    let legacyInput: HTMLInputElement | undefined = $state()
    let ownedInput: HTMLInputElement | undefined = $state()
    let legacyFocusStatus = $state('focus the input, then press Escape')
    let ownedFocusStatus = $state('focus the input, then press Escape')

    const comparisonExit = { opacity: 0, y: -32, rotate: -3, scale: 0.92 }
    const comparisonTransition = { duration: 0.8, ease: 'linear' as const }

    const runBothExits = () => {
        legacyVisible = false
        ownedVisible = false
    }

    const resetBoth = () => {
        legacyVisible = true
        ownedVisible = true
        legacyFocusStatus = 'focus the input, then press Escape'
        ownedFocusStatus = 'focus the input, then press Escape'
    }

    const toggleLegacy = () => {
        legacyVisible = !legacyVisible
        if (legacyVisible) {
            legacyFocusStatus = 'focus the input, then press Escape'
        }
    }

    const toggleOwned = () => {
        ownedVisible = !ownedVisible
        if (ownedVisible) {
            ownedFocusStatus = 'focus the input, then press Escape'
        }
    }

    const exitLegacyFromFocusedInput = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        legacyVisible = false
        requestAnimationFrame(() => {
            legacyFocusStatus =
                document.activeElement === legacyInput
                    ? 'focus retained during exit'
                    : 'focus lost on removal'
        })
    }

    const exitOwnedFromFocusedInput = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        ownedVisible = false
        requestAnimationFrame(() => {
            ownedFocusStatus =
                document.activeElement === ownedInput
                    ? 'focus retained during exit'
                    : 'focus moved before exit'
        })
    }

    const completeOwnedExit = () => {
        ownedExitCount += 1
        if (ownedFocusStatus === 'focus retained during exit') {
            ownedFocusStatus = 'focus released after unmount'
        }
    }

    $effect(() => {
        if (!ownedCanvas) return
        const context = ownedCanvas.getContext('2d')
        if (!context) return

        const gradient = context.createLinearGradient(0, 0, ownedCanvas.width, 0)
        gradient.addColorStop(0, '#22c55e')
        gradient.addColorStop(1, '#2dd4bf')
        context.fillStyle = gradient
        context.fillRect(0, 0, ownedCanvas.width, ownedCanvas.height)
    })
</script>

<svelte:head>
    <title>Clone exit vs owned real-node exit</title>
</svelte:head>

<main>
    <header>
        <div class="issue-tag">EXIT LAB / 001</div>
        <p class="eyebrow">AnimatePresence mechanism comparison</p>
        <h1>Ghost copy <span>vs.</span> living node.</h1>
        <p class="intro">
            Run identical exits side by side. The legacy API animates a visual clone after Svelte
            destroys the component. The owned API retains the original node, its VisualElement, and
            live browser state until motion reports completion.
        </p>
        <div class="remove-contract">
            <div>
                <span>Clone path · on remove</span>
                <p>
                    Svelte destroys the original immediately. AnimatePresence creates an inert,
                    aria-hidden snapshot, runs the exit on that ghost, then removes the clone.
                </p>
            </div>
            <div>
                <span>Owned path · on remove</span>
                <p>
                    AnimatePresence keeps the original mounted, runs its exit through the live
                    VisualElement, then unmounts it only after the animation completes.
                </p>
            </div>
        </div>
        <div class="global-controls">
            <button class="primary" data-testid="compare-exit" onclick={runBothExits}>
                Run both exits
            </button>
            <button data-testid="compare-reset" onclick={resetBoth}>Reset / reverse</button>
        </div>
        <aside class="decisive-test">
            <span>Try the decisive test</span>
            <p>
                Click each lane’s button twice quickly. The clone path mounts a new node while its
                old ghost keeps exiting; the owned path reverses the same live node in place.
            </p>
        </aside>
    </header>

    <div class="comparison-grid">
        <section class="lane legacy">
            <div class="lane-heading">
                <div>
                    <span class="figure">A / LEGACY</span>
                    <h2>Clone exit</h2>
                </div>
                <span class="mechanism">cloneNode(true)</span>
            </div>

            <div class="stage">
                <div class="stage-grid"></div>
                <AnimatePresence onExitComplete={() => (legacyExitCount += 1)}>
                    {#if legacyVisible}
                        <motion.div
                            key="legacy-comparison-card"
                            data-testid="legacy-child"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={comparisonExit}
                            transition={comparisonTransition}
                            class="card legacy-card"
                        >
                            <div class="card-topline">
                                <span>detached replica</span>
                                <i></i>
                            </div>
                            <div class="fake-signal" aria-hidden="true">
                                <b style="height: 34%"></b>
                                <b style="height: 66%"></b>
                                <b style="height: 48%"></b>
                                <b style="height: 88%"></b>
                                <b style="height: 58%"></b>
                                <b style="height: 76%"></b>
                                <b style="height: 42%"></b>
                            </div>
                            <label>
                                DOM input · focus test
                                <input
                                    bind:this={legacyInput}
                                    data-testid="legacy-input"
                                    value="press Escape to exit"
                                    aria-describedby="legacy-focus-instruction"
                                    onfocus={() =>
                                        (legacyFocusStatus = 'input focused — press Escape')}
                                    onblur={() => {
                                        if (legacyVisible) {
                                            legacyFocusStatus = 'focus moved before exit'
                                        }
                                    }}
                                    onkeydown={exitLegacyFromFocusedInput}
                                />
                            </label>
                        </motion.div>
                    {/if}
                </AnimatePresence>
                {#if !legacyVisible}
                    <div class="exit-marker">original destroyed</div>
                {/if}
            </div>

            <div class="lane-controls">
                <button data-testid="legacy-toggle" onclick={toggleLegacy}>
                    {legacyVisible ? 'Exit clone path' : 'Mount new node'}
                </button>
                <output data-testid="legacy-exit-count">
                    exits completed: {legacyExitCount}
                </output>
            </div>
            <div class="focus-proof">
                <p id="legacy-focus-instruction">
                    Focus the input, then press <kbd>Esc</kbd> without clicking this lane’s button.
                </p>
                <output data-testid="legacy-focus-status" aria-live="polite">
                    {legacyFocusStatus}
                </output>
            </div>

            <dl>
                <div>
                    <dt>DOM identity</dt>
                    <dd>replaced</dd>
                </div>
                <div>
                    <dt>VisualElement</dt>
                    <dd>disconnected</dd>
                </div>
                <div>
                    <dt>Live state</dt>
                    <dd>not guaranteed</dd>
                </div>
                <div>
                    <dt>Re-entry</dt>
                    <dd>new node + old ghost</dd>
                </div>
            </dl>
        </section>

        <div class="versus" aria-hidden="true"><span>VS</span></div>

        <section class="lane owned">
            <div class="lane-heading">
                <div>
                    <span class="figure">B / OWNED</span>
                    <h2>Real-node exit</h2>
                </div>
                <span class="mechanism">present + child</span>
            </div>

            <div class="stage">
                <div class="stage-grid"></div>
                <AnimatePresence present={ownedVisible} onExitComplete={completeOwnedExit}>
                    {#snippet child()}
                        <motion.div
                            data-testid="owned-child"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={comparisonExit}
                            transition={comparisonTransition}
                            class="card owned-card"
                        >
                            <div class="card-topline">
                                <span>original instance</span>
                                <i></i>
                            </div>
                            <canvas
                                bind:this={ownedCanvas}
                                data-testid="owned-canvas"
                                width="196"
                                height="54"
                                aria-label="Live canvas retained during exit"
                            ></canvas>
                            <label>
                                DOM input · focus test
                                <input
                                    bind:this={ownedInput}
                                    data-testid="owned-input"
                                    value="press Escape to exit"
                                    aria-describedby="owned-focus-instruction"
                                    onfocus={() =>
                                        (ownedFocusStatus = 'input focused — press Escape')}
                                    onblur={() => {
                                        if (ownedVisible) {
                                            ownedFocusStatus = 'focus moved before exit'
                                        }
                                    }}
                                    onkeydown={exitOwnedFromFocusedInput}
                                />
                            </label>
                        </motion.div>
                    {/snippet}
                </AnimatePresence>
                {#if !ownedVisible}
                    <div class="exit-marker">original retained</div>
                {/if}
            </div>

            <div class="lane-controls">
                <button data-testid="owned-toggle" onclick={toggleOwned}>
                    {ownedVisible ? 'Exit real node' : 'Mount / reverse'}
                </button>
                <output data-testid="owned-exit-count">
                    exits completed: {ownedExitCount}
                </output>
            </div>
            <div class="focus-proof">
                <p id="owned-focus-instruction">
                    Focus the input, then press <kbd>Esc</kbd> without clicking this lane’s button.
                </p>
                <output data-testid="owned-focus-status" aria-live="polite">
                    {ownedFocusStatus}
                </output>
            </div>

            <dl>
                <div>
                    <dt>DOM identity</dt>
                    <dd>preserved</dd>
                </div>
                <div>
                    <dt>VisualElement</dt>
                    <dd>live</dd>
                </div>
                <div>
                    <dt>Live state</dt>
                    <dd>preserved</dd>
                </div>
                <div>
                    <dt>Re-entry</dt>
                    <dd>same node reverses</dd>
                </div>
            </dl>
        </section>
    </div>

    <footer>
        <span>NEW API</span>
        <code>&lt;AnimatePresence present={'{visible}'}&gt; {'{#snippet child()}'}…</code>
    </footer>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #070a0d;
        color: #f5f5f0;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    }

    :global(*) {
        box-sizing: border-box;
    }

    main {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 48px 0 72px;
    }

    header {
        position: relative;
        padding: 32px;
        border: 1px solid #343a40;
        background: linear-gradient(135deg, rgba(45, 212, 191, 0.08), transparent 48%), #0d1115;
        box-shadow: 8px 8px 0 #000;
    }

    .issue-tag {
        position: absolute;
        top: 16px;
        right: 16px;
        border: 1px solid #4b5563;
        padding: 5px 8px;
        color: #9ca3af;
        font-family: ui-monospace, monospace;
        font-size: 0.65rem;
        letter-spacing: 0.12em;
    }

    h1,
    h2,
    p {
        margin-top: 0;
    }

    h1 {
        max-width: 760px;
        margin-bottom: 18px;
        font-size: clamp(2.5rem, 7vw, 5.75rem);
        font-weight: 800;
        letter-spacing: -0.065em;
        line-height: 0.88;
    }

    h1 span {
        color: #64748b;
        font-family: ui-serif, Georgia, serif;
        font-style: italic;
        font-weight: 400;
    }

    .eyebrow,
    .figure,
    .mechanism,
    output,
    footer {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        text-transform: uppercase;
    }

    .eyebrow {
        margin-bottom: 18px;
        color: #2dd4bf;
        font-size: 0.72rem;
        letter-spacing: 0.16em;
    }

    .intro {
        max-width: 760px;
        margin-bottom: 24px;
        color: #aab3bd;
        font-size: 1rem;
        line-height: 1.65;
    }

    .remove-contract {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        margin-bottom: 24px;
        border: 1px solid #343a40;
        background: #343a40;
    }

    .remove-contract div {
        padding: 14px 16px;
        background: #0a0e12;
    }

    .remove-contract span {
        color: #d5dde5;
        font-family: ui-monospace, monospace;
        font-size: 0.64rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .remove-contract div:first-child span {
        color: #fda4af;
    }

    .remove-contract div:last-child span {
        color: #5eead4;
    }

    .remove-contract p {
        margin: 7px 0 0;
        color: #8e99a5;
        font-size: 0.76rem;
        line-height: 1.5;
    }

    button {
        border: 1px solid #56606a;
        background: #171c21;
        color: #f8fafc;
        padding: 10px 14px;
        font: inherit;
        cursor: pointer;
    }

    button:hover {
        border-color: #2dd4bf;
    }

    button.primary {
        border-color: #2dd4bf;
        background: #2dd4bf;
        color: #07110f;
        font-weight: 750;
    }

    .global-controls,
    .lane-controls {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .decisive-test {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 14px;
        margin-top: 18px;
        border-left: 3px solid #facc15;
        background: rgba(250, 204, 21, 0.08);
        padding: 12px 14px;
    }

    .decisive-test span {
        color: #fde047;
        font-size: 0.65rem;
        font-weight: 750;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .decisive-test p {
        margin: 0;
        color: #d5d9de;
        font-size: 0.76rem;
        line-height: 1.55;
    }

    .comparison-grid {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 22px;
        margin-top: 28px;
    }

    .lane {
        min-width: 0;
        border: 1px solid #343a40;
        background: #0d1115;
        box-shadow: 6px 6px 0 #000;
    }

    .lane-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 20px;
        border-bottom: 1px solid #343a40;
    }

    .figure {
        color: #7d8791;
        font-size: 0.62rem;
        letter-spacing: 0.14em;
    }

    h2 {
        margin-bottom: 0;
        font-size: clamp(1.5rem, 3vw, 2.2rem);
        letter-spacing: -0.04em;
    }

    .legacy h2 {
        color: #fda4af;
    }

    .owned h2 {
        color: #5eead4;
    }

    .mechanism {
        border: 1px solid #4b5563;
        padding: 5px 7px;
        color: #b3bdc7;
        font-size: 0.58rem;
        letter-spacing: 0.08em;
        white-space: nowrap;
    }

    .stage {
        position: relative;
        min-height: 310px;
        display: grid;
        place-items: center;
        overflow: hidden;
        background: #090d10;
    }

    .stage-grid {
        position: absolute;
        inset: 0;
        opacity: 0.18;
        background-image:
            linear-gradient(#53606a 1px, transparent 1px),
            linear-gradient(90deg, #53606a 1px, transparent 1px);
        background-size: 24px 24px;
        mask-image: linear-gradient(to bottom, black, transparent);
    }

    :global(.card) {
        position: relative;
        z-index: 1;
        width: min(230px, calc(100% - 44px));
        display: grid;
        gap: 14px;
        border: 1px solid;
        padding: 18px;
        box-shadow: 7px 7px 0 #000;
    }

    :global(.legacy-card) {
        border-color: #fb7185;
        background: #281319;
    }

    :global(.owned-card) {
        border-color: #2dd4bf;
        background: #0d2523;
    }

    .card-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: ui-monospace, monospace;
        font-size: 0.62rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .card-topline i {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: currentColor;
        box-shadow: 0 0 14px currentColor;
    }

    .fake-signal {
        height: 54px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 5px;
        padding: 6px 9px;
        border: 1px solid rgba(251, 113, 133, 0.35);
        background: rgba(251, 113, 133, 0.08);
    }

    .fake-signal b {
        width: 100%;
        background: #fb7185;
    }

    canvas {
        width: 100%;
        height: 54px;
        border: 1px solid rgba(45, 212, 191, 0.45);
    }

    label {
        display: grid;
        gap: 5px;
        font-family: ui-monospace, monospace;
        font-size: 0.62rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    input {
        min-width: 0;
        border: 1px solid currentColor;
        background: #080b0e;
        color: #f8fafc;
        padding: 8px;
        font: inherit;
        text-transform: none;
    }

    .exit-marker {
        position: absolute;
        right: 12px;
        bottom: 12px;
        border: 1px solid #4b5563;
        background: rgba(7, 10, 13, 0.88);
        padding: 5px 7px;
        color: #8e99a5;
        font-family: ui-monospace, monospace;
        font-size: 0.58rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .lane-controls {
        justify-content: space-between;
        padding: 14px 16px;
        border-top: 1px solid #343a40;
        border-bottom: 1px solid #343a40;
    }

    output {
        color: #929da8;
        font-size: 0.62rem;
    }

    .focus-proof {
        display: grid;
        gap: 8px;
        padding: 12px 16px;
        border-bottom: 1px solid #343a40;
        background: #090d10;
    }

    .focus-proof p {
        margin: 0;
        color: #929da8;
        font-family: ui-monospace, monospace;
        font-size: 0.68rem;
        line-height: 1.5;
    }

    .focus-proof kbd {
        border: 1px solid #56606a;
        border-bottom-width: 2px;
        background: #171c21;
        padding: 1px 5px;
        color: #f8fafc;
        font: inherit;
    }

    .focus-proof output {
        width: fit-content;
        border: 1px solid currentColor;
        padding: 5px 7px;
        letter-spacing: 0.06em;
    }

    .legacy .focus-proof output {
        color: #fda4af;
    }

    .owned .focus-proof output {
        color: #5eead4;
    }

    dl {
        margin: 0;
        padding: 12px 16px 16px;
    }

    dl div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 7px 0;
        border-bottom: 1px dotted #343a40;
        font-family: ui-monospace, monospace;
        font-size: 0.68rem;
    }

    dt {
        color: #7d8791;
    }

    dd {
        margin: 0;
        text-align: right;
    }

    .legacy dd {
        color: #fda4af;
    }

    .owned dd {
        color: #5eead4;
    }

    .versus {
        position: absolute;
        z-index: 5;
        top: 282px;
        left: 50%;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border: 1px solid #64748b;
        border-radius: 50%;
        background: #070a0d;
        color: #cbd5e1;
        font-family: ui-monospace, monospace;
        font-size: 0.7rem;
        transform: translate(-50%, -50%) rotate(-8deg);
    }

    footer {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-top: 28px;
        border: 1px solid #2dd4bf;
        background: #0b1f1d;
        padding: 15px 18px;
        color: #5eead4;
        font-size: 0.68rem;
        letter-spacing: 0.08em;
        overflow-x: auto;
    }

    footer span {
        flex: 0 0 auto;
        border-right: 1px solid #2dd4bf;
        padding-right: 16px;
        font-weight: 800;
    }

    footer code {
        color: #d5fffa;
        white-space: nowrap;
    }

    @media (max-width: 760px) {
        header {
            padding: 26px 20px;
        }

        .issue-tag {
            position: static;
            width: fit-content;
            margin-bottom: 24px;
        }

        .comparison-grid {
            grid-template-columns: 1fr;
        }

        .remove-contract {
            grid-template-columns: 1fr;
        }

        .decisive-test {
            grid-template-columns: 1fr;
        }

        .versus {
            display: none;
        }

        .global-controls,
        .lane-controls {
            align-items: stretch;
            flex-direction: column;
        }

        .global-controls button,
        .lane-controls button {
            width: 100%;
        }
    }
</style>
