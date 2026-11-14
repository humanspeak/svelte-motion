<script lang="ts">
    /**
     * Layout velocity (Motion 14.13): a spring layout animation that interrupts
     * a running one starts with the element's current velocity. A Svelte port
     * of upstream's `dev/react/src/tests/layout-velocity-{interrupt,
     * fixed-edge,nested,zero-size,auto-mass}.tsx` @ `v14.14.0` (PR #4047),
     * driven by `e2e/layout/velocity.spec.ts` (a port of
     * `packages/framer-motion/cypress/integration/layout-velocity.ts`).
     *
     * `?test=` picks the fixture (`interrupt` by default). Flags, as upstream:
     * - `interrupt`: `&tween` (a tween, from rest), `&duration` (a duration
     *   spring, from rest), `&mirror` (a 0.3 s spring repeated once as a mirror).
     * - `fixed-edge`: `&tween`, `&delay` (a 0.3 s delay before each spring).
     * - `nested`: `&move` (the child also moves inside the parent, mass 1),
     *   `&still` (the parent stays put).
     * - `auto-mass`: `&default` (no transition), `&duration` (a 0.3 s duration
     *   spring).
     *
     * Svelte deviations: the fixtures sit in one `position: absolute` wrapper
     * at the page's top left (the test harness centres its content), and the
     * tester panel adds Go / Reverse buttons that click the fixture.
     *
     * @component
     */
    import { page } from '$app/state'
    import { resolve } from '$app/paths'
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import { onPaintedFrame } from '../../independent-transforms/_paintedFrames'
    import TesterPanel, { type TesterStep } from '../_parity/TesterPanel.svelte'

    const params = page.url.searchParams
    const test = params.get('test') ?? 'interrupt'
    const has = (flag: string) => params.has(flag)

    const base = resolve('/tests/layout/velocity')
    const fixtures = [
        'interrupt',
        'interrupt&tween',
        'interrupt&duration',
        'fixed-edge',
        'nested',
        'nested&move',
        'zero-size',
        'auto-mass',
        'auto-mass&default'
    ]
    const showing = [...params.keys()]
        .filter((key) => key !== 'test' && key !== '@isPlaywright')
        .reduce((query, key) => `${query}&${key}`, test)

    // ---- interrupt ----
    const interruptTransition = has('tween')
        ? { duration: 0.8 }
        : has('duration')
          ? { type: 'spring' as const, duration: 0.8, bounce: 0 }
          : has('mirror')
            ? {
                  type: 'spring' as const,
                  visualDuration: 0.3,
                  bounce: 0,
                  repeat: 1,
                  repeatType: 'mirror' as const
              }
            : { type: 'spring' as const, visualDuration: 0.8, bounce: 0 }
    let isRight = $state(false)

    // ---- fixed-edge ----
    const fixedEdgeTransition = has('tween')
        ? { duration: 0.8 }
        : { type: 'spring' as const, visualDuration: 0.8, bounce: 0, delay: has('delay') ? 0.3 : 0 }
    let isWide = $state(false)

    // ---- nested ----
    const nestedTransition = {
        type: 'spring' as const,
        visualDuration: 0.45,
        bounce: 0,
        ...(!has('move') && { mass: 'auto' as const })
    }
    let isBig = $state(false)
    const isMoved = $derived(isBig && !has('still'))
    const parentSize = $derived(isMoved ? '600px' : '300px')

    // ---- zero-size ----
    const zeroSizeStates = [
        { left: '100px', width: '0px' },
        { left: '400px', width: '0px' },
        { left: '400px', width: '200px' }
    ]
    let zeroSizeIndex = $state(0)
    let completed = $state(0)

    // ---- auto-mass ----
    const autoMassTransition = has('default')
        ? undefined
        : has('duration')
          ? { type: 'spring' as const, duration: 0.3, bounce: 0 }
          : { type: 'spring' as const, visualDuration: 0.45, bounce: 0, mass: 'auto' as const }
    let isDown = $state(false)
    let smallStartedAt = 0
    let bigStartedAt = 0
    let smallDuration = $state<number | null>(null)
    let bigDuration = $state<number | null>(null)

    // ---- Live verdict (tester only; never under `@isPlaywright=true`) ----
    type Verdict = { state: 'waiting' } | { state: 'sampling' } | { state: 'done'; carried: number }
    let isTester = $state(false)
    let verdict = $state<Verdict>({ state: 'waiting' })

    /** The edge the verdict follows: the right edge for `fixed-edge`. */
    const edge = () => {
        const rect = document.getElementById('box')!.getBoundingClientRect()
        return test === 'fixed-edge' ? rect.right : rect.left
    }
    let lastPainted: number | null = null
    let stopSampling = () => {}

    const clickById = (id: string) => document.getElementById(id)?.click()

    /**
     * Clicks the box mid flight and records its edge on the next 10 painted
     * frames. "Carried" is how far it went on past the edge at the click, in
     * the direction it was moving.
     */
    const reverse = () => {
        stopSampling()
        const atClick = edge()
        const direction = Math.sign(atClick - (lastPainted ?? atClick)) || 1
        clickById('box')
        verdict = { state: 'sampling' }
        const samples: number[] = []
        stopSampling = onPaintedFrame(() => {
            samples.push(edge())
            if (samples.length < 10) return
            stopSampling()
            stopSampling = () => {}
            const carried = Math.max(...samples.map((s) => (s - atClick) * direction))
            verdict = { state: 'done', carried }
        })
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester || (test !== 'interrupt' && test !== 'fixed-edge')) return
        // Remembers the edge on the last painted frame, so Reverse knows
        // which way the box was moving.
        const stopTracking = onPaintedFrame(() => (lastPainted = edge()))
        return () => {
            stopTracking()
            stopSampling()
        }
    })

    const fromRestNote = 'FROM REST is the right verdict with ?tween or ?duration.'

    const steps: TesterStep[] =
        test === 'fixed-edge'
            ? [
                  {
                      text: 'Click Go (the box grows to the right from its left edge).',
                      expected: 'The left edge stays where it is.',
                      action: { label: 'Go', run: () => clickById('box') }
                  },
                  {
                      text: 'Click Reverse while it grows.',
                      expected: `The left edge never moves. On a spring the right edge keeps going right for a moment, then shrinks back. ${fromRestNote}`,
                      action: { label: 'Reverse', run: reverse }
                  }
              ]
            : test === 'nested'
              ? [
                    {
                        text: 'Click Go (the red parent moves and grows).',
                        expected: has('move')
                            ? 'The blue child also slides right inside the parent.'
                            : 'The blue child keeps its place, 20px in from the parent’s top left corner.',
                        action: { label: 'Go', run: () => clickById('parent') }
                    },
                    {
                        text: 'Click Reverse while it moves.',
                        expected: has('move')
                            ? 'The blue child keeps sliding right inside the parent for a moment before it turns back.'
                            : 'The blue child keeps its place in the red parent the whole time.',
                        action: { label: 'Reverse', run: () => clickById('parent') }
                    }
                ]
              : test === 'zero-size'
                ? [
                      {
                          text: 'Click Next (the box, which has no width, moves right).',
                          expected: 'Nothing visible moves yet: the box is 0px wide.',
                          action: { label: 'Next', run: () => clickById('box') }
                      },
                      {
                          text: 'Click Next again at once, while it is still moving.',
                          expected:
                              'The box grows to 200px wide at 400px from the left and the completed count reads 1.',
                          action: { label: 'Next', run: () => clickById('box') }
                      }
                  ]
                : test === 'auto-mass'
                  ? [
                        {
                            text: 'Click Toggle (both boxes move down 200px).',
                            expected: has('default')
                                ? 'Both boxes finish together in under about 0.5 s (the default tween).'
                                : has('duration')
                                  ? 'Both boxes finish together in about 0.3 s.'
                                  : 'The big box settles later than the small one (at least 0.3 s later).',
                            action: { label: 'Toggle', run: () => clickById('toggle') }
                        }
                    ]
                  : [
                        {
                            text: 'Click Go (the box starts right).',
                            expected: 'It glides to the right.',
                            action: { label: 'Go', run: () => clickById('box') }
                        },
                        {
                            text: 'Click Reverse while it moves.',
                            expected:
                                'It keeps moving right for a moment, then swings back; with ?tween or ?duration it turns at once.',
                            action: { label: 'Reverse', run: reverse }
                        }
                    ]

    const formatDuration = (ms: number | null) => (ms === null ? '—' : `${Math.round(ms)} ms`)
</script>

<svelte:head>
    <title>Layout · velocity carried through an interrupt (Motion 14.13)</title>
</svelte:head>

<div class="fixture">
    {#if test === 'fixed-edge'}
        <motion.div
            id="box"
            layout
            transition={fixedEdgeTransition}
            onclick={() => (isWide = !isWide)}
            style={{
                position: 'absolute',
                top: '100px',
                left: '100px',
                width: isWide ? '500px' : '100px',
                height: '100px',
                background: 'red'
            }}
        />
    {:else if test === 'nested'}
        <motion.div
            id="parent"
            layout
            transition={nestedTransition}
            onclick={() => (isBig = !isBig)}
            style={{
                position: 'absolute',
                top: '0px',
                left: isMoved ? '200px' : '0px',
                width: parentSize,
                height: parentSize,
                background: 'red'
            }}
        >
            <motion.div
                id="child"
                layout
                transition={nestedTransition}
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: isBig && has('move') ? '220px' : '20px',
                    width: '40px',
                    height: '40px',
                    background: 'blue'
                }}
            />
        </motion.div>
    {:else if test === 'zero-size'}
        <motion.div
            id="box"
            layout
            data-completed={completed}
            transition={{ type: 'spring', visualDuration: 0.4, bounce: 0 }}
            onLayoutAnimationComplete={() => completed++}
            onclick={() => (zeroSizeIndex = Math.min(zeroSizeIndex + 1, 2))}
            style={{
                position: 'absolute',
                top: '100px',
                height: '100px',
                background: 'red',
                ...zeroSizeStates[zeroSizeIndex]
            }}
        />
    {:else if test === 'auto-mass'}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
            id="toggle"
            onclick={() => (isDown = !isDown)}
            style="display: flex; gap: 40px; align-items: flex-start;"
        >
            <motion.div
                id="small"
                layout
                transition={autoMassTransition}
                data-duration={smallDuration ?? ''}
                onLayoutAnimationStart={() => (smallStartedAt = performance.now())}
                onLayoutAnimationComplete={() =>
                    (smallDuration = performance.now() - smallStartedAt)}
                style={{
                    width: '50px',
                    height: '50px',
                    marginTop: isDown ? '200px' : '0px',
                    flex: 'none',
                    background: 'red'
                }}
            />
            <motion.div
                id="big"
                layout
                transition={autoMassTransition}
                data-duration={bigDuration ?? ''}
                onLayoutAnimationStart={() => (bigStartedAt = performance.now())}
                onLayoutAnimationComplete={() => (bigDuration = performance.now() - bigStartedAt)}
                style={{
                    width: '500px',
                    height: '500px',
                    marginTop: isDown ? '200px' : '0px',
                    flex: 'none',
                    background: 'red'
                }}
            />
        </div>
    {:else}
        <motion.div
            id="box"
            layout
            transition={interruptTransition}
            onclick={() => (isRight = !isRight)}
            style={{
                position: 'absolute',
                top: '100px',
                left: isRight ? '500px' : '100px',
                width: '100px',
                height: '100px',
                background: 'red'
            }}
        />
    {/if}
</div>

<TesterPanel
    eyebrow="Motion 14.13 · layout velocity"
    title="An interrupted layout spring keeps its speed"
    status="New in Motion 14.13. Tweens and springs set with a duration still start from rest."
    {steps}
>
    {#snippet summary()}
        {#if isTester}
            {#if test === 'interrupt' || test === 'fixed-edge'}
                {#if verdict.state === 'done'}
                    {#if verdict.carried > 5}
                        <span class="verdict ok">CARRIED +{verdict.carried.toFixed(1)} px ✓</span>
                    {:else}
                        <span class="verdict na">FROM REST</span>
                    {/if}
                    <span>{fromRestNote}</span>
                {:else}
                    <span class="verdict na"
                        >{verdict.state === 'sampling' ? 'RECORDING' : 'WAITING'}</span
                    >
                {/if}
            {:else if test === 'auto-mass'}
                <span>small: {formatDuration(smallDuration)}</span>
                <span>· big: {formatDuration(bigDuration)}</span>
            {:else if test === 'zero-size'}
                <span>completed: {completed}</span>
            {:else}
                <span class="verdict na">WATCH THE CHILD</span>
            {/if}
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            Each fixture is a port of upstream’s <code>layout-velocity-*</code> pages. A spring
            layout animation that interrupts a running one starts at the speed the element was
            already moving. Showing: <code>?test={showing}</code>.
        </p>
        <p>
            After Reverse, the page records the box’s edge (left edge; right edge on
            <code>fixed-edge</code>) on the next 10 painted frames. More than 5px past the edge at
            the click is CARRIED.
        </p>
        <ul class="fixtures">
            {#each fixtures as fixture (fixture)}
                <li>
                    <a href={`${base}?test=${fixture}`} data-sveltekit-reload>?test={fixture}</a>
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

    .verdict {
        display: inline-block;
        margin-right: 0.25rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
