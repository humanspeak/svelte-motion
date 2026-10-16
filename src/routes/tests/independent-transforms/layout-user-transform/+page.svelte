<script lang="ts">
    import { motion } from '$lib'
    import { animate } from 'motion'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'
    import { onPaintedFrame } from '../_paintedFrames'

    /**
     * Layout measurements keep non-Motion transform animations (Motion 14.2
     * parity). Driven by `e2e/independent-transforms/layout-user-transform.spec.ts`.
     *
     * Upstream only ever demotes Motion's own transform group before it
     * measures (`demoteTransforms` → `transformGroups.get(instance)?.demote()`,
     * motion-dom `projection/node/create-projection-node.ts` @ `v14.2.0`,
     * 123-124). Any other transform animation stays applied, so it is part of
     * both the "before" and the "after" box and adds no layout delta.
     *
     * - `#user-waapi` holds `translateY(40px)` from a plain
     *   `element.animate(…, { fill: 'forwards' })`.
     * - `#user-motion` runs `translateY(40px)` from Motion's own
     *   `animate(element, { transform })`, still in flight when it widens.
     *
     * - `#user-inline` holds `translateY(40px)` written straight to
     *   `element.style.transform` by the page.
     * - `#user-y` is offset by `animate(element, { y: 40 })`, a real Motion
     *   value.
     *
     * Widening either box starts a width-only layout animation: the
     * projection transform must have no vertical translate.
     *
     * Once `#user-motion`'s animation has finished, its `translateY(40px)` is
     * only an inline style, like `#user-inline`'s. Upstream's
     * `resetTransform()` (`create-projection-node.ts` @ `v14.2.0`, 999-1031)
     * leaves it in place for the layout reads (no independent transforms,
     * no projection delta, no `transformTemplate`), so there's no vertical
     * delta, and the projection's own write replaces it
     * (`applyProjectionStyles`, 2066-2076, and `'none'` once idle,
     * 2050-2055). On the React fixture (`dev/react-19`, v14.2.0) both boxes
     * drop into their row in the first frame of the change and never slide.
     *
     * `#user-y`'s offset is a Motion `y` value: the projection composes it
     * (`buildProjectionTransform` gets `latestValues`), so on the fixture it
     * stays 40px down on every frame and ends at `translate3d(0px, 40px, 0px)`.
     *
     * `#user-declarative` gets the same `translateY(40px)` declaratively
     * (`animate={{ transform: 'translateY(40px)' }}`, 4s linear). The
     * `transform` key isn't an independent transform, so `buildHTMLStyles`
     * writes it inline as-is (motion-dom `render/html/utils/build-styles.ts`
     * @ `v14.2.0`, 30-47 and 52) and `hasTransform(latestValues)` stays false
     * (`projection/utils/has-transform.ts`, 16-27). Upstream `resetTransform()`
     * therefore keeps it for the layout reads (999-1031). On the React fixture
     * (Motion 14.2.0, same props):
     * - widened after the slide finished, it drops from +40px into its row in
     *   the first frame, its width grows over the 1s layout transition, and it
     *   ends at inline `none`, like `#user-motion`;
     * - widened mid-slide, the compositor `transform` animation keeps
     *   painting over the projection's inline transform (only Motion's
     *   independent-transform group is demoted, 123-124), so the box keeps
     *   sliding down with no jump and paints 300px wide from the first frame.
     *   When the slide ends it drops into its row in one frame (the
     *   projection's final inline `none`, 2050-2055).
     */
    const transition = { layout: { duration: 1, ease: 'linear' } } as const
    const declarativeTransition = {
        duration: 4,
        ease: 'linear',
        layout: { duration: 1, ease: 'linear' }
    } as const

    let width = $state(100)
    /** Box colour; `recolor()` changes it in a commit that moves nothing. */
    let tint = $state('#0077ff')
    let waapiEl = $state<HTMLElement | null>(null)
    let motionEl = $state<HTMLElement | null>(null)
    let inlineEl = $state<HTMLElement | null>(null)
    let yEl = $state<HTMLElement | null>(null)
    let declarativeEl = $state<HTMLElement | null>(null)
    const style = $derived({ width: `${width}px`, height: '40px', background: tint })

    /**
     * Commits a colour-only `style` change on every box: no layout moves.
     *
     * Upstream's equivalent is a React re-render whose layout didn't change:
     * `getSnapshotBeforeUpdate` → `willUpdate()` (`MeasureLayout.tsx`
     * @ `v14.2.0`, 68-98), then `didUpdate` with no layout change →
     * `finishAnimation` (motion-dom `create-projection-node.ts`, 615-617,
     * 2445-2448), which clears the finished projection's `target`. From then
     * on `applyProjectionStyles` stops projecting (2042-2055) and each box's
     * own transform renders again.
     */
    const recolor = () => {
        tint = tint === '#0077ff' ? '#0060d0' : '#0077ff'
    }

    /**
     * Reads the vertical translate the projection wrote inline
     * (`translate3d(x, y, 0)`), or 0 without one.
     */
    const projectionY = (el: HTMLElement) => {
        const match = /translate3d\([^,]+,\s*(-?[\d.]+)px/.exec(el.style.transform)
        return match ? Number(match[1]) : 0
    }

    /**
     * Widens both boxes and samples their projection's vertical translate
     * once per painted frame (see `onPaintedFrame`).
     *
     * @param frames - How many frames to sample.
     * @returns Per box id, the sampled vertical translates in frame order.
     */
    const widenAndSample = (frames: number) =>
        new Promise<Record<string, number[]>>((resolve) => {
            const samples: Record<string, number[]> = { 'user-waapi': [], 'user-motion': [] }
            const stop = onPaintedFrame(() => {
                samples['user-waapi'].push(projectionY(waapiEl!))
                samples['user-motion'].push(projectionY(motionEl!))
                if (samples['user-waapi'].length < frames) return
                stop()
                resolve(samples)
            })
            width = width === 100 ? 300 : 100
        })

    type PaintedTop = { top: number; width: number; y: number; transform: string }

    /**
     * Widens every box and records `#user-motion`'s, `#user-inline`'s,
     * `#user-y`'s and `#user-declarative`'s painted top, painted width and
     * projection translateY once per painted frame, from the
     * last frame before the change until `ms` after it.
     *
     * @param ms - How long to keep sampling after the change.
     * @returns Per box id, `before` (the frame before the change) and `after`.
     */
    const widenAndSampleTops = (ms: number) =>
        new Promise<Record<string, { before: PaintedTop; after: PaintedTop[] }>>((resolve) => {
            const ids = ['user-motion', 'user-inline', 'user-y', 'user-declarative'] as const
            const els = {
                'user-motion': motionEl!,
                'user-inline': inlineEl!,
                'user-y': yEl!,
                'user-declarative': declarativeEl!
            }
            const read = (el: HTMLElement): PaintedTop => {
                const rect = el.getBoundingClientRect()
                return {
                    top: Math.round(rect.top * 10) / 10,
                    width: Math.round(rect.width * 10) / 10,
                    y: projectionY(el),
                    transform: el.style.transform
                }
            }
            const out = {} as Record<string, { before: PaintedTop; after: PaintedTop[] }>
            let changedAt = 0
            const stop = onPaintedFrame(() => {
                if (!changedAt) {
                    for (const id of ids) out[id] = { before: read(els[id]), after: [] }
                    changedAt = performance.now()
                    width = width === 100 ? 300 : 100
                    return
                }
                for (const id of ids) out[id].after.push(read(els[id]))
                if (performance.now() - changedAt < ms) return
                stop()
                resolve(out)
            })
        })

    /** Starts both user transform animations. */
    const startUserAnimations = () => {
        waapiEl!.animate([{ transform: 'translateY(40px)' }], { fill: 'forwards', duration: 1000 })
        animate(motionEl!, { transform: 'translateY(40px)' }, { duration: 4, ease: 'linear' })
        inlineEl!.style.transform = 'translateY(40px)'
        animate(yEl!, { y: 40 }, { duration: 1, ease: 'linear' })
    }

    // ---- Tester scenarios (tester only; never under `@isPlaywright=true`) ----
    //
    // Each button is one complete scenario: it reloads the page with
    // `?scenario=<id>`, waits for the precondition itself, widens once,
    // samples and shows only that scenario's verdict. Nothing here runs under
    // `@isPlaywright=true`, so the specs' `widenAndSample` /
    // `widenAndSampleTops` surface is untouched.

    type ScenarioId = 'mid-slide' | 'after-finish' | 'declarative-mid-slide' | 'recolor-mid-slide'
    type BoxId = 'user-waapi' | 'user-motion' | 'user-inline' | 'user-y' | 'user-declarative'
    type RowResult = { ok: boolean; detail: string }
    type ScenarioResult = { missed: string } | { rows: Record<string, RowResult> }

    /**
     * Where each box should paint on every frame of a post-finish widen (the
     * React fixture's frames): `#user-motion` / `#user-inline` in their row,
     * `#user-y` still 40px down, `#user-declarative` in its row.
     */
    const expectedTop = {
        'user-motion': 100,
        'user-inline': 200,
        'user-y': 340,
        'user-declarative': 400
    }

    /** True once a box's Motion `transform` slide has finished and committed inline. */
    const settledAt40 = (el: HTMLElement) =>
        el.style.transform === 'translateY(40px)' && el.getAnimations().length === 0

    const scenarios: Record<
        ScenarioId,
        {
            label: string
            judges: BoxId[]
            waitMs: number
            waitText: string
            rows: { key: string; label: string; expected: string }[]
            /** `null` when the widen may fire, else why the scenario can't be judged. */
            precondition: () => string | null
            /** Extra time to wait for the precondition after `waitMs`. */
            graceMs: number
            run: () => Promise<Record<string, RowResult>>
        }
    > = {
        'mid-slide': {
            label: 'Widen mid-slide (boxes 1, 2)',
            judges: ['user-waapi', 'user-motion'],
            waitMs: 1300,
            graceMs: 0,
            waitText: 'Waiting until box 1 has finished and box 2 is mid-slide…',
            rows: [
                {
                    key: 'user-waapi',
                    label: 'box 1 (#user-waapi) vertical layout translate',
                    expected: 'at most 1px'
                },
                {
                    key: 'user-motion',
                    label: 'box 2 (#user-motion) vertical layout translate',
                    expected: 'at most 1px'
                }
            ],
            precondition: () =>
                motionEl!.getAnimations().length > 0 ? null : 'box 2 had already stopped sliding',
            run: async () => {
                const samples = await widenAndSample(20)
                return Object.fromEntries(
                    Object.entries(samples).map(([id, ys]) => {
                        const max = Math.max(...ys.map((y) => Math.abs(y)))
                        return [id, { ok: max <= 1, detail: `saw ${max.toFixed(1)}px` }]
                    })
                )
            }
        },
        'after-finish': {
            label: 'Widen after finish (boxes 2-5)',
            judges: ['user-motion', 'user-inline', 'user-y', 'user-declarative'],
            waitMs: 4600,
            graceMs: 2000,
            waitText: 'Waiting for the slides to finish…',
            rows: (['user-motion', 'user-inline', 'user-y', 'user-declarative'] as const).map(
                (id, index) => ({
                    key: `${id}-after-finish`,
                    label: `box ${index + 2} (#${id}) painted top`,
                    expected: `${expectedTop[id]}px on every frame`
                })
            ),
            precondition: () => {
                if (!settledAt40(motionEl!)) return "box 2's slide hadn't finished"
                if (!settledAt40(declarativeEl!)) return "box 5's slide hadn't finished"
                if (inlineEl!.style.transform !== 'translateY(40px)')
                    return "box 3's inline transform was missing"
                if (Math.abs(yEl!.getBoundingClientRect().top - 340) > 1)
                    return "box 4's y slide hadn't finished"
                return null
            },
            run: async () => {
                const samples = await widenAndSampleTops(1300)
                return Object.fromEntries(
                    Object.entries(samples).map(([id, { after }]) => {
                        const expected = expectedTop[id as keyof typeof expectedTop]
                        const off = after
                            .map((frame) => frame.top)
                            .filter((top) => Math.abs(top - expected) > 1)
                        return [
                            `${id}-after-finish`,
                            {
                                ok: off.length === 0,
                                detail: off.length ? `saw ${off.slice(0, 4).join(', ')}` : ''
                            }
                        ]
                    })
                )
            }
        },
        'declarative-mid-slide': {
            label: 'Widen the declarative box mid-slide (box 5)',
            judges: ['user-declarative'],
            waitMs: 1300,
            graceMs: 0,
            waitText: 'Waiting until box 5 is mid-slide…',
            rows: [
                {
                    key: 'user-declarative-mid-slide',
                    label: 'box 5 (#user-declarative) mid-slide: painted top and width',
                    expected: 'slides with no jump at 300px, then 400px'
                }
            ],
            precondition: () =>
                declarativeEl!.getAnimations().length > 0
                    ? null
                    : 'box 5 had already stopped sliding',
            run: async () => {
                const samples = await widenAndSampleTops(3500)
                const { before, after } = samples['user-declarative']
                const landedAt = after.findIndex((frame) => Math.abs(frame.top - 400) <= 1)
                const sliding = landedAt === -1 ? after : after.slice(0, landedAt)
                const jumps: number[] = []
                let previous = before.top
                for (const frame of sliding) {
                    const step = frame.top - previous
                    if (step < -0.2 || step > 2) jumps.push(Math.round(step * 10) / 10)
                    previous = frame.top
                }
                const narrow = after
                    .map((frame) => frame.width)
                    .filter((frameWidth) => Math.abs(frameWidth - 300) > 1)
                const landed =
                    landedAt > 0 &&
                    after.slice(landedAt).every((frame) => Math.abs(frame.top - 400) <= 1)
                const ok = jumps.length === 0 && narrow.length === 0 && landed
                return {
                    'user-declarative-mid-slide': {
                        ok,
                        detail: ok
                            ? ''
                            : `jumps ${jumps.slice(0, 4).join(', ') || 'none'}; widths ${
                                  narrow.slice(0, 4).join(', ') || 'ok'
                              }; landed ${landed}`
                    }
                }
            }
        },
        'recolor-mid-slide': {
            label: 'Widen mid-slide, then recolor (boxes 2, 4, 5)',
            judges: ['user-motion', 'user-y', 'user-declarative'],
            waitMs: 1300,
            graceMs: 0,
            waitText: 'Waiting until boxes 2 and 5 are mid-slide…',
            rows: (['user-motion', 'user-y', 'user-declarative'] as const).map((id) => ({
                key: `${id}-recolor`,
                label: `box ${id === 'user-motion' ? 2 : id === 'user-y' ? 4 : 5} (#${id}) painted top`,
                expected: `no jump, ends at ${expectedTop[id] + (id === 'user-y' ? 0 : 40)}px`
            })),
            precondition: () =>
                motionEl!.getAnimations().length > 0 && declarativeEl!.getAnimations().length > 0
                    ? null
                    : 'boxes 2 and 5 had already stopped sliding',
            run: async () => {
                // Recolor once the 1s layout transition is over, while the
                // slides still run; sample until a second after they end.
                setTimeout(recolor, 1700)
                const samples = await widenAndSampleTops(5500)
                return Object.fromEntries(
                    (['user-motion', 'user-y', 'user-declarative'] as const).map((id) => {
                        const { before, after } = samples[id]
                        const end = expectedTop[id] + (id === 'user-y' ? 0 : 40)
                        const jumps: number[] = []
                        let previous = before.top
                        for (const frame of after) {
                            const step = frame.top - previous
                            if (step < -0.2 || step > 2) jumps.push(Math.round(step * 10) / 10)
                            previous = frame.top
                        }
                        const last = after.at(-1)!.top
                        const ok = jumps.length === 0 && Math.abs(last - end) <= 1
                        return [
                            `${id}-recolor`,
                            {
                                ok,
                                detail: ok
                                    ? ''
                                    : `jumps ${jumps.slice(0, 4).join(', ') || 'none'}; ended at ${last}`
                            }
                        ]
                    })
                )
            }
        }
    }
    const scenarioIds = Object.keys(scenarios) as ScenarioId[]
    const boxCaptions: { id: BoxId; top: number; text: string }[] = [
        { id: 'user-waapi', top: 0, text: '1: page WAAPI animation' },
        { id: 'user-motion', top: 100, text: '2: Motion animate(el, { transform })' },
        { id: 'user-inline', top: 200, text: '3: page-written inline transform' },
        { id: 'user-y', top: 300, text: '4: Motion y' },
        { id: 'user-declarative', top: 400, text: '5: animate={{ transform }}' }
    ]

    let isTester = $state(false)
    /** The scenario this page load runs (from `?scenario=`), if any. */
    let activeScenario = $state<ScenarioId | null>(null)
    /** True from a button press until the active scenario's verdict is in. */
    let busy = $state(false)
    let phase = $state('')
    let result = $state<ScenarioResult | null>(null)
    const judging = $derived(activeScenario ? scenarios[activeScenario].judges : null)

    /** Starts a scenario fresh: reloads the page with its `?scenario=` query. */
    const startScenario = (id: ScenarioId) => {
        busy = true
        window.location.assign(`${window.location.pathname}?scenario=${id}`)
    }

    /**
     * Runs the scenario this page load was started for: counts down its
     * wait from mount, checks its precondition, widens once, samples.
     */
    const runScenario = async (id: ScenarioId, mountedAt: number) => {
        const scenario = scenarios[id]
        busy = true
        const deadline = mountedAt + scenario.waitMs
        while (performance.now() < deadline) {
            phase = `${scenario.waitText} ${Math.ceil((deadline - performance.now()) / 1000)}s`
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        let missed = scenario.precondition()
        const graceEnd = performance.now() + scenario.graceMs
        while (missed && performance.now() < graceEnd) {
            phase = `${scenario.waitText} still waiting`
            await new Promise((resolve) => setTimeout(resolve, 100))
            missed = scenario.precondition()
        }
        if (missed) {
            result = { missed }
        } else {
            phase = 'Widening once and sampling every painted frame…'
            result = { rows: await scenario.run() }
        }
        phase = ''
        busy = false
    }

    /** The chip for one verdict row: only the scenario that ran is judged. */
    const rowState = (scenarioId: ScenarioId, key: string) => {
        if (scenarioId !== activeScenario) return { chip: 'not run', tone: 'idle', detail: '' }
        if (!result) return { chip: '…', tone: 'idle', detail: '' }
        if ('missed' in result)
            return {
                chip: 'precondition missed: reload',
                tone: 'missed',
                detail: `(${result.missed})`
            }
        const row = result.rows[key]
        return row.ok
            ? { chip: 'PASS', tone: 'ok', detail: row.detail }
            : { chip: 'FAIL', tone: 'fail', detail: row.detail }
    }

    onMount(() => {
        const mountedAt = performance.now()
        const target = window as unknown as Record<string, unknown>
        target.widenAndSample = widenAndSample
        target.widenAndSampleTops = widenAndSampleTops
        target.recolor = recolor
        startUserAnimations()
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return
        const url = new URL(window.location.href)
        const requested = url.searchParams.get('scenario') as ScenarioId | null
        if (!requested || !scenarioIds.includes(requested)) return
        // A manual reload (or "Reset page") afterwards gives a clean page.
        url.searchParams.delete('scenario')
        window.history.replaceState(window.history.state, '', url)
        activeScenario = requested
        void runScenario(requested, mountedAt)
    })

    const steps: TesterStep[] = [
        {
            text: 'Press "Widen mid-slide (boxes 1, 2)" in the live readout. The page reloads, counts down about one second (box 1 has finished, box 2 is still sliding), widens every box once and samples.',
            expected:
                'Box 1 (page WAAPI animation) stays 40px down and box 2 (Motion animate(el, { transform })) keeps sliding down; neither jumps up or down when the boxes widen. Boxes 3-5 are dimmed: this scenario does not judge them. Both "mid-slide" rows read PASS.'
        },
        {
            text: 'Press "Widen after finish (boxes 2-5)". The page reloads and counts down about five seconds, until boxes 2 and 5 have finished sliding 40px down, then widens once and samples.',
            expected:
                'Box 2 (Motion animate(el, { transform })), box 3 (page-written inline transform) and box 5 (animate={{ transform }}) each drop into their own row in one frame, then only grow wider over one second, with no slide (as React Motion does). Box 4 (Motion y) stays 40px down while it grows. Box 1 is dimmed. All four "after finish" rows read PASS.'
        },
        {
            text: 'Press "Widen the declarative box mid-slide (box 5)". The page reloads, counts down about one second while box 5 is still sliding, then widens once and samples for 3.5 seconds.',
            expected:
                'Box 5 (animate={{ transform }}) is 300px wide at once and keeps sliding down smoothly. When its slide ends (about four seconds after the reload) it drops into its own row in one frame and stays there, as React Motion does. Boxes 1-4 are dimmed. The "box 5 mid-slide" row reads PASS.'
        },
        {
            text: 'Press "Widen mid-slide, then recolor (boxes 2, 4, 5)". The page reloads, counts down about one second, widens once, and after the one-second layout transition changes every box\'s colour (a change that moves nothing), then samples until a second after the slides end.',
            expected:
                'Box 2 (Motion animate(el, { transform })) and box 5 (animate={{ transform }}) keep sliding down with no jump and stay 40px down when their slides end: the colour change ends the finished layout projection, so their own transform shows again, as a React re-render does. Box 4 (Motion y) stays 40px down. Boxes 1 and 3 are dimmed. All three "recolor" rows read PASS.'
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms — layout keeps user transform animations</title>
</svelte:head>

<div class="fixture" data-judging={judging?.join(' ')}>
    <motion.div id="user-waapi" layout bind:ref={waapiEl} {style} {transition} />
    <div class="gap"></div>
    <motion.div id="user-motion" layout bind:ref={motionEl} {style} {transition} />
    <div class="gap"></div>
    <motion.div id="user-inline" layout bind:ref={inlineEl} {style} {transition} />
    <div class="gap"></div>
    <motion.div id="user-y" layout bind:ref={yEl} {style} {transition} />
    <div class="gap"></div>
    <motion.div
        id="user-declarative"
        layout
        bind:ref={declarativeEl}
        {style}
        animate={{ transform: 'translateY(40px)' }}
        transition={declarativeTransition}
    />
    {#if isTester}
        {#each boxCaptions as caption (caption.id)}
            <p
                class="caption"
                class:dim={judging && !judging.includes(caption.id)}
                style:top="{caption.top + 10}px"
            >
                {caption.text}
            </p>
        {/each}
    {/if}
</div>

<TesterPanel
    eyebrow="motion-dom create-projection-node.ts (demoteTransforms)"
    title="Layout keeps user transform animations"
    status="Expected on Chromium with Motion 14.2: after a scenario runs, each of its rows reads PASS. Rows of scenarios that didn't run on this load read “not run”."
    {steps}
>
    {#snippet summary()}
        <p class="phase" aria-live="polite">
            {#if phase}
                {phase}
            {:else if activeScenario}
                Ran “{scenarios[activeScenario].label}”. Press any button to run a scenario again.
            {:else}
                Press a scenario button below.
            {/if}
        </p>
    {/snippet}
    {#snippet checks()}
        <p>
            A layout measurement only sets aside Motion's own compositor transform animation. A
            <code>transform</code> animation the page runs itself stays part of the measured box, so widening
            the box doesn't add a vertical layout animation.
        </p>
        <p>
            Each scenario button in the live readout is one complete scenario: it reloads the page,
            waits for you, widens the boxes once and judges only the boxes it is about (the others
            are dimmed). Press a button again to rerun that scenario from a fresh reload.
        </p>
    {/snippet}
    {#if isTester}
        <div class="scenarios">
            {#each scenarioIds as id (id)}
                <button
                    type="button"
                    class="scenario"
                    data-tester-scenario={id}
                    disabled={busy}
                    onclick={() => startScenario(id)}
                >
                    {scenarios[id].label}
                </button>
            {/each}
        </div>
        {#each scenarioIds as scenarioId (scenarioId)}
            <h3 class="group">{scenarios[scenarioId].label}</h3>
            <ul class="verdicts">
                {#each scenarios[scenarioId].rows as row (row.key)}
                    {@const verdict = rowState(scenarioId, row.key)}
                    <li data-tester-verdict={row.key}>
                        <code>{row.label}</code>
                        <span class="chip {verdict.tone}">{verdict.chip}</span>
                        <span class="detail">{row.expected} {verdict.detail}</span>
                    </li>
                {/each}
            </ul>
        {/each}
    {/if}
</TesterPanel>

<style>
    .fixture {
        position: fixed;
        top: 0;
        left: 0;
    }

    .gap {
        height: 60px;
    }

    .caption {
        position: absolute;
        left: 320px;
        margin: 0;
        font-size: 13px;
        white-space: nowrap;
        line-height: 20px;
    }

    .caption.dim,
    .fixture[data-judging]:not([data-judging~='user-waapi']) :global(#user-waapi),
    .fixture[data-judging]:not([data-judging~='user-motion']) :global(#user-motion),
    .fixture[data-judging]:not([data-judging~='user-inline']) :global(#user-inline),
    .fixture[data-judging]:not([data-judging~='user-y']) :global(#user-y),
    .fixture[data-judging]:not([data-judging~='user-declarative']) :global(#user-declarative) {
        opacity: 0.25;
    }

    .scenarios {
        display: grid;
        gap: 6px;
        margin-bottom: 10px;
    }

    .scenario {
        padding: 6px 10px;
        border: 0;
        border-radius: 6px;
        background: #0077ff;
        color: white;
        font-weight: 600;
        text-align: left;
        cursor: pointer;
    }

    .scenario:disabled {
        background: #374151;
        cursor: not-allowed;
    }

    .phase {
        min-height: 1.2em;
        margin: 0;
        font-size: 12px;
    }

    .group {
        margin: 10px 0 4px;
        font-size: 12px;
    }

    .verdicts {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 12px;
    }

    .chip {
        margin: 0 6px;
        padding: 1px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        color: white;
        font-weight: 600;
        white-space: nowrap;
    }

    .chip.ok {
        background: #14532d;
    }

    .chip.idle {
        background: #374151;
    }

    .chip.missed {
        background: #92400e;
    }

    .detail {
        opacity: 0.75;
    }
</style>
