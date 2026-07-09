<script lang="ts">
    import { motion, motionValue } from '$lib'

    /**
     * Style-routed: `cx` is a CSS property in Chromium, so `svgEffect` writes it to
     * `element.style`. The same MotionValue also drives `x2` on the chart line,
     * which is attribute-routed — one value, both channels.
     */
    const cx = motionValue(40)

    /** Style-routed, kebab-cased — the spelling a Svelte author actually writes. */
    const strokeWidth = motionValue(4)

    /** Style-routed. The ring sweeps by shrinking its dash offset. */
    const RING_CIRCUMFERENCE = 2 * Math.PI * 30
    const dashOffset = motionValue(RING_CIRCUMFERENCE * 0.35)

    /** Attribute-routed: rendered as the `x` / `y` / `scale` attributes. */
    const attrX = motionValue(10)
    const attrY = motionValue(10)
    const attrScale = motionValue(1)

    // Buttons (used by e2e) and sliders both drive the same MotionValues.
    const bumpCx = () => cx.set(Math.min(280, cx.get() + 20))
    const bumpStrokeWidth = () => strokeWidth.set(Math.min(20, strokeWidth.get() + 3))
    const advanceProgress = () => dashOffset.set(Math.max(0, dashOffset.get() - 40))
    const bumpAttrX = () => attrX.set(Math.min(240, attrX.get() + 15))

    const reset = () => {
        cx.set(40)
        strokeWidth.set(4)
        dashOffset.set(RING_CIRCUMFERENCE * 0.35)
        attrX.set(10)
        attrY.set(10)
        attrScale.set(1)
    }

    /** Toggle: unmount/remount the whole SVG to exercise subscription teardown. */
    let mounted = $state(true)

    /**
     * Toggle: force an unrelated Svelte re-render (a class change). The attribute
     * spread must not clobber a value that `svgEffect` owns.
     */
    let highlight = $state(false)

    /** Live readout of both DOM channels, sampled every frame. */
    type Row = { label: string; prop: string; channel: string; attr: string; style: string }
    let rows = $state<Row[]>([])

    const WATCHED: { testid: string; label: string; prop: string; channel: string }[] = [
        { testid: 'mv-circle', label: 'circle (bound)', prop: 'cx', channel: 'style' },
        { testid: 'static-circle', label: 'circle (plain 5)', prop: 'cx', channel: 'style' },
        { testid: 'kebab-circle', label: 'circle', prop: 'stroke-width', channel: 'style' },
        { testid: 'progress-ring', label: 'ring', prop: 'stroke-dashoffset', channel: 'style' },
        { testid: 'chart-line', label: 'line', prop: 'x2', channel: 'attribute' },
        { testid: 'attr-rect', label: 'rect (attrX)', prop: 'x', channel: 'attribute' },
        { testid: 'attr-rect', label: 'rect (attrY)', prop: 'y', channel: 'attribute' },
        { testid: 'attr-rect', label: 'rect (attrScale)', prop: 'scale', channel: 'attribute' }
    ]

    $effect(() => {
        let raf = 0
        const tick = () => {
            rows = WATCHED.map(({ testid, label, prop, channel }) => {
                const el = document.querySelector(`[data-testid="${testid}"]`)
                return {
                    label,
                    prop,
                    channel,
                    attr: el?.getAttribute(prop) ?? '—',
                    style: el ? getComputedStyle(el).getPropertyValue(prop) || '—' : '—'
                }
            })
            raf = requestAnimationFrame(tick)
        }
        tick()
        return () => cancelAnimationFrame(raf)
    })

    const hasObjectObject = $derived(rows.some((r) => r.attr.includes('[object Object]')))
</script>

<svelte:head>
    <title>SVG MotionValue attributes</title>
</svelte:head>

<main class="min-h-screen bg-slate-950 p-8 text-slate-100">
    <h1 class="mb-2 text-2xl font-semibold">SVG MotionValue attributes</h1>

    <div class="mb-6 max-w-3xl space-y-3 text-sm leading-relaxed text-slate-300">
        <p>
            <strong class="text-slate-100">What this page tests.</strong> Binding a
            <code class="rounded bg-slate-800 px-1">MotionValue</code> straight to an SVG
            presentation attribute — <code class="rounded bg-slate-800 px-1">cx</code>,
            <code class="rounded bg-slate-800 px-1">stroke-width</code>,
            <code class="rounded bg-slate-800 px-1">attrX</code> — instead of animating it. Before
            this feature the value was spread raw onto the element and rendered as the literal
            string <code class="rounded bg-slate-800 px-1">[object Object]</code>.
        </p>
        <p>
            <strong class="text-slate-100">The subtlety.</strong>
            <code class="rounded bg-slate-800 px-1">svgEffect</code> writes to
            <em>two different DOM channels</em>. Keys that are CSS properties in the browser (<code
                class="rounded bg-slate-800 px-1">cx</code
            >,
            <code class="rounded bg-slate-800 px-1">r</code>,
            <code class="rounded bg-slate-800 px-1">stroke-*</code>) go to
            <code class="rounded bg-slate-800 px-1">element.style</code> — their
            <em>attribute</em> never changes. Everything else (<code
                class="rounded bg-slate-800 px-1">x2</code
            >,
            <code class="rounded bg-slate-800 px-1">attrX</code>) goes to
            <code class="rounded bg-slate-800 px-1">setAttribute</code>. The table shows both, so
            you can see which channel each key actually moves.
        </p>
    </div>

    <!-- Verdict banner -->
    <div
        data-testid="verdict"
        class="mb-6 inline-block rounded px-3 py-2 text-sm font-medium {hasObjectObject
            ? 'bg-red-900 text-red-100'
            : 'bg-emerald-900 text-emerald-100'}"
    >
        {hasObjectObject
            ? '✗ FAIL — [object Object] found in the DOM'
            : '✓ PASS — no [object Object] in any watched attribute'}
    </div>

    <div class="flex flex-wrap gap-8">
        <!-- Controls -->
        <section class="w-80 shrink-0 space-y-4 rounded-lg bg-slate-900 p-4">
            <h2 class="text-lg font-medium">Controls</h2>

            <label class="block text-sm">
                <span class="mb-1 flex justify-between">
                    <span>cx (and line x2)</span>
                    <span class="font-mono text-slate-400">{rows[0]?.style ?? ''}</span>
                </span>
                <input
                    data-testid="slider-cx"
                    type="range"
                    min="10"
                    max="280"
                    value="40"
                    class="w-full"
                    oninput={(e) => cx.set(Number(e.currentTarget.value))}
                />
            </label>

            <label class="block text-sm">
                <span class="mb-1 block">stroke-width (kebab-case prop)</span>
                <input
                    data-testid="slider-stroke-width"
                    type="range"
                    min="1"
                    max="20"
                    value="4"
                    class="w-full"
                    oninput={(e) => strokeWidth.set(Number(e.currentTarget.value))}
                />
            </label>

            <label class="block text-sm">
                <span class="mb-1 block">progress (stroke-dashoffset)</span>
                <input
                    data-testid="slider-progress"
                    type="range"
                    min="0"
                    max={RING_CIRCUMFERENCE}
                    value={RING_CIRCUMFERENCE * 0.35}
                    step="0.1"
                    class="w-full"
                    oninput={(e) => dashOffset.set(Number(e.currentTarget.value))}
                />
            </label>

            <label class="block text-sm">
                <span class="mb-1 block">attrX → x attribute</span>
                <input
                    data-testid="slider-attr-x"
                    type="range"
                    min="0"
                    max="240"
                    value="10"
                    class="w-full"
                    oninput={(e) => attrX.set(Number(e.currentTarget.value))}
                />
            </label>

            <label class="block text-sm">
                <span class="mb-1 block">attrY → y attribute</span>
                <input
                    data-testid="slider-attr-y"
                    type="range"
                    min="0"
                    max="70"
                    value="10"
                    class="w-full"
                    oninput={(e) => attrY.set(Number(e.currentTarget.value))}
                />
            </label>

            <label class="block text-sm">
                <span class="mb-1 block">attrScale → scale attribute</span>
                <input
                    data-testid="slider-attr-scale"
                    type="range"
                    min="0.5"
                    max="3"
                    step="0.1"
                    value="1"
                    class="w-full"
                    oninput={(e) => attrScale.set(Number(e.currentTarget.value))}
                />
            </label>

            <div class="grid grid-cols-2 gap-2 pt-2">
                <button
                    data-testid="bump-cx"
                    class="rounded bg-blue-600 px-2 py-1 text-sm hover:bg-blue-500"
                    onclick={bumpCx}>Bump cx</button
                >
                <button
                    data-testid="bump-stroke-width"
                    class="rounded bg-pink-600 px-2 py-1 text-sm hover:bg-pink-500"
                    onclick={bumpStrokeWidth}>Bump stroke-width</button
                >
                <button
                    data-testid="advance-progress"
                    class="rounded bg-amber-600 px-2 py-1 text-sm hover:bg-amber-500"
                    onclick={advanceProgress}>Advance progress</button
                >
                <button
                    data-testid="bump-attr-x"
                    class="rounded bg-violet-600 px-2 py-1 text-sm hover:bg-violet-500"
                    onclick={bumpAttrX}>Bump attrX</button
                >
                <button
                    data-testid="reset"
                    class="col-span-2 rounded bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600"
                    onclick={reset}>Reset all</button
                >
            </div>

            <div class="space-y-2 border-t border-slate-700 pt-3 text-sm">
                <label class="flex items-center gap-2">
                    <input data-testid="toggle-mounted" type="checkbox" bind:checked={mounted} />
                    <span>Mounted <span class="text-slate-400">(tests teardown)</span></span>
                </label>
                <label class="flex items-center gap-2">
                    <input
                        data-testid="toggle-highlight"
                        type="checkbox"
                        bind:checked={highlight}
                    />
                    <span>
                        Force re-render
                        <span class="text-slate-400">(class change must not clobber attrs)</span>
                    </span>
                </label>
            </div>
        </section>

        <!-- Live figures -->
        <section class="space-y-6">
            {#if mounted}
                <div>
                    <h3 class="mb-1 text-sm font-medium text-slate-300">
                        Style-routed: cx, stroke-width &nbsp;·&nbsp; Attribute-routed: x2
                    </h3>
                    <svg
                        width="300"
                        height="120"
                        viewBox="0 0 300 120"
                        class="rounded bg-slate-800 {highlight ? 'ring-2 ring-yellow-400' : ''}"
                    >
                        <motion.circle data-testid="mv-circle" {cx} cy={45} r={12} fill="#60a5fa" />
                        <motion.circle
                            data-testid="kebab-circle"
                            cx={250}
                            cy={45}
                            r={20}
                            fill="none"
                            stroke="#f472b6"
                            stroke-width={strokeWidth}
                        />
                        <motion.line
                            data-testid="chart-line"
                            x1={10}
                            y1={95}
                            x2={cx}
                            y2={95}
                            stroke="#34d399"
                            stroke-width="3"
                        />
                        <motion.circle
                            data-testid="static-circle"
                            cx={5}
                            cy={112}
                            r={3}
                            fill="#94a3b8"
                        />
                    </svg>
                </div>

                <div>
                    <h3 class="mb-1 text-sm font-medium text-slate-300">
                        Progress ring: stroke-dashoffset (style-routed)
                    </h3>
                    <svg
                        width="140"
                        height="140"
                        viewBox="0 0 120 120"
                        class="rounded bg-slate-800"
                    >
                        <circle
                            cx="60"
                            cy="60"
                            r="30"
                            fill="none"
                            stroke="#334155"
                            stroke-width="8"
                        />
                        <motion.circle
                            data-testid="progress-ring"
                            cx={60}
                            cy={60}
                            r={30}
                            fill="none"
                            stroke="#fbbf24"
                            stroke-width="8"
                            stroke-linecap="round"
                            stroke-dasharray={RING_CIRCUMFERENCE}
                            stroke-dashoffset={dashOffset}
                            transform="rotate(-90 60 60)"
                        />
                    </svg>
                </div>

                <div>
                    <h3 class="mb-1 text-sm font-medium text-slate-300">
                        Attribute-routed: attrX / attrY / attrScale
                    </h3>
                    <svg
                        width="300"
                        height="120"
                        viewBox="0 0 300 120"
                        class="rounded bg-slate-800"
                    >
                        <motion.rect
                            data-testid="attr-rect"
                            {attrX}
                            {attrY}
                            {attrScale}
                            width={40}
                            height={40}
                            fill="#a78bfa"
                        />
                    </svg>
                </div>
            {:else}
                <p class="rounded bg-slate-900 p-8 text-sm text-slate-400">
                    Unmounted. Re-check the box to remount — values should reattach without
                    <code>[object Object]</code> and without a flash.
                </p>
            {/if}
        </section>

        <!-- Metrics -->
        <section class="min-w-[26rem] flex-1">
            <h2 class="mb-2 text-lg font-medium">Live DOM channels</h2>
            <p class="mb-3 text-xs text-slate-400">
                Sampled every animation frame. A style-routed key moves in the
                <strong>computed style</strong> column while its attribute stays frozen at the server-rendered
                seed — that is correct, not a bug.
            </p>
            <table class="w-full border-collapse text-left font-mono text-xs">
                <thead>
                    <tr class="border-b border-slate-700 text-slate-400">
                        <th class="py-2 pr-3 font-medium">element</th>
                        <th class="py-2 pr-3 font-medium">prop</th>
                        <th class="py-2 pr-3 font-medium">channel</th>
                        <th class="py-2 pr-3 font-medium">getAttribute()</th>
                        <th class="py-2 font-medium">computed style</th>
                    </tr>
                </thead>
                <tbody>
                    {#each rows as row (row.label + row.prop)}
                        <tr class="border-b border-slate-800/60">
                            <td class="py-1.5 pr-3 text-slate-300">{row.label}</td>
                            <td class="py-1.5 pr-3 text-slate-100">{row.prop}</td>
                            <td class="py-1.5 pr-3">
                                <span
                                    class={row.channel === 'style'
                                        ? 'text-sky-400'
                                        : 'text-violet-400'}
                                >
                                    {row.channel}
                                </span>
                            </td>
                            <td
                                class="py-1.5 pr-3 {row.attr.includes('[object Object]')
                                    ? 'bg-red-900 text-red-100'
                                    : 'text-slate-300'}"
                            >
                                {row.attr}
                            </td>
                            <td class="py-1.5 text-emerald-300">{row.style}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </section>
    </div>
</main>
