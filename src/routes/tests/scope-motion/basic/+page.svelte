<script lang="ts">
    import { animate, hover, press, useScopeMotion, type ScopeState } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Motion 14.5's `scopeMotion` through svelte-motion's `useScopeMotion`
     * attachment, on plain `li`s.
     *
     * - Setup animates `'li'` to `x: 100` with NO per-call transition. The
     *   scope's default transition (`0.4s`, linear) is what drives it, so the
     *   motion is linear with no spring overshoot.
     * - The selector resolves inside the `ul` root: the `li` outside the list
     *   never moves.
     * - `hover('li')` / `press('li')` set `data-hovered` / `data-pressed`.
     *   They are collected by the scope, so after `cancel` they stop firing.
     * - `stop` freezes everything where it is; `cancel` also restores the
     *   `li`s' inline style (no transform); `refresh` cancels and re-runs setup.
     * - Upstream `stop()` keeps the styles AND forgets the snapshot
     *   (motion-dom `scope/index.ts:184-191` @ v14.5.0), so after a Stop,
     *   Cancel and Refresh start from the frozen spot until the page reloads.
     *
     * The `data-testid`s are what `e2e/scope-motion/basic.spec.ts` drives;
     * keep them stable.
     */
    const DURATION = 0.4
    const items = ['One', 'Two', 'Three']

    let scopeState = $state<ScopeState | 'detached'>('detached')
    let runs = $state(0)

    const scope = useScopeMotion<HTMLUListElement>(
        (s) => {
            runs += 1
            scopeState = s.state
            animate('li', { x: 100 })
            hover('li', (element) => {
                element.setAttribute('data-hovered', 'true')
                return () => element.removeAttribute('data-hovered')
            })
            press('li', (element) => {
                element.setAttribute('data-pressed', 'true')
            })
        },
        { transition: { duration: DURATION, ease: 'linear' } }
    )

    const sync = () => (scopeState = scope.current?.state ?? 'detached')

    const stop = () => {
        scope.current?.stop()
        sync()
    }
    const cancel = () => {
        scope.current?.cancel()
        sync()
    }
    const refresh = () => {
        watch()
        scope.current?.refresh()
        sync()
    }

    // ---- Transition meter (tester only; never under `@isPlaywright=true`) ----
    type Verdict =
        | { kind: 'glide'; from: number; progress: number; max: number; ok: boolean }
        | { kind: 'at-target'; from: number }
    let isTester = $state(false)
    let verdict = $state<Verdict | null>(null)

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const readX = () => {
        const el = document.querySelector<HTMLElement>('[data-testid="item-0"]')
        if (!el) return 0
        const match = getComputedStyle(el).transform.match(/matrix\(([^)]+)\)/)
        return match ? Number.parseFloat(match[1].split(',')[4]) : 0
    }

    /**
     * Samples the first item for 700ms after a refresh. A linear 0.4s tween
     * is about half-way to 100px at 200ms and never passes it; the default
     * spring would already be at (or past) 100px by then. Progress is
     * measured from wherever the glide starts, which after a Stop is the
     * frozen spot rather than 0.
     */
    const watch = () => {
        if (!isTester) return
        verdict = null
        const samples: { t: number; x: number }[] = []
        const start = performance.now()
        const sample = () => {
            samples.push({ t: performance.now() - start, x: readX() })
            if (performance.now() - start < 700) {
                requestAnimationFrame(sample)
                return
            }
            const from = samples[0].x
            const span = 100 - from
            if (span < 1) {
                verdict = { kind: 'at-target', from: Math.round(from) }
                return
            }
            const moving = samples.find((s) => s.x > from + 0.5)
            const t0 = moving?.t ?? 0
            const near = samples.reduce((best, s) =>
                Math.abs(s.t - t0 - 200) < Math.abs(best.t - t0 - 200) ? s : best
            )
            const progress = (near.x - from) / span
            const max = Math.max(...samples.map((s) => s.x))
            verdict = {
                kind: 'glide',
                from: Math.round(from),
                progress: Math.round(progress * 100),
                max: Math.round(max * 10) / 10,
                ok: progress > 0.3 && progress < 0.7 && max <= 101
            }
        }
        requestAnimationFrame(sample)
    }

    const steps: TesterStep[] = [
        {
            text: 'Watch the list when the page loads.',
            expected:
                'The three items slide 100px right in a steady, linear 0.4s glide (no bounce). The "Outside the scope" item never moves.'
        },
        {
            text: 'Press "Refresh".',
            expected:
                'The items jump back and glide again. The chip reads LINEAR from 0px, about 50% of the way at 200ms, with a max of 100.',
            action: { label: 'Refresh', run: refresh }
        },
        {
            text: 'Hover an item, then press it.',
            expected:
                'It shows a "hovered" tag while the pointer is over it and a "pressed" tag once pressed.'
        },
        {
            text: 'Press "Cancel", then hover and press the items again.',
            expected:
                'The items snap back to the start (their inline style is restored). State reads "cancelled". Hover and press no longer add tags.',
            action: { label: 'Cancel', run: cancel }
        },
        {
            text: 'Press "Refresh", then quickly press "Stop".',
            expected:
                'The items glide again and freeze part-way. State reads "stopped". The frozen spot is now their start: Stop keeps the styles and forgets where they began (upstream Motion).',
            action: { label: 'Refresh + Stop', run: () => (refresh(), setTimeout(stop, 200)) }
        },
        {
            text: 'Press "Refresh" again.',
            expected:
                'The glide starts from where the items froze, not from 0, and the chip reads LINEAR from that spot. "Cancel" would leave them there too. Use "Reset page" to start over.',
            action: { label: 'Refresh', run: refresh }
        }
    ]
</script>

<svelte:head>
    <title>scopeMotion — basic scope</title>
</svelte:head>

<main class="page">
    <header>
        <p class="kicker">useScopeMotion · Motion 14.5</p>
        <h1>One scope, stopped or cancelled together.</h1>
        <p class="lede">
            Setup runs <code>animate('li', &#123; x: 100 &#125;)</code> with no transition, and
            <code>hover</code>/<code>press</code> on the same selector. The scope supplies the default
            transition and collects everything.
        </p>
    </header>

    <section class="card">
        <ul class="list" data-testid="scope-root" {@attach scope}>
            {#each items as item, index (item)}
                <li class="item" data-testid="item-{index}">
                    {item}
                    <span class="tag hovered">hovered</span>
                    <span class="tag pressed">pressed</span>
                </li>
            {/each}
        </ul>
        <ul class="list">
            <li class="item outside" data-testid="outside">Outside the scope</li>
        </ul>

        <div class="controls">
            <button type="button" data-testid="stop" onclick={stop}>Stop</button>
            <button type="button" data-testid="cancel" onclick={cancel}>Cancel</button>
            <button type="button" data-testid="refresh" onclick={refresh}>Refresh</button>
        </div>

        <p class="stats">
            state: <span data-testid="state">{scopeState}</span> · setup runs:
            <span data-testid="runs">{runs}</span>
            {#if isTester && verdict}
                {#if verdict.kind === 'at-target'}
                    <span class="verdict ok" data-tester-verdict="transition">
                        ALREADY AT 100 · Stop froze it at the end, so there is nothing to glide
                    </span>
                {:else}
                    <span class="verdict" class:ok={verdict.ok} data-tester-verdict="transition">
                        {verdict.ok ? 'LINEAR' : 'NOT LINEAR'} · from {verdict.from}px · {verdict.progress}%
                        at 200ms · max {verdict.max}
                    </span>
                {/if}
            {/if}
        </p>
    </section>
</main>

<TesterPanel
    eyebrow="useScopeMotion (Motion 14.5)"
    title="Default transition, gestures, stop / cancel / refresh"
    status="Expected to pass on this build: linear glide, tags while hovering/pressing, no tags after Cancel, and after a Stop the next glide starts from the frozen spot."
    {steps}
>
    {#snippet checks()}
        <p>
            <code>useScopeMotion</code> runs setup in a <code>scopeMotion()</code> scope rooted at
            the list. Selectors resolve inside it, every <code>animate()</code> gets the scope's
            default transition, and the animation and gestures started in setup are collected so
            <code>stop()</code>, <code>cancel()</code> and <code>refresh()</code> act on them together.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    .kicker {
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.6;
    }

    h1 {
        margin: 4px 0 8px;
        font-size: 24px;
    }

    .lede {
        max-width: 560px;
        margin-bottom: 24px;
        opacity: 0.75;
    }

    .card {
        display: grid;
        gap: 16px;
        max-width: 560px;
        padding: 24px;
        border-radius: 16px;
        background: #1a1d24;
    }

    .list {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .item {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 220px;
        padding: 10px 14px;
        border-radius: 10px;
        background: #6366f1;
        font-weight: 600;
        user-select: none;
    }

    .item.outside {
        background: #374151;
    }

    .tag {
        display: none;
        padding: 1px 6px;
        border-radius: 999px;
        background: rgb(0 0 0 / 0.3);
        font-size: 11px;
        font-weight: 500;
    }

    .item:global([data-hovered]) > .tag.hovered,
    .item:global([data-pressed]) > .tag.pressed {
        display: inline-block;
    }

    .controls {
        display: flex;
        gap: 8px;
    }

    button {
        padding: 10px 18px;
        border: none;
        border-radius: 10px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .stats {
        font-family: monospace;
        opacity: 0.8;
    }

    .verdict {
        margin-left: 8px;
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }
</style>
