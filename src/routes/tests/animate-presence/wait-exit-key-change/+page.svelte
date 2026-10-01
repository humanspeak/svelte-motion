<script lang="ts">
    import { page } from '$app/state'
    import { resolve } from '$app/paths'
    import { AnimatePresence, MotionDiv } from '$lib/index.js'
    import '../boundary-teardown/demo.css'

    const form = page.url.searchParams.get('form') === 'variant' ? 'variant' : 'object'
    const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    const cardColors = ['#4064d9', '#7950de', '#247c63']
    let requestedKey = $state(0)
    let callbackCount = $state(0)
    let events = $state('initial:0')
    let generation = $state(0)
    let ignoredGenerations = $state<number[]>([])
    let armed = false
    const status = $derived(
        requestedKey === 0
            ? 'Ready to run'
            : requestedKey === 1
              ? 'Card 0 is leaving'
              : 'Card 2 wins'
    )

    const createScenario = (id: number) => ({
        generation: id,
        onExitComplete: () => {
            if (id !== generation) {
                ignoredGenerations = [...ignoredGenerations, id]
                return
            }
            if (!armed) return
            armed = false
            callbackCount += 1
            events += `|exit-complete:generation-${id}:requested-${requestedKey}|requested:2`
            requestedKey = 2
        }
    })
    let scenario = $state(createScenario(0))

    const run = () => {
        if (requestedKey !== 0) return
        armed = true
        events += '|requested:1'
        requestedKey = 1
    }

    const reset = () => {
        armed = false
        generation += 1
        scenario = createScenario(generation)
        ignoredGenerations = []
        requestedKey = 0
        callbackCount = 0
        events = 'initial:0'
    }
</script>

<svelte:head>
    <title>Wait mode: the latest card wins</title>
</svelte:head>

<main class="teardown-lab wait-lab">
    <header class="lab-header">
        <a class="back-link" href={resolve('/')}>← All demos</a>
        <p class="eyebrow">Exit lab / wait mode</p>
        <h1>The latest card wins.</h1>
        <p class="lede">One card leaves. A newer choice takes its place.</p>
        <p class="explanation">
            Wait mode lets the outgoing card finish before the next one appears. Here, card 1 is
            requested first, but the choice changes to card 2 as the exit finishes. Card 2 should
            win.
        </p>
    </header>

    <div class="lab-grid">
        <section class="demo-panel" aria-label="Wait mode card demo">
            <div class="panel-heading">
                <div>
                    <p class="eyebrow">Live demo</p>
                    <h2>Watch the handoff</h2>
                </div>
                <span class="status" aria-live="polite">{status}</span>
            </div>
            <div class="sequence" aria-label="Card selection sequence">
                <div class:active={requestedKey === 0}>
                    <span>0</span><small>Starting card</small>
                </div>
                <span class="sequence-arrow" aria-hidden="true">→</span>
                <div class:active={requestedKey === 1}>
                    <span>1</span><small>First request</small>
                </div>
                <span class="sequence-arrow" aria-hidden="true">→</span>
                <div class:active={requestedKey === 2}>
                    <span>2</span><small>Latest choice</small>
                </div>
            </div>
            <div id="scenario" class="wait-stage">
                {#key scenario.generation}
                    <AnimatePresence
                        mode="wait"
                        initial={false}
                        onExitComplete={scenario.onExitComplete}
                    >
                        {#key requestedKey}
                            <MotionDiv
                                key={requestedKey}
                                id={`child-${requestedKey}`}
                                class="scenario-child"
                                variants={form === 'variant' ? variants : undefined}
                                initial={form === 'variant' ? 'hidden' : { opacity: 0 }}
                                animate={form === 'variant' ? 'visible' : { opacity: 1 }}
                                exit={form === 'variant' ? 'hidden' : { opacity: 0 }}
                                transition={{ duration: 0.9, ease: 'linear' }}
                                style={{ backgroundColor: cardColors[requestedKey] }}
                            >
                                <span class="card-caption"
                                    >{requestedKey === 0
                                        ? 'Starting point'
                                        : requestedKey === 1
                                          ? 'First request'
                                          : 'Latest choice'}</span
                                >
                                <strong>Child {requestedKey}</strong>
                                <p>
                                    {requestedKey === 0
                                        ? 'Ready for a new choice.'
                                        : requestedKey === 1
                                          ? 'Waiting for the outgoing card.'
                                          : 'The newest choice is here.'}
                                </p>
                            </MotionDiv>
                        {/key}
                    </AnimatePresence>
                {/key}
            </div>
            <div class="demo-controls">
                <button id="run" class="primary" onclick={run} disabled={requestedKey !== 0}
                    >Run sequence</button
                >
                <button id="reset" onclick={reset}>Reset</button>
            </div>
            <div class="demo-readout">
                <p>Selected card: <span id="state">{requestedKey}</span></p>
                <p>Completions this run: <span id="callback-count">{callbackCount}</span></p>
            </div>
            <p class="mode-note">Reset cancels the old run immediately and brings back card 0.</p>
        </section>

        <aside class="guide-panel" aria-label="What to try">
            <p class="eyebrow">What to try</p>
            <ol class="steps">
                <li>
                    <span class="step-number">01</span>
                    <div>
                        <h2>Run the sequence</h2>
                        <p>
                            Press <strong>Run sequence</strong>. The blue card fades out. Card 1 is
                            queued, then card 2 becomes the newest choice.
                        </p>
                    </div>
                </li>
                <li>
                    <span class="step-number">02</span>
                    <div>
                        <h2>Check the result</h2>
                        <p>
                            The green <strong>Child 2</strong> card should be the only card left. The
                            completion count should be 1.
                        </p>
                    </div>
                </li>
                <li>
                    <span class="step-number">03</span>
                    <div>
                        <h2>Interrupt and try again</h2>
                        <p>
                            Reset, run, then press <strong>Reset</strong> while the blue card fades. Card
                            0 should return immediately. Run again: the old run must not interfere.
                        </p>
                    </div>
                </li>
            </ol>
            <div class="expected-result">
                <span aria-hidden="true">✓</span>
                <p>The newest card wins, and a reset gives you a clean start.</p>
            </div>
        </aside>
    </div>

    <details class="debug-panel">
        <summary>Animation details and event log</summary>
        <p>
            This demo uses <code>{form}</code> animation definitions and
            <code>AnimatePresence mode="wait"</code>.
        </p>
        <p>Run generation: <span id="generation">{generation}</span></p>
        <p>
            Ignored completion generations: <span id="ignored-generations"
                >{ignoredGenerations.join(',')}</span
            >{#if ignoredGenerations.length === 0}<span class="no-stale-callbacks"
                    >None — cancelled runs did not call back.</span
                >{/if}
        </p>
        <p id="events" class="event-log">{events}</p>
        <p class="technical-note">
            The boundary's onExitComplete requests card 2 when the first exit finishes. Clone exits
            do not call the original element's onAnimationComplete.
        </p>
    </details>
</main>

<style>
    .sequence {
        display: flex;
        justify-content: center;
        gap: 18px;
        align-items: flex-start;
        padding: 4px 22px 20px;
    }
    .sequence > div {
        text-align: center;
        color: #8190ab;
    }
    .sequence > div > span {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        margin: 0 auto 7px;
        border: 1px solid #36415a;
        border-radius: 50%;
        font-family: ui-monospace, monospace;
    }
    .sequence > div.active {
        color: #dfd3ff;
    }
    .sequence > div.active > span {
        background: #593d8e;
        border-color: #a385ea;
    }
    .sequence small {
        font-size: 0.64rem;
    }
    .sequence-arrow {
        padding-top: 8px;
        color: #596883;
    }
    .wait-stage {
        display: grid;
        place-items: center;
        min-height: 260px;
        padding: 25px;
        background: radial-gradient(ellipse at center, #242c48, #111722 80%);
    }
    :global(.wait-lab .scenario-child) {
        display: flex;
        flex-direction: column;
        justify-content: center;
        width: 230px;
        height: 180px;
        padding: 24px;
        border: 1px solid #ffffff50;
        border-radius: 16px;
        box-shadow: 0 16px 40px #0004;
        color: white;
    }
    .card-caption {
        font-size: 0.64rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: #edf0ff;
    }
    .wait-lab strong {
        font-size: 1.4rem;
    }
    .wait-lab .steps strong {
        font-size: inherit;
    }
    :global(.wait-lab .scenario-child) p {
        margin-top: 10px;
        font-size: 0.8rem;
        line-height: 1.5;
        color: #edf0ff;
    }
    .expected-result {
        display: flex;
        gap: 12px;
        padding: 16px;
        border: 1px solid #426650;
        border-radius: 10px;
        background: #192b23;
        color: #c7f4d4;
    }
    .expected-result p {
        font-size: 0.8rem;
        line-height: 1.6;
    }
    .wait-lab .demo-readout span {
        color: #d2c2ff;
        font-family: ui-monospace, monospace;
    }
    .debug-panel {
        margin-top: 22px;
        padding: 18px 22px;
        border: 1px solid #293349;
        border-radius: 12px;
        background: #111722;
        color: #98a7c0;
    }
    .debug-panel summary {
        cursor: pointer;
        font-size: 0.8rem;
        color: #c5d0e6;
    }
    .debug-panel p {
        margin-top: 14px;
        font-size: 0.75rem;
        line-height: 1.6;
    }
    .debug-panel code,
    .event-log {
        font-family: ui-monospace, monospace;
    }
    .event-log {
        overflow-wrap: anywhere;
        color: #b5a4ed;
    }
    .no-stale-callbacks {
        color: #97cdb5;
    }
    .debug-panel .technical-note {
        color: #8190ab;
    }
    @media (max-width: 420px) {
        .sequence {
            gap: 10px;
        }
    }
</style>
