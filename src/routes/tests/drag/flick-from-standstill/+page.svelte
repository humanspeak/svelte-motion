<script lang="ts">
    /**
     * Port of upstream `dev/react/src/tests/issue-1747.tsx` (Motion 14.7.1,
     * `713ac2631`, extended in `749cc1360`).
     *
     * #1747: after a short fast flick from a standstill, drag inertia started
     * much slower than the finger was moving ("abrupt deceleration"), whereas
     * the same flick while inertia was still animating felt right. motion-dom's
     * `PanSession` stamped the pointer-down history point with the stale
     * `frameData.timestamp` from the last frame before the frameloop went idle;
     * `749cc1360` stamps it with `time.now()`.
     *
     * Records pointer events and `onDragEnd` velocity on `window` for the spec.
     *
     * Under `@isPlaywright=true` this page must hold no other motion element
     * and no rAF loop: the bug only shows while motion-dom's frameloop is idle.
     * The tester readout samples with rAF only after a drag has ended.
     *
     * Deviation: the root is `position: fixed; inset: 0` rather than upstream's
     * `height: 100vh`, because the app layout flex-centres every page
     * (`app.css` `#sandbox` / `.container`) and would move the box away from
     * the top-left corner the spec presses at.
     *
     * @component
     */
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /** Globals the spec reads (upstream declares them on `Window`). */
    type FlickWindow = Window & {
        __moves: { y: number; t: number }[]
        __dragEnd: { velocity: number; t: number }[]
    }

    const w = () => window as unknown as FlickWindow

    let isPlaywright = $state(true)
    let reported = $state<number | null>(null)
    let actual = $state<number | null>(null)
    /** Index into `__moves` where the current gesture's pointerdown landed. */
    let gestureStart = 0

    onMount(() => {
        isPlaywright = window.location.search.includes('@isPlaywright=true')
        w().__moves = []
        w().__dragEnd = []
        const rec = (e: PointerEvent) => {
            if (e.type === 'pointerdown') gestureStart = w().__moves.length
            w().__moves.push({ y: e.clientY, t: e.timeStamp })
        }
        window.addEventListener('pointerdown', rec, true)
        window.addEventListener('pointermove', rec, true)
        return () => {
            window.removeEventListener('pointerdown', rec, true)
            window.removeEventListener('pointermove', rec, true)
        }
    })

    const handleDragEnd = (_event: PointerEvent, info: { velocity: { y: number } }) => {
        w().__dragEnd.push({ velocity: info.velocity.y, t: performance.now() })
        if (isPlaywright) return
        // Tester readout only. Computed once, after release, so nothing keeps
        // the frameloop awake before the next flick.
        requestAnimationFrame(() => {
            const moves = w().__moves.slice(gestureStart)
            if (moves.length < 2) return
            const first = moves[0]
            const last = moves[moves.length - 1]
            reported = info.velocity.y
            actual = last.t > first.t ? ((last.y - first.y) / (last.t - first.t)) * 1000 : 0
        })
    }

    const ok = $derived(
        reported !== null && actual !== null && Math.abs(reported) >= 0.5 * Math.abs(actual)
    )

    const steps: TesterStep[] = [
        {
            text: 'Hold still for a second, then flick the stripes up fast and short.',
            expected: 'The stripes keep gliding at flick speed instead of stopping dead.'
        },
        {
            text: 'Flick again while they are still gliding.',
            expected: 'Same glide. Both flicks should feel alike; the chip reads OK.'
        }
    ]
</script>

<svelte:head>
    <title>Drag · fast flick from a standstill (#1747)</title>
</svelte:head>

<div style="position: fixed; inset: 0; overflow: hidden">
    <motion.div
        data-testid="box"
        drag="y"
        onDragEnd={handleDragEnd}
        style="width: 300px; height: 3000px; background: repeating-linear-gradient(#f00 0 50px, #00f 50px 100px); touch-action: none"
    />
</div>

<TesterPanel
    eyebrow="Motion 14.7.1 · #1747"
    title="Fast flick from a standstill keeps its velocity"
    status="Fails on Motion 14.6.0 (release velocity near 0); passes from Motion 14.7.1."
    {steps}
>
    {#snippet summary()}
        {#if reported === null || actual === null}
            <span class="verdict na">WAITING</span>
        {:else}
            <span class="verdict {ok ? 'ok' : 'bad'}">
                {ok ? 'OK' : 'STOPPED DEAD ✗'} · release {Math.round(reported)} px/s · pointer
                {Math.round(actual)} px/s
            </span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The stripes are a tall <code>drag="y"</code> element. A short, fast flick should hand the
            inertia animation a release velocity close to the pointer's own speed.
        </p>
        <p>
            Before Motion 14.7.1 a flick from a standstill reported almost no velocity: the
            pointer-down point was timestamped with the last frame before motion's frameloop went
            idle, so the gesture looked far slower than it was. The chip reads OK when the release
            velocity is at least half the measured pointer speed.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .verdict {
        display: inline-block;
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
