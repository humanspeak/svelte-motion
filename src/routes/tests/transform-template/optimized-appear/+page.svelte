<script lang="ts">
    import { onMount } from 'svelte'
    import { motion } from '$lib'
    import type { TransformTemplate } from 'motion-dom'

    /**
     * Isolated failure page for #402, gap 2: optimized appear must never paint an
     * untemplated transform. Upstream never WAAPI-accelerates `transform` while a
     * `transformTemplate` is present, so we suppress the SSR appear bootstrap for a
     * templated, transform-animating element and let the main-thread enter run it.
     *
     * Eye-verify: full-reload this route (Cmd/Ctrl+Shift+R). Watch the SLATE box —
     * the template adds the vertical drop, so it must move down-and-right together as
     * ONE templated motion, never flashing a bare horizontal slide first. The MINT box
     * (opacity-only template) and BLUE box (no template) are baselines that keep appear.
     */

    // translateY(x) wraps the generated transform — every frame stays templated.
    const liftTemplate: TransformTemplate = ({ x }, generated) =>
        `translateY(${x ?? '0px'}) ${generated}`.trim()

    // Fixed lift regardless of latest values; used by the opacity-only baseline.
    const fixedTemplate: TransformTemplate = () => 'translateY(24px)'

    let slateStyle = $state('')
    let mintStyle = $state('')
    let blueStyle = $state('')
    let appearStarted = $state<{ id: string; name: string }[]>([])
    let fullyLoaded = $state(false)

    const transformAppearCount = $derived(
        appearStarted.filter((entry) => entry.name === 'transform').length
    )
    const opacityAppearCount = $derived(
        appearStarted.filter((entry) => entry.name === 'opacity').length
    )

    function reload() {
        if (typeof location !== 'undefined') location.reload()
    }

    onMount(() => {
        // The optimized-appear store only populates on a full server render (the SSR
        // <script> bootstrap). It is empty after client-side (SPA) navigation.
        fullyLoaded = (window.__SvelteMotionAppear?.started?.length ?? 0) > 0

        let raf = 0
        const tick = () => {
            const read = (testId: string) =>
                document
                    .querySelector<HTMLElement>(`[data-testid="${testId}"]`)
                    ?.getAttribute('style') ?? ''
            slateStyle = read('appear-slate')
            mintStyle = read('appear-mint')
            blueStyle = read('appear-blue')
            appearStarted = [...(window.__SvelteMotionAppear?.started ?? [])]
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    })
</script>

<svelte:head>
    <title>transformTemplate — optimized appear suppression (#402)</title>
</svelte:head>

<main class="page">
    <h1>Optimized appear under a transformTemplate</h1>
    <p class="expectation">
        Full-reload this route and watch the <strong>slate</strong> box: the template adds the
        vertical drop, so it must move <em>down-and-right together</em> as one templated motion —
        never flashing a bare horizontal slide first. The SSR appear bootstrap is suppressed for it
        (no <code>data-framer-appear-id</code>) so an untemplated transform can never paint first.
        The <strong>mint</strong> (opacity-only) and <strong>blue</strong> (no template) boxes are baselines
        that keep optimized appear.
    </p>

    <button type="button" class="reload" data-testid="appear-reload" onclick={reload}>
        ⟳ Full-reload to replay the enter
    </button>

    <section class="grid">
        <article>
            <h2>Templated transform — suppressed</h2>
            <div class="stage">
                <motion.div
                    class="box slate"
                    data-testid="appear-slate"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 70 }}
                    transformTemplate={liftTemplate}
                    transition={{ duration: 1.6, ease: 'linear' }}
                >
                    slate
                </motion.div>
            </div>
            <p class="expect-good">
                Expect: no appear id · transform stays <code>translateY</code>
            </p>
            <p class="mono" data-testid="appear-slate-style">{slateStyle}</p>
        </article>

        <article>
            <h2>Opacity-only template — active</h2>
            <div class="stage">
                <motion.div
                    class="box mint"
                    data-testid="appear-mint"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transformTemplate={fixedTemplate}
                    transition={{ duration: 1.6, ease: 'linear' }}
                >
                    mint
                </motion.div>
            </div>
            <p class="expect-good">Expect: keeps appear id · <code>translateY(24px)</code> fixed</p>
            <p class="mono" data-testid="appear-mint-style">{mintStyle}</p>
        </article>

        <article>
            <h2>No template — accelerated baseline</h2>
            <div class="stage">
                <motion.div
                    class="box blue"
                    data-testid="appear-blue"
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: 70 }}
                    transition={{ duration: 1.6, ease: 'linear' }}
                >
                    blue
                </motion.div>
            </div>
            <p class="expect-good">Expect: keeps appear id · accelerated transform</p>
            <p class="mono" data-testid="appear-blue-style">{blueStyle}</p>
        </article>
    </section>

    <dl class="stats" data-testid="appear-stats">
        <dt>Full server render?</dt>
        <dd data-testid="appear-fully-loaded">{fullyLoaded ? 'yes' : 'no (SPA nav — reload)'}</dd>
        <dt>Optimized-appear <em>transform</em> animations</dt>
        <dd data-testid="appear-transform-count" class:good={transformAppearCount === 1}>
            {transformAppearCount} (expect 1 — blue baseline only; slate suppressed)
        </dd>
        <dt>Optimized-appear <em>opacity</em> animations</dt>
        <dd data-testid="appear-opacity-count">{opacityAppearCount}</dd>
    </dl>
</main>

<style>
    /* Dark backdrop so the light heading/description text stays readable
       regardless of the app's default (light) page background. */
    :global(body) {
        background: #0a0f1c;
    }
    .page {
        margin: 0 auto;
        min-height: 100vh;
        max-width: 940px;
        padding: 2rem 1rem;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }
    h1 {
        font-size: 1.4rem;
        font-weight: 600;
    }
    h2 {
        font-size: 0.95rem;
        font-weight: 600;
        margin: 0 0 0.5rem;
    }
    .expectation {
        margin: 0.5rem 0 1rem;
        color: #cbd5e1;
        line-height: 1.5;
    }
    code {
        background: #1e293b;
        padding: 0.05rem 0.3rem;
        border-radius: 0.25rem;
    }
    .reload {
        background: #1d4ed8;
        color: white;
        border: 0;
        border-radius: 0.4rem;
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        cursor: pointer;
        margin-bottom: 1.5rem;
    }
    .reload:hover {
        background: #2563eb;
    }
    .grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    }
    article {
        background: #0b1220;
        border: 1px solid #1e293b;
        border-radius: 0.5rem;
        padding: 1rem;
    }
    .stage {
        position: relative;
        height: 150px;
        border-radius: 0.4rem;
        background: #060b16;
        overflow: hidden;
    }
    /* Scoped classes don't pierce into the <motion.div> component's rendered
       element, so the box styles must be global to take effect. */
    :global(.stage .box) {
        position: absolute;
        top: 14px;
        left: 14px;
        width: 52px;
        height: 52px;
        border-radius: 0.5rem;
        display: grid;
        place-items: center;
        font-size: 0.75rem;
        color: white;
    }
    :global(.stage .box.slate) {
        background: linear-gradient(135deg, #64748b, #334155);
    }
    :global(.stage .box.mint) {
        background: linear-gradient(135deg, #34d399, #059669);
    }
    :global(.stage .box.blue) {
        background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    }
    .expect-good {
        margin: 0.6rem 0 0.3rem;
        color: #94a3b8;
        font-size: 0.78rem;
    }
    .mono {
        font-family: ui-monospace, monospace;
        font-size: 0.7rem;
        color: #cbd5e1;
        word-break: break-all;
        margin: 0;
        /* Reserve height so cards don't reflow as the live style string changes. */
        min-height: 2.4em;
    }
    .stats {
        display: grid;
        grid-template-columns: 22rem 1fr;
        gap: 0.35rem 1rem;
        background: #0b1220;
        border: 1px solid #1e293b;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-top: 1.5rem;
        font-size: 0.85rem;
    }
    .stats dt {
        color: #94a3b8;
    }
    .stats dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
    }
    .stats dd.good {
        color: #34d399;
        font-weight: 700;
    }
</style>
