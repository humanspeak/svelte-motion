<script lang="ts">
    /**
     * Layout velocity (Motion 14.13) across a `layoutId` handoff: a card
     * thrown with `drag` becomes a detail view with the same `layoutId`, down
     * and to the left. With a spring, the detail view starts with the throw's
     * velocity, so it keeps moving right for a few frames first. A Svelte port
     * of upstream's `dev/react/src/tests/layout-velocity-drag-layout-id.tsx`
     * and, with `?resize`, `layout-velocity-throw-resize.tsx` @ `v14.14.0`
     * (PR #4047), driven by `e2e/layout-id/throw.spec.ts`.
     *
     * - `?tween`: a tween, which takes no velocity and starts from rest.
     * - `?resize`: the detail view is 400px wide, on a `mass: 'auto'` spring.
     *   Its width must only travel from 100px to 400px.
     *
     * Svelte deviations: the fixture sits in a `position: absolute` wrapper at
     * the page's top left (the test harness centres its content), and the
     * tester panel adds Throw / Reset buttons.
     *
     * @component
     */
    import { page } from '$app/state'
    import { resolve } from '$app/paths'
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import { onPaintedFrame } from '../../independent-transforms/_paintedFrames'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    const params = page.url.searchParams
    const resize = params.has('resize')
    const transition = params.has('tween')
        ? { duration: 0.8 }
        : resize
          ? { type: 'spring' as const, visualDuration: 0.45, bounce: 0, mass: 'auto' as const }
          : { type: 'spring' as const, visualDuration: 0.8, bounce: 0 }

    let open = $state(false)

    const base = resolve('/tests/layout-id/throw')
    const fixtures = ['', '?tween', '?resize']
    const showing = params.has('tween') ? '?tween' : resize ? '?resize' : '(default)'

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    /** The red card's left edge on its last painted frame. */
    let redLast = $state<number | null>(null)
    /** The blue card's left edge on its first painted frame. */
    let blueFirst = $state<number | null>(null)

    const dispatchPointer = (type: string, x: number, y: number) => {
        const target = type === 'pointerdown' ? document.getElementById('box')! : window
        target.dispatchEvent(
            new PointerEvent(type, {
                clientX: x,
                clientY: y,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
                button: 0,
                buttons: type === 'pointerup' ? 0 : 1,
                bubbles: true,
                cancelable: true
            })
        )
    }
    const afterFrame = () => new Promise<void>((done) => requestAnimationFrame(() => done()))

    /** Upstream's `throwCard`: a fast flick to the right, released while moving. */
    const throwCard = async () => {
        if (open) return
        const y = 150
        const xs = resize ? [400, 440, 480, 520] : [380, 400, 420, 440]
        dispatchPointer('pointerdown', 350, y)
        dispatchPointer('pointermove', 360, y)
        await afterFrame()
        await new Promise((done) => setTimeout(done, 50))
        for (const x of xs) {
            dispatchPointer('pointermove', x, y)
            await afterFrame()
        }
        dispatchPointer('pointerup', xs[xs.length - 1], y)
    }

    const reset = () => {
        open = false
        redLast = null
        blueFirst = null
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return
        return onPaintedFrame(() => {
            const box = document.getElementById('box')
            if (!box) return
            const left = box.getBoundingClientRect().left
            if (box.style.backgroundColor === 'blue') {
                blueFirst ??= left
            } else {
                redLast = left
            }
        })
    })

    const steps: TesterStep[] = [
        {
            text: 'Drag the red card to the right and release while moving (or click Throw).',
            expected: params.has('tween')
                ? 'The blue card starts where the red one was and travels straight down and left (a tween starts from rest).'
                : resize
                  ? 'The blue card keeps moving right for a moment before it travels down and left, and its width only grows from 100px to 400px.'
                  : 'The blue card keeps moving right for a moment before it travels down and left.',
            action: { label: 'Throw', run: () => void throwCard() }
        },
        {
            text: 'Click Reset to bring the red card back.',
            expected: 'The red card is back at the top. Throw it again to repeat.',
            action: { label: 'Reset', run: reset }
        }
    ]
</script>

<svelte:head>
    <title>layoutId · a thrown card hands its velocity on (Motion 14.13)</title>
</svelte:head>

<div class="fixture">
    {#if open}
        <motion.div
            id="box"
            layoutId="card"
            {transition}
            style={{
                position: 'absolute',
                top: '400px',
                left: '50px',
                width: resize ? '400px' : '100px',
                height: '100px',
                background: 'blue'
            }}
        />
    {:else}
        <motion.div
            id="box"
            layoutId="card"
            drag
            {transition}
            onDragEnd={() => (open = true)}
            style={{
                position: 'absolute',
                top: '100px',
                left: '300px',
                width: '100px',
                height: '100px',
                background: 'red'
            }}
        />
    {/if}
</div>

<TesterPanel
    eyebrow="Motion 14.13 · layout velocity"
    title="A thrown card hands its velocity on"
    status="New in Motion 14.13. The detail view jumping back to the card's undragged place is a known divergence (plan 004)."
    {steps}
>
    {#snippet summary()}
        {#if isTester}
            <span>red last left: {redLast === null ? '—' : `${redLast.toFixed(1)} px`}</span>
            <span>· blue first left: {blueFirst === null ? '—' : `${blueFirst.toFixed(1)} px`}</span
            >
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            A red card with <code>drag</code> and <code>layoutId="card"</code> becomes a blue detail
            view with the same <code>layoutId</code> when the drag ends. With a spring, the blue
            card starts with the throw’s velocity. Showing: <code>{showing}</code>.
        </p>
        <p>
            The readout compares the red card’s left edge on its last painted frame with the blue
            card’s on its first: on a spring the blue card should start where the red one was
            released.
        </p>
        <ul class="fixtures">
            {#each fixtures as fixture (fixture)}
                <li>
                    <a href={`${base}${fixture}`} data-sveltekit-reload>{fixture || '(default)'}</a>
                </li>
            {/each}
        </ul>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        position: absolute;
        top: 0;
        left: 0;
    }

    .fixtures {
        margin: 0;
        padding-left: 18px;
    }
</style>
