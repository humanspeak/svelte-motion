<script lang="ts">
    import { animate } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Motion 14.12: a spring set with `visualDuration` (and `bounce`) now
    // starts with the velocity of the animation it interrupts, as physics
    // (`stiffness`/`damping`) springs always did. A `duration` spring still
    // starts from rest so it ends exactly on time. Port of upstream
    // `dev/html/public/playwright/animate/animate-time-spring-velocity.html`
    // and `tests/animate/time-spring-velocity.spec.ts` at v14.12.0.

    type SpringTransition = Record<string, string | number>
    // `atReverse` is read synchronously right after the reversing `animate()`:
    // the interrupted animation's `stop()` catches its value up to the moment
    // of the interrupt (Motion 14.12), so this is where the reversing spring
    // starts. `before` is the last painted frame, which can be behind it.
    type ValueResult = { before: number; atReverse: number; after: number; final: number }
    type RunResult = { opacity: ValueResult; x: ValueResult }
    type RunWindow = { run?: (transition: SpringTransition) => Promise<RunResult> }

    type RowId = 'physics' | 'visual' | 'duration'
    type Row = { id: RowId; label: string; color: string; transition: SpringTransition }

    const rows: Row[] = [
        {
            id: 'physics',
            label: 'Physics (stiffness 200, damping 20)',
            color: '#2563eb',
            transition: { type: 'spring', stiffness: 200, damping: 20 }
        },
        {
            id: 'visual',
            label: 'visualDuration 0.5, bounce 0.2',
            color: '#e11d48',
            transition: { type: 'spring', visualDuration: 0.5, bounce: 0.2 }
        },
        {
            id: 'duration',
            label: 'duration 0.8',
            color: '#22aa66',
            transition: { type: 'spring', duration: 0.8 }
        }
    ]

    const boxes: Partial<Record<RowId, HTMLDivElement>> = {}
    const tracks: Partial<Record<RowId, HTMLDivElement>> = {}
    let verdicts = $state<Record<RowId, string>>({ physics: '—', visual: '—', duration: '—' })

    const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

    const readX = (element: Element) => new DOMMatrix(getComputedStyle(element).transform).m41
    const read = {
        opacity: (element: Element) => parseFloat(getComputedStyle(element).opacity),
        x: readX
    }
    const targets = { opacity: [1, 0], x: [1000, 0] } as const

    const goRight = (row: Row) => {
        const box = boxes[row.id]
        if (!box) return
        verdicts[row.id] = '—'
        // To the end of the track, however wide the screen: 540px on a
        // desktop, less on a phone, where the track shrinks to fit.
        const track = tracks[row.id]
        const distance = track ? track.clientWidth - box.offsetWidth : 500
        animate(box, { x: distance }, row.transition)
    }

    const reverse = async (row: Row) => {
        const box = boxes[row.id]
        if (!box) return
        // Measure from where the reversing spring starts, not the last painted
        // frame: interrupting catches the value up to now, so a spring from
        // rest can still sit right of the last frame after it turns back.
        animate(box, { x: 0 }, row.transition)
        const atReverse = readX(box)
        // Take the furthest point over the first two frames: a physics spring
        // reversed late in its run carries little velocity, so it can peak
        // past `atReverse` in the first frame and be back by the second. A
        // spring from rest never gets past `atReverse` at all.
        let furthest = -Infinity
        for (let i = 0; i < 2; i++) {
            await nextFrame()
            furthest = Math.max(furthest, readX(box))
        }
        verdicts[row.id] = furthest > atReverse ? 'kept moving right' : 'turned back at once'
    }

    onMount(() => {
        const win = window as unknown as RunWindow

        // The automation stage lives outside Svelte's tree (as upstream's
        // fixture appends to `document.body`), so the elements `run` creates
        // never touch DOM that Svelte manages.
        const stage = document.createElement('div')
        stage.dataset.testid = 'stage'
        stage.style.position = 'relative'
        document.body.append(stage)

        /**
         * Starts a spring towards a target, then reverses it mid-flight. If the
         * reversed spring inherits the first one's velocity, the value keeps
         * moving towards the first target for a while.
         */
        win.run = async (transition) => {
            const results = {} as RunResult

            for (const name of ['opacity', 'x'] as const) {
                const element = document.createElement('div')
                element.style.cssText = 'width:100px;height:100px;background:red;opacity:0'
                stage.append(element)

                const [to, back] = targets[name]
                animate(element, { [name]: to }, transition)
                await wait(100)

                const before = read[name](element)
                const animation = animate(element, { [name]: back }, transition)
                const atReverse = read[name](element)
                await wait(32)
                const after = read[name](element)
                await animation

                results[name] = { before, atReverse, after, final: read[name](element) }
                element.remove()
            }

            return results
        }

        return () => {
            delete win.run
            stage.remove()
        }
    })

    const steps: TesterStep[] = [
        {
            text: "Click 'Go right' on the visualDuration row, then 'Reverse' while it is still moving fast.",
            expected:
                'The box keeps drifting right for a moment, then curves back. Verdict: kept moving right.'
        },
        {
            text: 'Do the same on the physics row.',
            expected: 'Same feel as the visualDuration row.'
        },
        {
            text: 'Do the same on the duration row.',
            expected:
                'The box turns back at once: a duration spring starts from rest so it ends exactly on time. Verdict: turned back at once.'
        }
    ]
</script>

<svelte:head>
    <title>Springs carry velocity through an interrupt</title>
</svelte:head>

<main class="spring-velocity">
    {#each rows as row (row.id)}
        <section>
            <h2>{row.label}</h2>
            <div class="track" bind:this={tracks[row.id]}>
                <div
                    bind:this={boxes[row.id]}
                    class="box"
                    data-testid="box-{row.id}"
                    style="background-color: {row.color};"
                ></div>
            </div>
            <div class="controls">
                <button data-testid="go-{row.id}" onclick={() => goRight(row)}>Go right</button>
                <button data-testid="reverse-{row.id}" onclick={() => reverse(row)}>Reverse</button>
                <span>
                    verdict: <strong data-testid="verdict-{row.id}">{verdicts[row.id]}</strong>
                </span>
            </div>
        </section>
    {/each}
</main>

<TesterPanel
    eyebrow="time-spring-velocity.spec.ts"
    title="Springs carry velocity through an interrupt"
    {steps}
>
    {#snippet checks()}
        <p>
            A spring set with <code>visualDuration</code> or <code>stiffness</code>/<code
                >damping</code
            > starts with the velocity of the animation it interrupts. Before Motion 14.12 the visualDuration
            row behaved like the duration row and turned back at once.
        </p>
    {/snippet}
</TesterPanel>

<style>
    /* The layout centres this in a flex row, so it would otherwise shrink to
       its content and squeeze the track: a 600px track on a desktop, the full
       width less padding on a phone. */
    main {
        display: flex;
        flex-direction: column;
        gap: 2rem;
        box-sizing: border-box;
        width: min(100%, calc(600px + 4rem));
        padding: 2rem;
    }
    section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    h2 {
        font-size: 1rem;
        font-weight: 600;
    }
    .track {
        position: relative;
        width: min(600px, 100%);
        height: 60px;
        border-radius: 12px;
        background: rgba(148, 163, 184, 0.2);
    }
    .box {
        width: 60px;
        height: 60px;
        border-radius: 12px;
    }
    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
    }
    button {
        padding: 0.25rem 0.75rem;
        border: 1px solid currentColor;
        border-radius: 6px;
        cursor: pointer;
    }
    /* Phone width (an iOS Simulator): no sideways scroll. */
    @media (max-width: 640px) {
        main {
            padding: 1rem;
        }
    }
</style>
