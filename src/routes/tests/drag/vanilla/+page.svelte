<script lang="ts">
    import { animate, drag, motion, type DragInfo } from '$lib'
    import { visualElementStore } from 'motion-dom'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Motion 14.4's vanilla `drag()` on plain elements, re-exported unwrapped
     * from Motion.
     *
     * - `axis`: `drag(el, { axis: 'x', constraints: { left: 0, right: 200 } })`.
     * - `handoff`: `animate(el, { x: 120 })` first, then `drag(el)`. The drag
     *   continues from 120 because both share the element's `x` motion value
     *   (upstream `74578076e`).
     * - `container`: `drag(el, { constraints: containerEl })`.
     * - `motion-plus-drag`: a `motion.div drag="x"` that is also passed to
     *   `drag()` once its projection node is mounted moves once. Upstream's
     *   `drag()` has no guard; it attaches a second controller, but Motion's
     *   global drag lock and the shared `x` motion value keep a 100px drag at
     *   ~100px, not 200px.
     *
     * The `data-testid`s are what `e2e/drag/vanilla.spec.ts` drives; keep them
     * stable.
     */
    type Id = 'axis' | 'handoff' | 'container' | 'motion-plus-drag'

    let axisEl = $state<HTMLElement | null>(null)
    let handoffEl = $state<HTMLElement | null>(null)
    let containerBox = $state<HTMLElement | null>(null)
    let containerEl = $state<HTMLElement | null>(null)
    let motionPlusDragEl = $state<HTMLElement | null>(null)

    let handoffReady = $state(false)
    let motionPlusDragAttached = $state(false)

    /** The element's current translateX, read from its computed transform. */
    const readX = (el: HTMLElement | null) =>
        el ? new DOMMatrixReadOnly(getComputedStyle(el).transform).m41 : 0

    // ---- Tester verdicts (never shown under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let verdicts = $state<Partial<Record<Id, { ok: boolean; detail: string }>>>({})
    let handoffMinX = Infinity
    let motionPlusDragOffset = 0
    let motionPlusDragStartX = 0

    /**
     * Runs `run` once `el` has come to rest: its box unchanged for 10 frames,
     * or after 5s. A release past an elastic edge can take over a second to
     * spring back, so a fixed delay would judge it mid-return.
     */
    const settle = (el: HTMLElement, run: () => void) => {
        const start = performance.now()
        let last: DOMRect | null = null
        let still = 0
        const tick = () => {
            const rect = el.getBoundingClientRect()
            const moved =
                !last ||
                Math.abs(rect.left - last.left) > 0.1 ||
                Math.abs(rect.top - last.top) > 0.1
            still = moved ? 0 : still + 1
            last = rect
            if (still >= 10 || performance.now() - start > 5000) run()
            else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
    }

    onMount(() => {
        isTester = !window.location.search.includes('@isPlaywright=true')
        const stops: VoidFunction[] = []
        let disposed = false

        if (axisEl) {
            const el = axisEl
            stops.push(
                drag(el, {
                    axis: 'x',
                    constraints: { left: 0, right: 200 },
                    onEnd: () =>
                        settle(el, () => {
                            const x = readX(el)
                            verdicts.axis = {
                                ok: x >= -2 && x <= 202,
                                detail: `x = ${x.toFixed(0)}`
                            }
                        })
                })
            )
        }

        if (handoffEl) {
            const el = handoffEl
            void animate(el, { x: 120 }, { duration: 0.1 }).then(() => {
                if (disposed) return
                stops.push(
                    drag(el, {
                        onStart: () => (handoffMinX = Infinity),
                        onMove: () => (handoffMinX = Math.min(handoffMinX, readX(el))),
                        onEnd: () => {
                            const minX = handoffMinX
                            verdicts.handoff = {
                                ok: minX >= 100,
                                detail: `lowest x while dragging = ${minX.toFixed(0)}`
                            }
                        }
                    })
                )
                handoffReady = true
            })
        }

        if (containerBox && containerEl) {
            const el = containerBox
            const bounds = containerEl
            stops.push(
                drag(el, {
                    constraints: bounds,
                    onEnd: () =>
                        settle(el, () => {
                            const r = el.getBoundingClientRect()
                            const c = bounds.getBoundingClientRect()
                            const ok =
                                r.left >= c.left - 2 &&
                                r.right <= c.right + 2 &&
                                r.top >= c.top - 2 &&
                                r.bottom <= c.bottom + 2
                            verdicts.container = { ok, detail: ok ? 'inside' : 'escaped' }
                        })
                })
            )
        }

        // Attach once the motion.div's projection node is mounted, so drag()
        // reuses it instead of creating an imperative one: the same check as
        // upstream acquireProjectionNode (motion-dom
        // `layout/LayoutAnimationBuilder.ts:186-196` @ v14.5.0). Unlike
        // `data-is-loaded`, it works outside `@isPlaywright` too.
        const waitForMotionPlusDrag = setInterval(() => {
            const el = motionPlusDragEl
            if (!el || !visualElementStore.get(el)?.projection?.instance) return
            clearInterval(waitForMotionPlusDrag)
            stops.push(drag(el, { axis: 'x' }))
            motionPlusDragAttached = true
        }, 50)

        return () => {
            disposed = true
            clearInterval(waitForMotionPlusDrag)
            stops.forEach((stop) => stop())
        }
    })

    const steps: TesterStep[] = [
        {
            text: 'Drag the "axis" box far to the right, then up and down.',
            expected:
                'It only moves horizontally and stops at 200px from where it started. The chip reads PASS.'
        },
        {
            text: 'Drag the "handoff" box a little to the right.',
            expected:
                'It was already moved 120px by animate(). The drag continues from there instead of jumping back to the left edge. The chip reads PASS.'
        },
        {
            text: 'Drag the "container" box hard toward any edge.',
            expected: 'It never leaves the dashed container. The chip reads PASS.'
        },
        {
            text: 'Drag the "motion + drag()" box (a motion.div with drag="x", also passed to drag()) about 100px to the right.',
            expected:
                'It follows the pointer 1:1 (it does not run ahead at double speed). The chip reads PASS.'
        }
    ]
</script>

<svelte:head>
    <title>drag() — vanilla drag on plain elements</title>
</svelte:head>

{#snippet verdict(id: Id)}
    {#if isTester && verdicts[id]}
        <span class="verdict" class:ok={verdicts[id]!.ok} data-tester-verdict={id}>
            {verdicts[id]!.ok ? 'PASS' : 'FAIL'} · {verdicts[id]!.detail}
        </span>
    {/if}
{/snippet}

<main class="page">
    <header>
        <p class="kicker">drag() · Motion 14.4</p>
        <h1>Vanilla drag on plain elements.</h1>
    </header>

    <div class="grid">
        <section class="card">
            <h2>axis · <code>{"{ axis: 'x', constraints: { left: 0, right: 200 } }"}</code></h2>
            <div class="track">
                <div class="box" bind:this={axisEl} data-testid="vanilla-axis">axis</div>
            </div>
            {@render verdict('axis')}
        </section>

        <section class="card">
            <h2>handoff · <code>animate(x: 120)</code> then <code>drag()</code></h2>
            <div class="track">
                <div
                    class="box"
                    bind:this={handoffEl}
                    data-testid="vanilla-handoff"
                    data-ready={handoffReady}
                >
                    handoff
                </div>
            </div>
            {@render verdict('handoff')}
        </section>

        <section class="card">
            <h2>container · <code>{'{ constraints: containerEl }'}</code></h2>
            <div class="container" bind:this={containerEl} data-testid="vanilla-container">
                <div class="box" bind:this={containerBox} data-testid="vanilla-container-box">
                    box
                </div>
            </div>
            {@render verdict('container')}
        </section>

        <section class="card">
            <h2>motion-plus-drag · <code>motion.div drag="x"</code> + <code>drag()</code></h2>
            <div class="track">
                <motion.div
                    drag="x"
                    dragMomentum={false}
                    bind:ref={motionPlusDragEl}
                    data-testid="vanilla-motion-plus-drag"
                    style="display:grid;place-items:center;width:60px;height:60px;border-radius:12px;background:#f472b6;color:#0f1115;font-size:12px;font-weight:600;cursor:grab;"
                    onDragStart={() => (motionPlusDragStartX = readX(motionPlusDragEl))}
                    onDrag={(_event: PointerEvent, info: DragInfo) =>
                        (motionPlusDragOffset = info.offset.x)}
                    onDragEnd={() =>
                        setTimeout(() => {
                            const moved = readX(motionPlusDragEl) - motionPlusDragStartX
                            verdicts['motion-plus-drag'] = {
                                ok: Math.abs(moved - motionPlusDragOffset) < 20,
                                detail: `moved ${moved.toFixed(0)}px for a ${motionPlusDragOffset.toFixed(0)}px drag`
                            }
                        }, 100)}
                >
                    motion + drag()
                </motion.div>
            </div>
            <p
                class="status"
                data-testid="vanilla-motion-plus-drag-status"
                data-attached={motionPlusDragAttached}
            >
                {motionPlusDragAttached
                    ? 'drag() attached alongside the motion.div drag'
                    : 'waiting for the projection node to mount…'}
            </p>
            {@render verdict('motion-plus-drag')}
        </section>
    </div>
</main>

<TesterPanel
    eyebrow="drag() (Motion 14.4)"
    title="Plain elements drag; motion.* + drag() moves once"
    status="Expected to pass on this build: all four chips read PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            <code>drag()</code> makes a plain element draggable without a component. Its
            <code>x</code>/<code>y</code> are shared with <code>animate()</code>, so a drag picks up
            where an animation left off. Like Motion, svelte-motion doesn't guard against an element
            that already drags through a <code>motion.*</code> component: <code>drag()</code>
            attaches, and the drag lock plus the shared <code>x</code> keep it moving once.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .page {
        min-height: 100vh;
        padding: 24px 48px;
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
        margin: 4px 0 16px;
        font-size: 22px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(2, 480px);
        gap: 16px;
    }

    .card {
        display: grid;
        align-content: start;
        gap: 10px;
        padding: 16px;
        border-radius: 16px;
        background: #1a1d24;
    }

    h2 {
        font-size: 13px;
        font-weight: 500;
    }

    .track {
        height: 80px;
        padding: 10px 0;
    }

    .container {
        position: relative;
        width: 300px;
        height: 160px;
        border: 2px dashed #6366f1;
        border-radius: 12px;
    }

    .container .box {
        position: absolute;
        top: 50px;
        left: 110px;
    }

    .box {
        display: grid;
        place-items: center;
        width: 60px;
        height: 60px;
        border-radius: 12px;
        background: #60a5fa;
        color: #0f1115;
        font-size: 12px;
        font-weight: 600;
        cursor: grab;
    }

    .status {
        font-family: monospace;
        font-size: 12px;
        opacity: 0.7;
    }

    .verdict {
        justify-self: start;
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
