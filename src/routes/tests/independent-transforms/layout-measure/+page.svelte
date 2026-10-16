<script lang="ts">
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import {
        countTransformAnimations,
        exposeCountTransformAnimations
    } from '../_countTransformAnimations'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Accelerated `x` + `layout` width change (Motion 14.2). Driven by
     * `e2e/independent-transforms/layout-measure.spec.ts`.
     *
     * The box runs a slow linear `x` animation, which Motion 14.2 runs as one
     * accelerated WAAPI `transform` animation. Widening the box mid-flight
     * starts a layout animation. svelte-motion's layout measurements must
     * ignore the in-flight accelerated transform: if the "before" box
     * included it, the element would jump sideways when the width changes.
     */
    const transition = {
        x: { duration: 2, ease: 'linear' },
        layout: { duration: 0.3 }
    } as const

    let width = $state(100)

    /**
     * Samples `#box`'s painted left edge on every animation frame.
     *
     * @param ms - How long to sample for, in milliseconds.
     * @returns Every sampled `getBoundingClientRect().left`, in frame order.
     */
    const sampleLeft = (ms: number) =>
        new Promise<number[]>((resolve) => {
            const box = document.getElementById('box')!
            const samples: number[] = []
            const start = performance.now()
            const tick = (now: number) => {
                samples.push(box.getBoundingClientRect().left)
                if (now - start < ms) requestAnimationFrame(tick)
                else resolve(samples)
            }
            requestAnimationFrame(tick)
        })

    // ---- Live verdicts (tester only; never under `@isPlaywright=true`) ----
    let isTester = $state(false)
    let acceleratedBeforeWiden = $state<number | null>(null)
    let maxStep = $state<number | null>(null)

    onMount(() => {
        const target = window as unknown as Record<string, unknown>
        exposeCountTransformAnimations()
        target.sampleLeft = sampleLeft
        isTester = !window.location.search.includes('@isPlaywright=true')
    })

    const widen = () => {
        if (isTester) {
            acceleratedBeforeWiden = countTransformAnimations('box')
            void sampleLeft(800).then((samples) => {
                let max = 0
                for (let i = 1; i < samples.length; i++) {
                    max = Math.max(max, Math.abs(samples[i] - samples[i - 1]))
                }
                maxStep = max
            })
        }
        width = width === 100 ? 200 : 100
    }

    const steps: TesterStep[] = [
        {
            text: 'Reload the page. About half a second in, while the blue box is still sliding right, press "Widen".',
            expected:
                'The box keeps sliding at the same steady pace while it grows to 200px wide. It never jumps sideways. Both verdicts read PASS.',
            action: { label: 'Reload', run: () => window.location.reload() }
        }
    ]
</script>

<svelte:head>
    <title>Independent transforms — accelerated x + layout width change</title>
</svelte:head>

<div class="fixture">
    <motion.div
        id="box"
        layout
        style={{ width: `${width}px`, height: '50px', background: '#0077ff' }}
        animate={{ x: 200 }}
        {transition}
    />
    <button id="widen" type="button" onclick={widen}>Widen</button>
</div>

<TesterPanel
    eyebrow="framer-motion projection measure (compositor transforms)"
    title="Accelerated x + layout width change"
    status="Expected on Chromium with Motion 14.2: both rows below read PASS."
    {steps}
>
    {#snippet checks()}
        <p>
            The box's <code>x</code> animation runs on the compositor. Widening it starts a
            <code>layout</code> animation, whose "before" measurement must ignore the in-flight
            <code>x</code>. Otherwise the box jumps sideways when it widens.
        </p>
    {/snippet}
    {#if isTester}
        <ul class="verdicts">
            <li data-tester-verdict="accelerated">
                <code>accelerated before widen</code>
                <span
                    class="chip"
                    class:ok={acceleratedBeforeWiden === 1}
                    class:pending={acceleratedBeforeWiden === null}
                >
                    {acceleratedBeforeWiden === null
                        ? '…'
                        : acceleratedBeforeWiden === 1
                          ? 'PASS'
                          : 'FAIL'}
                </span>
                <span class="detail">
                    1 transform animation
                    {#if acceleratedBeforeWiden !== null}(saw {acceleratedBeforeWiden}){/if}
                </span>
            </li>
            <li data-tester-verdict="max-step">
                <code>largest frame-to-frame step</code>
                <span
                    class="chip"
                    class:ok={maxStep !== null && maxStep <= 10}
                    class:pending={maxStep === null}
                >
                    {maxStep === null ? '…' : maxStep <= 10 ? 'PASS' : 'FAIL'}
                </span>
                <span class="detail">
                    at most 10px
                    {#if maxStep !== null}(saw {maxStep.toFixed(1)}px){/if}
                </span>
            </li>
        </ul>
    {/if}
</TesterPanel>

<style>
    .fixture {
        position: fixed;
        top: 0;
        left: 0;
    }

    .verdicts {
        display: grid;
        gap: 6px;
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 12px;
    }

    .chip {
        margin: 0 6px;
        padding: 1px 8px;
        border-radius: 999px;
        background: #7f1d1d;
        color: white;
        font-weight: 600;
    }

    .chip.ok {
        background: #14532d;
    }

    .chip.pending {
        background: #374151;
    }

    .detail {
        opacity: 0.75;
    }
</style>
