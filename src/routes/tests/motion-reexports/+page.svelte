<!--
    Upstream public API re-exported by plan 014; behaviours as in Motion 14.7.1.

    - createScopedAnimate: the scoped animate factory useAnimate is built on.
      Selectors resolve only inside the scope element.
    - inertia: the decelerating generator, passed as `transition.type`. With
      `max`, it springs back to the boundary.
    - animateMini: the Web Animations-only animate (`motion/mini`).
    - resolveElements: selector → Element[], optionally limited to a scope.
-->
<script lang="ts">
    import {
        animate,
        animateMini,
        createScopedAnimate,
        inertia,
        motionValue,
        resolveElements,
        styleEffect
    } from '$lib'
    import { onMount, tick } from 'svelte'
    import TesterPanel, { type TesterStep } from '../layout/_parity/TesterPanel.svelte'

    let cardA: HTMLElement | undefined = $state()
    let ballEl: HTMLElement | undefined = $state()
    let miniBox: HTMLElement | undefined = $state()
    let scopeUl: HTMLElement | undefined = $state()

    let hydrated = $state(false)
    let isTester = $state(false)

    let scopedA: ReturnType<typeof createScopedAnimate> | undefined

    const x = motionValue(0)
    let ballX = $state(0)

    let miniRunning = $state('')
    let resolveDoc = $state(-1)
    let resolveScoped = $state(-1)

    // ---- Live verdicts (tester only) ----
    let scopedVerdict = $state('WAITING')
    let flingVerdict = $state('WAITING')
    let miniVerdict = $state('WAITING')
    const countsVerdict = $derived(
        resolveDoc === 5 && resolveScoped === 2
            ? 'COUNTS · 5 / 2'
            : `COUNTS · ${resolveDoc} / ${resolveScoped}`
    )

    const translateX = (el: Element) => new DOMMatrix(getComputedStyle(el).transform).m41

    const runScoped = () => {
        scopedA?.('.dot', { x: 100 }, { duration: 0.4 })
        if (!isTester) return
        scopedVerdict = 'RUNNING'
        setTimeout(() => {
            const a = [0, 1, 2].map((i) =>
                translateX(document.querySelector(`[data-testid="dot-a-${i}"]`)!)
            )
            const b = [0, 1, 2].map((i) =>
                translateX(document.querySelector(`[data-testid="dot-b-${i}"]`)!)
            )
            const ok = a.every((v) => Math.abs(v - 100) <= 1) && b.every((v) => Math.abs(v) <= 1)
            const aMin = Math.round(Math.min(...a))
            const bMax = Math.round(Math.max(...b.map(Math.abs)))
            scopedVerdict = ok ? 'SCOPED · A 100 / B 0' : `LEAKED · A ${aMin} / B ${bMax}`
        }, 600)
    }

    const fling = async () => {
        x.jump(0)
        if (isTester) flingVerdict = 'RUNNING'
        await animate(x, [0], {
            type: inertia,
            velocity: 2000,
            max: 240,
            bounceStiffness: 400,
            bounceDamping: 30
        })
        if (!isTester) return
        const value = Math.round(x.get())
        flingVerdict = value === 240 ? 'SETTLED · 240' : `OFF · ${value}`
    }

    const runMini = async () => {
        if (!miniBox) return
        const box = miniBox
        const controls = animateMini(box, { opacity: 0.25 }, { duration: 0.6 })
        const running = box.getAnimations().length > 0
        miniRunning = String(running)
        if (isTester) miniVerdict = running ? 'RUNNING' : 'NO-WAAPI'
        await controls
        if (!isTester || !running) return
        const opacity = Number(getComputedStyle(box).opacity)
        miniVerdict = Math.abs(opacity - 0.25) <= 0.02 ? 'WAAPI · 0.25' : `OFF · ${opacity}`
    }

    const reset = () => {
        for (let i = 0; i < 3; i++) {
            for (const card of ['a', 'b']) {
                const el = document.querySelector<HTMLElement>(`[data-testid="dot-${card}-${i}"]`)
                if (el) el.style.transform = ''
            }
        }
        x.jump(0)
        if (miniBox) {
            for (const a of miniBox.getAnimations()) a.cancel()
            miniBox.style.opacity = '1'
        }
        miniRunning = ''
        scopedVerdict = 'WAITING'
        flingVerdict = 'WAITING'
        miniVerdict = 'WAITING'
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        scopedA = createScopedAnimate({ scope: { current: cardA, animations: [] } })
        const stopStyle = ballEl ? styleEffect(ballEl, { x }) : undefined
        const unsubscribe = x.on('change', (v) => (ballX = Math.round(v)))
        resolveDoc = resolveElements('[data-testid="resolve-section"] li').length
        resolveScoped = resolveElements('li', { current: scopeUl, animations: [] }).length
        void (async () => {
            await tick()
            await new Promise((resolve) => requestAnimationFrame(resolve))
            hydrated = true
        })()
        return () => {
            unsubscribe()
            stopStyle?.()
        }
    })

    const steps: TesterStep[] = [
        {
            text: 'Click "Run scoped".',
            expected:
                "Only card A's three dots slide right by 100px; card B's dots stay put. Chip: SCOPED · A 100 / B 0.",
            action: { label: 'Run scoped', run: () => runScoped() }
        },
        {
            text: 'Click "Fling".',
            expected:
                'The ball shoots right, overshoots toward the wall and settles at 240. Chip: SETTLED · 240.',
            action: { label: 'Fling', run: () => void fling() }
        },
        {
            text: 'Click "Run mini".',
            expected: 'The box fades to 25% via Web Animations. Chip: WAAPI · 0.25.',
            action: { label: 'Run mini', run: () => void runMini() }
        },
        {
            text: 'Read the two counts in the last section.',
            expected: 'They read 5 (whole section) and 2 (first list only). Chip: COUNTS · 5 / 2.'
        }
    ]

    const chipClass = (v: string) =>
        /^(SCOPED|SETTLED|WAAPI)/.test(v) || v === 'COUNTS · 5 / 2'
            ? 'ok'
            : /^(LEAKED|OFF|NO-WAAPI|COUNTS)/.test(v)
              ? 'bad'
              : 'na'
</script>

<svelte:head>
    <title>Motion re-exports — createScopedAnimate, inertia, animateMini, resolveElements</title>
</svelte:head>

<div class="page" data-testid="stage" data-hydrated={hydrated}>
    <h1>Motion re-exports</h1>
    <p>Upstream public API re-exported unchanged from <code>motion</code> 14.7.1.</p>
    <button type="button" data-testid="reset" onclick={reset}>Reset all</button>

    <section>
        <h2>createScopedAnimate</h2>
        <button type="button" data-testid="run-scoped" onclick={runScoped}>Run scoped</button>
        <div class="cards">
            <div class="card" data-testid="card-a" bind:this={cardA}>
                <span class="label">A (scoped)</span>
                {#each [0, 1, 2] as i (i)}
                    <div class="dot" data-testid="dot-a-{i}"></div>
                {/each}
            </div>
            <div class="card" data-testid="card-b">
                <span class="label">B</span>
                {#each [0, 1, 2] as i (i)}
                    <div class="dot" data-testid="dot-b-{i}"></div>
                {/each}
            </div>
        </div>
    </section>

    <section>
        <h2>inertia</h2>
        <button type="button" data-testid="fling" onclick={fling}>Fling</button>
        <div class="track">
            <div class="ball" data-testid="ball" bind:this={ballEl}></div>
            <div class="wall"></div>
        </div>
        <p>x = <span data-testid="ball-x">{ballX}</span></p>
    </section>

    <section>
        <h2>animateMini</h2>
        <button type="button" data-testid="run-mini" onclick={runMini}>Run mini</button>
        <div class="mini-box" data-testid="mini-box" bind:this={miniBox}></div>
        <p>running: <span data-testid="mini-running">{miniRunning}</span></p>
    </section>

    <section>
        <h2>resolveElements</h2>
        <div data-testid="resolve-section">
            <ul data-testid="resolve-scope" bind:this={scopeUl}>
                <li>one</li>
                <li>two</li>
            </ul>
            <ul>
                <li>three</li>
                <li>four</li>
                <li>five</li>
            </ul>
        </div>
        <p>
            section li: <span data-testid="resolve-doc">{resolveDoc}</span> · scoped li:
            <span data-testid="resolve-scoped">{resolveScoped}</span>
        </p>
    </section>
</div>

<TesterPanel
    eyebrow="Plan 014 · Motion 14.7.1"
    title="Re-exported Motion API"
    status="New on this build: these five names were not exported before."
    {steps}
>
    {#snippet summary()}
        {#each [scopedVerdict, flingVerdict, miniVerdict, countsVerdict] as v, i (i)}
            <span class="verdict {chipClass(v)}">{v}</span>
        {/each}
    {/snippet}
    {#snippet checks()}
        <p>
            <code>createScopedAnimate</code>, <code>inertia</code>, <code>animateMini</code> and
            <code>resolveElements</code> come straight from <code>motion</code>. This page drives
            each one in a real browser. The unit tests can't cover <code>animateMini</code> (jsdom has
            no Web Animations) or how the inertia boundary spring looks when painted.
        </p>
        <p>
            Use <strong>Reset all</strong> between runs.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        padding: 1.5rem;
        max-width: 720px;
    }
    section {
        margin: 1.5rem 0;
    }
    .cards {
        display: flex;
        gap: 1rem;
        margin-top: 0.75rem;
    }
    .card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        width: 200px;
        padding: 0.75rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
    }
    .label {
        font-size: 0.75rem;
        color: #475569;
    }
    .dot {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #6366f1;
    }
    .track {
        position: relative;
        display: flex;
        align-items: center;
        width: 300px;
        height: 40px;
        margin-top: 0.75rem;
        background: #f1f5f9;
        border-radius: 999px;
    }
    .ball {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #f97316;
    }
    .wall {
        position: absolute;
        left: 264px;
        top: 0;
        bottom: 0;
        width: 4px;
        background: #334155;
    }
    .mini-box {
        width: 80px;
        height: 80px;
        margin-top: 0.75rem;
        background: #10b981;
        opacity: 1;
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
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
