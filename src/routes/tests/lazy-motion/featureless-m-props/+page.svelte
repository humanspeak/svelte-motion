<script lang="ts">
    import { LazyMotion, domMin, m, motion, useMotionValue } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * What a featureless `m` still renders from its props (plan 016).
     *
     * Upstream (Motion 14.7.1) an `m` without LazyMotion features has no
     * VisualElement, but it still renders its props:
     * - `tabIndex = 0` when `onTap`, `onTapStart` or `whileTap` is set and no
     *   `tabIndex` is (`render/html/use-props.ts:76-81`), with or without
     *   gesture features. A tap on it does nothing.
     * - a style MotionValue's value at the first render, never re-read
     *   (`use-props.ts:9-49`, `motion/utils/use-visual-state.ts:134-142`).
     * - SVG attributes such as `pathLength` from `initial`
     *   (`render/svg/use-props.ts:10-40`), with no visibility hold.
     *
     * Each card pairs a bare `m` with a `motion` control. The `data-testid`s
     * are what `e2e/lazy-motion/featureless-m-props.spec.ts` drives; keep them
     * stable, and keep `tap-bare`, `tap-control` and `tap-dommin` adjacent in
     * tab order.
     */
    let bareTaps = $state(0)
    let controlTaps = $state(0)
    let dominTaps = $state(0)

    const x = useMotionValue(0)
    const nudge = () => x.set(x.get() === 0 ? 120 : 0)

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let focusable = $state<Record<string, boolean>>({})
    let bareX = $state(0)
    let controlX = $state(0)
    let bareDash = $state('')
    let firstBareDash = $state('')
    let controlDash = $state('')
    let bareVisible = $state(true)

    const translateX = (el: Element | null) => {
        if (!el) return 0
        const transform = getComputedStyle(el).transform
        return !transform || transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).e
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return
        let frame = 0
        const query = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
        const sample = () => {
            for (const id of ['tap-bare', 'tap-control', 'tap-dommin']) {
                focusable[id] = query(id)?.getAttribute('tabindex') === '0'
            }
            bareX = translateX(query('style-bare'))
            controlX = translateX(query('style-control'))
            const bare = document.querySelector('[data-testid="path-bare"]')
            const control = document.querySelector('[data-testid="path-control"]')
            bareDash = bare ? getComputedStyle(bare).strokeDasharray : ''
            if (!firstBareDash) firstBareDash = bareDash
            controlDash = control ? getComputedStyle(control).strokeDasharray : ''
            bareVisible = !!bare && getComputedStyle(bare).visibility !== 'hidden'
            frame = requestAnimationFrame(sample)
        }
        frame = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(frame)
    })

    const tapOk = $derived(
        focusable['tap-bare'] &&
            focusable['tap-control'] &&
            focusable['tap-dommin'] &&
            bareTaps === 0 &&
            controlTaps > 0
    )
    const styleOk = $derived(Math.abs(bareX) < 0.5)
    const pathOk = $derived(bareVisible && bareDash === firstBareDash)

    /** Presses and releases the bare and the control tap boxes, as a pointer would. */
    const tapBoth = () => {
        for (const id of ['tap-bare', 'tap-control']) {
            const el = document.querySelector<HTMLElement>(`[data-testid="${id}"]`)
            if (!el) continue
            const rect = el.getBoundingClientRect()
            const init = {
                bubbles: true,
                isPrimary: true,
                pointerType: 'mouse',
                button: 0,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2
            }
            el.dispatchEvent(new PointerEvent('pointerdown', { ...init, buttons: 1 }))
            el.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }))
        }
    }

    /** Remounts both paths so their first frames can be watched again. */
    let pathGeneration = $state(0)
    const replayPaths = () => {
        firstBareDash = ''
        pathGeneration += 1
    }

    const steps: TesterStep[] = [
        {
            text: 'Tap card: click the "bare" box and the "control" box. Then click the bare box once more and press Tab twice.',
            expected:
                'The bare counter stays at 0; the control counter goes up. Tab moves focus bare → control → domMin (a focus ring on each). The chip reads OK.',
            action: { label: 'Tap both', run: tapBoth }
        },
        {
            text: 'Style card: press "Nudge" a few times.',
            expected:
                'Only the control box slides right and back. The bare box never moves. The chip reads OK.',
            action: { label: 'Nudge', run: nudge }
        },
        {
            text: 'Path card: press "Replay paths" and watch both lines.',
            expected:
                'The bare line is painted at once and stays short (20%). The control line draws to its full length. The chip reads OK.',
            action: { label: 'Replay paths', run: replayPaths }
        }
    ]
</script>

<svelte:head>
    <title>LazyMotion — featureless m tabindex, style and pathLength</title>
</svelte:head>

{#snippet chip(ok: boolean, text: string)}
    {#if isTester}
        <span class="verdict" class:ok>{ok ? 'OK' : 'WRONG'} · {text}</span>
    {/if}
{/snippet}

<main class="page">
    <header>
        <p class="kicker">LazyMotion · Motion 14.7.1 render/html/use-props.ts</p>
        <h1>A featureless m renders its props and nothing else.</h1>
        <p class="lede">
            Without a VisualElement an <code>m</code> still gets <code>tabindex</code> from its tap
            props, a style MotionValue's first value and its <code>initial</code> SVG attributes. It never
            reacts.
        </p>
    </header>

    <section class="card">
        <h2>
            Tap {@render chip(
                tapOk,
                `bare taps ${bareTaps} (want 0) · control taps ${controlTaps} · domMin taps ${dominTaps}`
            )}
        </h2>
        <div class="row">
            <m.div data-testid="tap-bare" class="box" onTap={() => bareTaps++}>bare</m.div>
            <motion.div data-testid="tap-control" class="box control" onTap={() => controlTaps++}
                >control</motion.div
            >
            <LazyMotion features={domMin}>
                <m.div data-testid="tap-dommin" class="box" onTapStart={() => dominTaps++}
                    >domMin</m.div
                >
            </LazyMotion>
        </div>
        <p class="counts">
            bare: <span data-testid="tap-bare-count">{bareTaps}</span> · control:
            <span data-testid="tap-control-count">{controlTaps}</span>
        </p>
    </section>

    <section class="card">
        <h2>
            Style MotionValue {@render chip(
                styleOk,
                `bare x ${bareX.toFixed(0)}px (want 0) · control x ${controlX.toFixed(0)}px`
            )}
        </h2>
        <button type="button" data-testid="nudge" onclick={nudge}>Nudge</button>
        <div class="lane">
            <m.div data-testid="style-bare" class="box" style={{ x }}>bare</m.div>
        </div>
        <div class="lane">
            <motion.div data-testid="style-control" class="box control" style={{ x }}
                >control</motion.div
            >
        </div>
    </section>

    <section class="card">
        <h2>
            pathLength {@render chip(
                pathOk,
                `bare dasharray ${bareDash || '–'} · control ${controlDash || '–'}`
            )}
        </h2>
        {#key pathGeneration}
            <svg class="line" width="200" height="40" viewBox="0 0 200 40">
                <m.path
                    data-testid="path-bare"
                    d="M10 20 L190 20"
                    stroke="#a5b4fc"
                    stroke-width="8"
                    fill="none"
                    initial={{ pathLength: 0.2 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2 }}
                />
            </svg>
            <svg class="line" width="200" height="40" viewBox="0 0 200 40">
                <motion.path
                    data-testid="path-control"
                    d="M10 20 L190 20"
                    stroke="#38bdf8"
                    stroke-width="8"
                    fill="none"
                    initial={{ pathLength: 0.2 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.2 }}
                />
            </svg>
        {/key}
    </section>
</main>

<TesterPanel
    eyebrow="render/html/use-props.ts (Motion 14.7.1)"
    title="A featureless m renders tabindex, style and pathLength only"
    status="Expected on this build: all three chips read OK."
    {steps}
>
    {#snippet checks()}
        <p>
            Upstream <code>use-props</code> adds <code>tabIndex=0</code> for <code>onTap</code>,
            <code>onTapStart</code> and <code>whileTap</code> from props alone, so a featureless
            <code>m</code> can still be focused, but a tap on it does nothing. Its style
            MotionValues render their first value only, and an SVG <code>pathLength</code> from
            <code>initial</code> is painted at once and stays.
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
        margin: 20px 0;
        padding: 24px;
        border-radius: 16px;
        background: #1a1d24;
    }

    h2 {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        font-size: 16px;
    }

    .row {
        display: flex;
        gap: 16px;
    }

    .lane {
        height: 80px;
    }

    .counts {
        font-family: monospace;
        font-size: 13px;
    }

    :global(.box) {
        display: grid;
        place-items: center;
        width: 120px;
        height: 80px;
        border-radius: 12px;
        background: #6366f1;
        font-family: monospace;
        user-select: none;
    }

    :global(.box.control) {
        background: #0ea5e9;
    }

    :global(.box:focus-visible) {
        outline: 3px solid #facc15;
        outline-offset: 3px;
    }

    .line {
        display: block;
    }

    .verdict {
        padding: 2px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        font-size: 12px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #14532d;
    }

    button {
        justify-self: start;
        padding: 10px 18px;
        border: 0;
        border-radius: 8px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }
</style>
