<script lang="ts">
    import { motion, type ProjectionUpdatePayload } from '$lib'

    // Projection smoke test (#379) — nested ancestor correctness.
    //
    // An OUTER `<motion.div layout>` wrapper carries a user-authored
    // `transform: translate(40px, 60px)`. An INNER `<motion.div layout>`
    // toggles between the wrapper's left and right edge.
    //
    // The fix this page guards: measure() must match framer-motion's
    // removeBoxTransforms, which strips only MOTION-applied transforms
    // (tracked latestValues) and leaves USER-authored transforms intact.
    // In this library motion only writes a transform AFTER mount (FLIP on
    // a layout change, drag on pointerdown), so the node captures the
    // mount-time transform as the user base and resets to that — not to
    // 'none' — while measuring.
    //
    // We read the gap between the inner's raw on-screen rect and the
    // event's `layout` box (the "stripped offset"):
    //   • With only the wrapper's mount-time (user) transform, the gap is
    //     0 — the static transform is PRESERVED in the layout box.
    //   • Tick "post-mount transform" to add a +40px-down translate to
    //     the wrapper after mount (a stand-in for a motion/FLIP write).
    //     Toggle again and the gap becomes y=40 — that portion is
    //     STRIPPED, because it wasn't part of the captured base.

    let atRight = $state(false)
    let motionApplied = $state(false)
    let lastDelta = $state<ProjectionUpdatePayload | null>(null)
    let strippedOffset = $state<{ x: number; y: number } | null>(null)

    const BASE_TRANSFORM = 'translate(40px, 60px)'
    const POST_MOUNT_TRANSFORM = 'translate(40px, 60px) translate(0px, 40px)'

    const outerEl = (): HTMLElement | null =>
        document.querySelector('[data-testid="projection-nested-ancestor"] .outer')

    const toggle = () => {
        atRight = !atRight
    }

    const toggleMotionTransform = () => {
        motionApplied = !motionApplied
        // Write directly to the DOM AFTER mount so it's never captured as
        // the user base — exactly how a FLIP/drag transform would arrive.
        const el = outerEl()
        if (el) el.style.transform = motionApplied ? POST_MOUNT_TRANSFORM : BASE_TRANSFORM
    }

    const onInnerUpdate = (data: ProjectionUpdatePayload) => {
        lastDelta = data
        const el = document.querySelector<HTMLElement>(
            '[data-testid="projection-nested-ancestor"] .inner'
        )
        if (el) {
            // Read the inner's on-screen rect with its OWN transform
            // removed, so an in-flight FLIP on the inner can't skew the
            // number. The ancestor's live transform still applies, so
            // this measures (inner slot + ancestor LIVE transform). The
            // event's `layout` box is (inner slot + ancestor BASE), so
            // the gap is exactly the ancestor's motion-applied portion —
            // 0 for a static base, 40 once the post-mount transform is on.
            const prev = el.style.transform
            el.style.transform = 'none'
            const visual = el.getBoundingClientRect()
            el.style.transform = prev
            strippedOffset = {
                x: Math.round(visual.left - data.layout.x.min),
                y: Math.round(visual.top - data.layout.y.min)
            }
        }
    }
</script>

<svelte:head>
    <title>Projection · nested ancestor (#379)</title>
</svelte:head>

<div class="page" data-testid="projection-nested-ancestor">
    <header>
        <h1>Projection — nested ancestor</h1>
        <p>
            The outer wrapper has a user-authored <code>transform: translate(40px, 60px)</code>. The
            inner box toggles between the wrapper's left and right edge. <code>measure()</code>
            matches framer-motion: it strips only <em>motion-applied</em> transforms (written after
            mount) and preserves the <em>user-authored</em> base. The
            <strong>stripped offset</strong>
            below is the gap between the inner's raw on-screen rect and the event's
            <code>layout</code> box:
        </p>
        <ul>
            <li>
                Static base only → offset <code>x=0 y=0</code> (user transform preserved, matches upstream).
            </li>
            <li>
                With a post-mount transform → offset <code>x=0 y=40</code> (only that motion-applied part
                is stripped).
            </li>
        </ul>
        <div class="controls">
            <button type="button" onclick={toggle} data-testid="toggle">Toggle position</button>
            <label>
                <input
                    type="checkbox"
                    checked={motionApplied}
                    onchange={toggleMotionTransform}
                    data-testid="motion-transform"
                />
                Post-mount transform on wrapper (+40px down)
            </label>
        </div>
    </header>

    <section class="stage">
        <motion.div layout class="outer" style="transform: translate(40px, 60px);">
            <motion.div
                layout
                class="inner"
                style="align-self: {atRight ? 'flex-end' : 'flex-start'};"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                onProjectionUpdate={onInnerUpdate}
            >
                inner
            </motion.div>
        </motion.div>
    </section>

    <section class="readout">
        <h2>Inner box last delta</h2>
        <pre data-testid="inner-delta">{lastDelta
                ? `Δx=${lastDelta.delta.x.translate.toFixed(1)} Δy=${lastDelta.delta.y.translate.toFixed(
                      1
                  )} changed=${lastDelta.hasLayoutChanged}`
                : '(no event yet)'}</pre>
        <h2>Ancestor offset stripped by measure()</h2>
        <pre data-testid="stripped-offset">{strippedOffset
                ? `x=${strippedOffset.x} y=${strippedOffset.y}`
                : '(no event yet)'}</pre>
        <p class="hint">
            Wrapper width is 400px, inner is 80px → horizontal travel ≈ 294px (the Δx above). With
            only the static base the stripped offset reads <code>x=0 y=0</code> (user transform
            kept). Tick the checkbox, then toggle again: it reads <code>x=0 y=40</code> — only the
            post-mount (motion) transform is removed from the inner's <code>layout</code> box.
        </p>
    </section>
</div>

<style>
    .page {
        max-width: 720px;
        margin: 0 auto;
        padding: 2rem 1rem;
        font-family: ui-sans-serif, system-ui, sans-serif;
    }
    header p {
        color: #475569;
        font-size: 14px;
        line-height: 1.5;
    }
    button {
        margin-top: 8px;
        padding: 8px 16px;
        border-radius: 8px;
        border: 1px solid #cbd5e1;
        background: #fff;
        cursor: pointer;
        font: inherit;
    }
    button:hover {
        border-color: #94a3b8;
    }
    .controls {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
        margin-top: 8px;
    }
    .controls label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 14px;
        color: #334155;
    }
    header ul {
        margin: 8px 0;
        padding-left: 20px;
        font-size: 14px;
        color: #475569;
        line-height: 1.6;
    }
    .stage {
        margin: 32px 0 32px 0;
        /* Leave room for the wrapper's translate(40, 60) so it stays visible. */
        padding: 0 0 80px 0;
    }
    :global([data-testid='projection-nested-ancestor'] .outer) {
        width: 400px;
        height: 160px;
        border-radius: 14px;
        background: #e2e8f0;
        border: 1px dashed #94a3b8;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 12px;
    }
    :global([data-testid='projection-nested-ancestor'] .inner) {
        width: 80px;
        height: 80px;
        border-radius: 10px;
        background: #10b981;
        color: #fff;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .readout pre {
        margin: 4px 0;
        font-family: ui-monospace, monospace;
        font-size: 13px;
        color: #0f172a;
        background: #f1f5f9;
        padding: 6px 10px;
        border-radius: 6px;
    }
    .hint {
        font-size: 12px;
        color: #64748b;
    }
</style>
