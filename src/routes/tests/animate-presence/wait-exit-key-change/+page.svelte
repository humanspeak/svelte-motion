<script lang="ts">
    import { page } from '$app/state'
    import { AnimatePresence, MotionDiv } from '$lib/index.js'

    const form = page.url.searchParams.get('form') === 'variant' ? 'variant' : 'object'
    const variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    let requestedKey = $state(0)
    let callbackCount = $state(0)
    let events = $state('initial:0')
    let generation = $state(0)
    let ignoredGenerations = $state<number[]>([])
    let armed = false

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

<main style="padding: 2rem;">
    <h1>Wait mode: key change at exit completion</h1>
    <p>
        Click Run to request key 1 while key 0 exits. The aggregate AnimatePresence onExitComplete
        callback supersedes key 1 with key 2. Only key 2 should remain fully visible. Clone exits do
        not forward the original element's onAnimationComplete callback.
    </p>
    <p>Animation form: <code>{form}</code></p>
    <button id="run" onclick={run} disabled={requestedKey !== 0}>Run</button>
    <button id="reset" onclick={reset}>Reset</button>
    <p>Requested key: <span id="state">{requestedKey}</span></p>
    <p>Armed completion callbacks: <span id="callback-count">{callbackCount}</span></p>
    <p>Generation: <span id="generation">{generation}</span></p>
    <p>
        Ignored completion generations: <span id="ignored-generations"
            >{ignoredGenerations.join(',')}</span
        >
    </p>
    <p id="events">{events}</p>
    <div id="scenario">
        {#key scenario.generation}
            <AnimatePresence mode="wait" initial={false} onExitComplete={scenario.onExitComplete}>
                {#key requestedKey}
                    <MotionDiv
                        key={requestedKey}
                        id={`child-${requestedKey}`}
                        class="scenario-child"
                        variants={form === 'variant' ? variants : undefined}
                        initial={form === 'variant' ? 'hidden' : { opacity: 0 }}
                        animate={form === 'variant' ? 'visible' : { opacity: 1 }}
                        exit={form === 'variant' ? 'hidden' : { opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'linear' }}
                        style="width: 150px; height: 150px; background: royalblue; color: white; display: grid; place-items: center;"
                    >
                        Child {requestedKey}
                    </MotionDiv>
                {/key}
            </AnimatePresence>
        {/key}
    </div>
</main>
