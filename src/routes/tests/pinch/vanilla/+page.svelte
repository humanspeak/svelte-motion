<script lang="ts">
    import { resolve } from '$app/paths'
    import { animate, drag, pinch, type PinchInfo } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Motion 14.11's vanilla `pinch()`, re-exported unwrapped from Motion.
     *
     * A port of upstream's fixture `dev/html/public/playwright/gestures/pinch.html`
     * (Motion v14.12.0), driven by `e2e/pinch/vanilla.spec.ts`. The 100x100 box
     * sits at viewport (100, 100); nothing else may cover (0, 0)-(450, 450),
     * because the spec's touch coordinates assume it.
     *
     * Query params, as upstream:
     * - `rotate`: also rotate with the touches.
     * - `pan=false`: don't move with the touches.
     * - `min`, `max`: scale limits.
     * - `drag`: also attach `drag(box, { momentum: false })`.
     * - `returns`: what the start callback returns: `object` (default),
     *   `function` or `none`.
     *
     * It records `window.events` (`"start"`, then `"end:" + event.type`),
     * `window.lastInfo`, `window.startArgs` and `window.stopPinch`.
     */
    type PinchWindow = Window & {
        events: string[]
        lastInfo: PinchInfo | null
        startArgs: { isBox: boolean; type: string }[]
        stopPinch?: VoidFunction
    }

    let box = $state<HTMLElement | null>(null)
    let isTester = $state(false)
    let log = $state<string[]>([])
    let info = $state<PinchInfo | null>(null)
    let mode = $state('')

    const page = resolve('/tests/pinch/vanilla')

    const reset = () => {
        if (box) animate(box, { scale: 1, rotate: 0, x: 0, y: 0 }, { duration: 0 })
        log = []
        info = null
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!box) return
        const element = box
        const w = window as unknown as PinchWindow

        const params = new URLSearchParams(window.location.search)
        const num = (name: string) => {
            const value = params.get(name)
            return value === null ? undefined : parseFloat(value)
        }
        const returns = params.get('returns') || 'object'
        mode = [...params.keys()].filter((key) => key !== '@isPlaywright').join(', ')

        w.events = []
        w.lastInfo = null
        w.startArgs = []

        const record = (entry: string) => {
            w.events.push(entry)
            log = [...log, entry]
        }
        const setInfo = (next: PinchInfo) => {
            w.lastInfo = next
            info = next
        }

        const stops: VoidFunction[] = []
        if (params.has('drag')) stops.push(drag(element, { momentum: false }))

        w.stopPinch = pinch(
            element,
            (target, startEvent) => {
                record('start')
                w.startArgs.push({ isBox: target === element, type: startEvent.type })

                const onComplete = (event: Event, last: PinchInfo) => {
                    record('end:' + event.type)
                    setInfo(last)
                }

                if (returns === 'function') return onComplete
                if (returns === 'object') {
                    return {
                        onPinch: (_: Event, next: PinchInfo) => setInfo(next),
                        onComplete
                    }
                }
            },
            {
                rotate: params.has('rotate'),
                pan: params.get('pan') !== 'false',
                scale: { min: num('min'), max: num('max') }
            }
        )
        stops.push(w.stopPinch)

        return () => stops.forEach((stop) => stop())
    })

    const open = (query: string) => () => window.location.assign(page + query)

    const steps: TesterStep[] = [
        {
            text: 'On a trackpad, put the cursor over the box and pinch outward.',
            expected:
                'The box grows around the cursor; the page itself does not zoom. The log shows start, then end:wheel.',
            action: { label: 'Open default', run: open('') }
        },
        {
            text: 'On a touch screen (or Chrome DevTools device mode with shift-drag), spread two fingers on the box.',
            expected: 'The box scales around the point between the fingers and follows them.'
        },
        {
            text: 'Open ?rotate and twist two fingers. A Mac trackpad in Chrome reports no rotation; rotation needs touches or Safari.',
            expected: 'The box rotates with the fingers.',
            action: { label: 'Open ?rotate', run: open('?rotate') }
        },
        {
            text: 'Open ?drag, drag the box with one finger, add a second finger and pinch, lift the second finger and keep dragging.',
            expected: 'No jump when the pinch starts or ends.',
            action: { label: 'Open ?drag', run: open('?drag') }
        },
        {
            text: 'Open ?min=0.5&max=2 and pinch far past the limit, then let go.',
            expected: 'The box resists past 2× and springs back to 2×.',
            action: { label: 'Open ?min=0.5&max=2', run: open('?min=0.5&max=2') }
        }
    ]
</script>

<svelte:head>
    <title>pinch() — vanilla pinch on a plain element</title>
</svelte:head>

<div id="box" data-testid="box" bind:this={box}></div>

{#if isTester}
    <aside class="readout">
        <p class="kicker">pinch() · Motion 14.11</p>
        <h1>Vanilla pinch on a plain element.</h1>
        <p class="mode">mode: <code>{mode || 'default'}</code></p>

        <nav class="links">
            <a href={page} data-sveltekit-reload>default</a>
            <a href={page + '?rotate'} data-sveltekit-reload>?rotate</a>
            <a href={page + '?drag'} data-sveltekit-reload>?drag</a>
            <a href={page + '?min=0.5&max=2'} data-sveltekit-reload>?min=0.5&amp;max=2</a>
        </nav>

        <button type="button" onclick={reset}>Reset</button>

        <dl data-testid="info">
            <dt>scale</dt>
            <dd>{info ? info.scale.toFixed(3) : '—'}</dd>
            <dt>rotate</dt>
            <dd>{info ? `${info.rotate.toFixed(1)}°` : '—'}</dd>
            <dt>offset</dt>
            <dd>{info ? `${info.offset.x.toFixed(1)}, ${info.offset.y.toFixed(1)}` : '—'}</dd>
        </dl>

        <ol class="log" data-testid="log">
            {#each log as entry, i (i)}
                <li>{entry}</li>
            {/each}
        </ol>
    </aside>
{/if}

<TesterPanel
    eyebrow="tests/gestures/pinch.spec.ts"
    title="Vanilla pinch()"
    status="Expected to pass on this build: the box follows every pinch without a jump."
    {steps}
>
    {#snippet checks()}
        <p>
            <code>pinch()</code> scales, rotates and moves a plain element with two touches, a
            trackpad pinch (ctrl + wheel) or Safari's gesture events. svelte-motion re-exports
            Motion's own binding unchanged; this page is a port of upstream's
            <code>pinch.html</code> fixture with the same query links.
        </p>
    {/snippet}
</TesterPanel>

<style>
    #box {
        position: fixed;
        top: 100px;
        left: 100px;
        width: 100px;
        height: 100px;
        background-color: red;
    }

    .readout {
        position: fixed;
        top: 24px;
        left: 480px;
        display: grid;
        gap: 12px;
        width: 280px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
    }

    .kicker {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.6;
    }

    h1 {
        font-size: 18px;
    }

    .links {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .links a {
        color: #2563eb;
        text-decoration: underline;
    }

    button {
        justify-self: start;
        padding: 4px 12px;
        border-radius: 8px;
        border: 1px solid currentColor;
    }

    dl {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 12px;
        font-family: monospace;
    }

    .log {
        max-height: 240px;
        overflow: auto;
        padding-left: 20px;
        font-family: monospace;
        list-style: decimal;
    }
</style>
