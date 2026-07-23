<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'

    // Live instrumentation: samples the card's computed scale every frame and
    // derives velocity so the momentum carry (or its absence) is visible as
    // numbers, not just feel. Purely observational — no library interaction.
    let scale = $state(1)
    let velocity = $state(0) // scale units / second, EMA-smoothed
    let peakVelocity = $state(0)
    let log = $state<string[]>([])
    let pressScale = $state<number | null>(null)
    let postPressPeak = $state<number | null>(null)
    let verdict = $state('—')
    let pressWatchUntil = 0

    const now = () => performance.now()
    const fmt = (n: number, d = 3) => n.toFixed(d)

    const pushLog = (line: string) => {
        log = [`${(now() / 1000).toFixed(2)}s  ${line}`, ...log].slice(0, 8)
    }

    const readScale = (el: Element): number => {
        const t = getComputedStyle(el).transform
        if (!t || t === 'none') return 1
        const m = t.match(/matrix\(([^)]+)\)/)
        if (!m) return 1
        const [a, b] = m[1].split(',').map((v) => Number.parseFloat(v.trim()))
        return Math.hypot(a, b)
    }

    onMount(() => {
        const el = document.querySelector('[data-testid="motion-hover-velocity-continuity"]')
        if (!el) return
        let raf = 0
        let prevScale = readScale(el)
        let prevT = now()
        const tickFrame = () => {
            const t = now()
            const s = readScale(el)
            const dt = (t - prevT) / 1000
            if (dt > 0) {
                const v = (s - prevScale) / dt
                velocity = velocity * 0.6 + v * 0.4
                if (Math.abs(velocity) > Math.abs(peakVelocity)) peakVelocity = velocity
            }
            scale = s
            // Track the post-press peak for the momentum verdict: with velocity
            // carried, scale keeps CLIMBING past the press point before it
            // reverses toward 0.9. With velocity discarded it reverses at once.
            if (pressScale !== null && t < pressWatchUntil) {
                if (postPressPeak === null || s > postPressPeak) postPressPeak = s
                const gain = (postPressPeak ?? s) - pressScale
                verdict =
                    gain > 0.01
                        ? `✓ MOMENTUM CARRIED — climbed +${fmt(gain)} past the press point before reversing`
                        : `✗ velocity discarded — reversed immediately (gain ${fmt(gain)})`
            }
            prevScale = s
            prevT = t
            raf = requestAnimationFrame(tickFrame)
        }
        raf = requestAnimationFrame(tickFrame)

        const onEnter = () =>
            pushLog(`hover-start  @ scale ${fmt(readScale(el))} → springing to 1.5`)
        const onDown = () => {
            pressScale = readScale(el)
            postPressPeak = null
            pressWatchUntil = now() + 450
            verdict = 'watching…'
            pushLog(
                `PRESS        @ scale ${fmt(pressScale)}, velocity ${fmt(velocity, 2)}/s → re-target 0.9`
            )
        }
        const onUp = () => pushLog(`release      @ scale ${fmt(readScale(el))}`)
        const onLeave = () => pushLog(`hover-end    @ scale ${fmt(readScale(el))} → unwind to 1`)
        el.addEventListener('pointerenter', onEnter)
        el.addEventListener('pointerdown', onDown)
        el.addEventListener('pointerup', onUp)
        el.addEventListener('pointerleave', onLeave)
        return () => {
            cancelAnimationFrame(raf)
            el.removeEventListener('pointerenter', onEnter)
            el.removeEventListener('pointerdown', onDown)
            el.removeEventListener('pointerup', onUp)
            el.removeEventListener('pointerleave', onLeave)
        }
    })
</script>

<svelte:head>
    <title>hover velocity continuity test</title>
</svelte:head>

<main>
    <section class="panel">
        <div class="copy">
            <p class="eyebrow">velocity continuity</p>
            <h1>Interrupts must carry momentum.</h1>
            <ul>
                <li>
                    <strong>Hover</strong>: springs toward scale 1.5 (default spring, stiffness 550
                    / damping 30 — settles in ~150ms, so press QUICKLY).
                </li>
                <li>
                    <strong>Press mid-spring</strong> (while it is still growing): the scale must KEEP
                    CLIMBING for a beat — the press spring launches from the hover's live velocity — before
                    curving down toward 0.9. Watch the VERDICT row.
                </li>
                <li>
                    <strong>The regression</strong>: a zero-velocity re-seed reverses instantly at
                    the press point (gain ≈ 0). That is what this page catches.
                </li>
                <li>
                    <strong>Rapid flicks</strong> across the card edge should read as one continuous elastic
                    motion — velocity should never visibly reset to 0 at a reversal (watch the velocity
                    row for hard zero-snaps mid-motion).
                </li>
            </ul>
        </div>

        <div class="stage">
            <dl class="frame-readout" data-testid="velocity-readout">
                <div>
                    <dt>scale</dt>
                    <dd>{fmt(scale)}</dd>
                </div>
                <div>
                    <dt>velocity</dt>
                    <dd>{fmt(velocity, 2)} /s (peak {fmt(peakVelocity, 2)})</dd>
                </div>
                <div>
                    <dt>press</dt>
                    <dd>
                        {pressScale === null
                            ? '—'
                            : `@ ${fmt(pressScale)} → post-press peak ${postPressPeak === null ? '…' : fmt(postPressPeak)}`}
                    </dd>
                </div>
                <div class="verdict">
                    <dt>verdict</dt>
                    <dd>{verdict}</dd>
                </div>
            </dl>

            <div class="motion-area">
                <motion.div
                    whileHover={{ scale: 1.5 }}
                    whileTap={{ scale: 0.9 }}
                    style="width: 120px; height: 120px; background-color: #247768; border-radius: 8px;"
                    data-testid="motion-hover-velocity-continuity"
                />
            </div>

            <ol class="event-log" data-testid="velocity-log">
                {#each log as line (line)}
                    <li>{line}</li>
                {/each}
            </ol>
        </div>
    </section>
</main>

<style>
    main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
        background: #101418;
        color: #eef4fb;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            sans-serif;
    }

    .panel {
        width: min(980px, 100%);
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1.1fr);
        gap: 32px;
        align-items: start;
        border: 1px solid #30414d;
        padding: 28px;
    }

    .copy {
        display: grid;
        gap: 14px;
    }

    .eyebrow {
        margin: 0;
        color: #7dd3fc;
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: 30px;
        line-height: 1.1;
    }

    ul {
        margin: 0;
        padding-left: 18px;
        display: grid;
        gap: 10px;
        color: #b7c4ce;
        line-height: 1.55;
        font-size: 14px;
    }

    strong {
        color: #eef4fb;
    }

    .stage {
        display: grid;
        gap: 16px;
        padding: 14px;
        border: 1px solid #263844;
        background:
            linear-gradient(90deg, rgba(125, 211, 252, 0.12) 1px, transparent 1px),
            linear-gradient(0deg, rgba(125, 211, 252, 0.12) 1px, transparent 1px), #0b1116;
        background-size: 48px 48px;
    }

    .frame-readout {
        margin: 0;
        padding: 10px;
        display: grid;
        gap: 6px;
        border: 1px solid rgba(125, 211, 252, 0.26);
        background: rgba(8, 17, 23, 0.86);
        color: #c8f7ff;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 12px;
        pointer-events: none;
    }

    .frame-readout div {
        display: grid;
        grid-template-columns: 76px minmax(0, 1fr);
        gap: 8px;
    }

    .frame-readout dt {
        color: #67e8f9;
        font-weight: 800;
        text-transform: uppercase;
    }

    .frame-readout dd {
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .frame-readout .verdict dd {
        color: #4ff0b7;
        font-weight: 800;
        white-space: normal;
    }

    .motion-area {
        min-height: 220px;
        display: grid;
        place-items: center;
    }

    .event-log {
        margin: 0;
        padding: 10px;
        list-style: none;
        display: grid;
        gap: 4px;
        border: 1px solid rgba(125, 211, 252, 0.18);
        background: rgba(8, 17, 23, 0.7);
        color: #8ea1af;
        font-family: 'SFMono-Regular', Consolas, monospace;
        font-size: 11px;
        min-height: 120px;
    }

    .event-log li:first-child {
        color: #c8f7ff;
    }

    @media (max-width: 760px) {
        .panel {
            grid-template-columns: 1fr;
        }
    }
</style>
