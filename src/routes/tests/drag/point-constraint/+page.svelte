<script lang="ts">
    /**
     * Function `dragConstraints` through `motion.div` (Motion 14.10).
     *
     * Ported from upstream motion-dom
     * `gestures/drag/__tests__/point-constraint.test.ts` @ v14.10.1: the
     * constraint function runs when each drag starts and receives
     * `{ visualElement, originPoint, elastic, getAxisMotionValue, getProps }`.
     * It returns a `DragPointConstraint`: drag writes the pointer's position
     * into the point's `x`/`y`, then calls `move()`, which here sets the `x`
     * motion value straight to `point.x` (the element follows the pointer).
     * `release()` resolves at once, so there's no inertia on release.
     *
     * `props-drag` shows `ctx.getProps().drag`: the drag's own options, read
     * from the constraint function (new in 14.10). It reads `x` here.
     *
     * The `data-testid`s are what `e2e/drag/point-constraint.spec.ts` drives;
     * keep them stable.
     *
     * @component
     */
    import { motion, type DragConstraintsFunction, type DragPointConstraint } from '$lib'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    let propsDrag = $state('—')
    let calls = $state(0)

    const constraints: DragConstraintsFunction = (ctx) => {
        calls += 1
        propsDrag = String(ctx.getProps().drag)
        const x = ctx.getAxisMotionValue('x')
        const point: DragPointConstraint = {
            ...ctx.originPoint,
            move() {
                x.set(point.x)
            },
            release() {
                return Promise.resolve()
            }
        }
        return point
    }

    const steps: TesterStep[] = [
        {
            text: 'Drag the box right.',
            expected: 'It follows; the readout says x.'
        },
        {
            text: 'Release, then drag it again.',
            expected: 'It stops where you let go (no glide), and the call counter goes up by one.'
        }
    ]
</script>

<svelte:head>
    <title>Drag · function dragConstraints with getProps()</title>
</svelte:head>

<main class="page">
    <header>
        <p class="kicker">dragConstraints function · Motion 14.10</p>
        <h1>A constraint function moves the element itself.</h1>
    </header>

    <div class="track">
        <motion.div
            drag="x"
            dragConstraints={constraints}
            data-testid="point"
            style="display:grid;place-items:center;width:80px;height:80px;border-radius:16px;background:#60a5fa;color:#0f1115;font-size:12px;font-weight:600;cursor:grab;"
        >
            point
        </motion.div>
    </div>

    <p class="status">
        getProps().drag = <span data-testid="props-drag">{propsDrag}</span> · calls =
        <span data-testid="constraint-calls">{calls}</span>
    </p>
</main>

<TesterPanel
    eyebrow="Motion 14.10 · dragConstraints"
    title="Function constraints get getProps()"
    status="Expected to pass on this build (Motion 14.10.1)."
    {steps}
>
    {#snippet checks()}
        <p>
            <code>dragConstraints</code> can be a function. It runs when each drag starts and
            returns a point with <code>move()</code> and <code>release()</code>. Since Motion 14.10
            its context also has <code>getProps()</code>, the drag's options, so the function can
            see which axes the drag moves.
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

    .track {
        width: 480px;
        height: 100px;
        padding: 10px 0;
    }

    .status {
        font-family: monospace;
        font-size: 12px;
        opacity: 0.7;
    }
</style>
