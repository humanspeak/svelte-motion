<script lang="ts">
    /**
     * Characterization page for transform channels that the drag composer
     * currently overwrites or fails to paint while the pointer is held.
     *
     * @component
     */
    import { motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    let inserted = $state(false)
    let stackBounds: HTMLElement | null = $state(null)

    // ---- Live verdict for the cross-axis case (tester only) ----
    //
    // Motion 14.6 (#2255, upstream 9632e2c3d) compensates layout changes only
    // on drag axes, so the x-only card follows its layout on y with no
    // translateY. After the insert, sample the card's computed translateY
    // (m42) every frame while it is held and for 500ms after release.

    /** How long after release translateY is still watched, in ms. */
    const SETTLE_MS = 500

    let worstY = $state(0)
    let sampled = $state(false)

    const verdict = $derived(
        !inserted || !sampled ? 'waiting' : worstY <= 0.5 ? 'follows' : 'stale'
    )

    onMount(() => {
        if (window.location.search.includes('@isPlaywright=true')) return

        let dragging = false
        let releasedAt = -Infinity
        const onDown = (event: PointerEvent) => {
            const card = document.querySelector('[data-testid="cross-axis-card"]')
            if (card && event.target instanceof Node && card.contains(event.target)) {
                dragging = true
            }
        }
        const onUp = () => {
            if (!dragging) return
            dragging = false
            releasedAt = performance.now()
        }

        let raf = 0
        const sample = () => {
            raf = requestAnimationFrame(sample)
            if (!inserted) return
            if (!dragging && performance.now() - releasedAt > SETTLE_MS) return
            const card = document.querySelector<HTMLElement>('[data-testid="cross-axis-card"]')
            if (!card) return
            const m42 = new DOMMatrixReadOnly(getComputedStyle(card).transform).m42
            sampled = true
            worstY = Math.max(worstY, Math.abs(m42))
        }
        raf = requestAnimationFrame(sample)
        window.addEventListener('pointerdown', onDown, true)
        window.addEventListener('pointerup', onUp, true)
        window.addEventListener('pointercancel', onUp, true)
        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('pointerdown', onDown, true)
            window.removeEventListener('pointerup', onUp, true)
            window.removeEventListener('pointercancel', onUp, true)
        }
    })

    const steps: TesterStep[] = [
        {
            text: 'Press and hold the cross-axis card ("drag x · follows its layout on y"), drag it right a little and keep holding.',
            expected: 'It moves on x only.'
        },
        {
            text: 'While holding, press "Insert content above" (keyboard Tab + Enter, or the "Do it" button here, which calls the button\'s click()).',
            expected:
                "The card drops down with its slot by the inserted block's height, in one step, and stays under the same x offset.",
            action: {
                run: () =>
                    document
                        .querySelector<HTMLButtonElement>('[data-testid="insert-above"]')
                        ?.click()
            }
        },
        {
            text: 'Release.',
            expected:
                'The card stays where its layout put it. No jump back up and no slow drift on y. The chip reads FOLLOWS LAYOUT ✓. Press "Reset page" to try again.'
        }
    ]
</script>

<svelte:head>
    <title>Drag · whileDrag transform composition</title>
</svelte:head>

<main>
    <h1>whileDrag transform composition</h1>
    <p>
        Hold each card while dragging. Rotation, 3D transforms, and cross-axis layout following
        should remain composed with the live drag translation.
    </p>

    <section>
        <h2>2D rotation</h2>
        <div class="stage">
            <motion.div
                class="card rotate-card"
                data-testid="rotate-card"
                drag="x"
                dragMomentum={false}
                whileDrag={{ rotate: 8 }}
                transition={{ duration: 0.05 }}
            >
                rotate 8°
            </motion.div>
        </div>
    </section>

    <section>
        <h2>Cross-axis layout</h2>
        <button
            type="button"
            data-testid="insert-above"
            onclick={() => (inserted = true)}
            disabled={inserted}
        >
            Insert content above
        </button>
        <div class="pin-stage">
            {#if inserted}
                <div class="inserted" data-testid="inserted-content">New layout content</div>
            {/if}
            <motion.div
                class="card pin-card"
                data-testid="cross-axis-card"
                drag="x"
                dragMomentum={false}
                layout
            >
                drag x · follows its layout on y
            </motion.div>
        </div>
    </section>

    <section>
        <h2>whileDrag overriding an authored style channel</h2>
        <p class="hint">
            The card authors <code>rotate</code> on <code>style</code>, and <code>whileDrag</code>
            overrides that same channel. Both the override and the drag translation must survive.
        </p>
        <div class="stage">
            <motion.div
                class="card authored-rotate-card"
                data-testid="authored-rotate-card"
                drag="x"
                dragMomentum={false}
                style={{ rotate: -8 }}
                whileDrag={{ rotate: 4 }}
                transition={{ duration: 0.05 }}
            >
                style rotate −8° · whileDrag 4°
            </motion.div>
        </div>
    </section>

    <section>
        <h2>Full gesture stack over authored transform channels</h2>
        <p class="hint">
            Mirrors the docs example: constrained two-axis drag, <code>whileHover</code> and
            <code>whileDrag</code> both owning <code>scale</code>, a spring transition, over
            authored
            <code>rotate</code>/<code>skewX</code>. Drag translation and the whileDrag rotate must
            both survive.
        </p>
        <div bind:this={stackBounds} class="stage stack-stage">
            <motion.div
                class="card gesture-stack-card"
                data-testid="gesture-stack-card"
                drag
                dragConstraints={stackBounds}
                dragElastic={0.28}
                whileHover={{ scale: 1.03 }}
                whileDrag={{ rotate: 4, scale: 1.08, cursor: 'grabbing' }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                style={{ rotate: -8, skewX: -5 }}
            >
                full gesture stack
            </motion.div>
        </div>
    </section>

    <section>
        <h2>Write coalescing under multi-channel whileDrag springs</h2>
        <p class="hint">
            Two whileDrag channels animate under a slow spring while the pointer is held still. The
            composer should paint at most one composed transform per frame — not one per animated
            channel.
        </p>
        <div class="stage">
            <motion.div
                class="card perf-spring-card"
                data-testid="perf-spring-card"
                drag="x"
                dragMomentum={false}
                whileDrag={{ rotate: 90, scale: 1.3 }}
                transition={{ type: 'spring', stiffness: 60, damping: 10 }}
                style={{ rotate: -8 }}
            >
                slow spring · 2 channels
            </motion.div>
        </div>
    </section>

    <section>
        <h2>3D rotation with perspective</h2>
        <div class="stage perspective-stage">
            <motion.div
                class="card rotate-x-card"
                data-testid="rotate-x-card"
                drag="x"
                dragMomentum={false}
                whileDrag={{ rotateX: 30 }}
                transition={{ duration: 0.05 }}
                style={{ transformPerspective: '600px' }}
            >
                rotateX 30°
            </motion.div>
        </div>
    </section>
</main>

<TesterPanel
    eyebrow="Motion 14.6.0 · #2255"
    title="An x-only drag follows its layout on y"
    status="Passes on this build (Motion 14.6.0)."
    {steps}
>
    {#snippet summary()}
        {#if verdict === 'follows'}
            <span class="verdict ok">FOLLOWS LAYOUT ✓</span>
        {:else if verdict === 'stale'}
            <span class="verdict bad">STALE Y ✗ {worstY.toFixed(1)}px</span>
        {:else}
            <span class="verdict na">WAITING</span>
        {/if}
    {/snippet}
    {#snippet checks()}
        <p>
            The "Cross-axis layout" card drags on x only. When content is inserted above it
            mid-drag, its slot moves down. Since Motion 14.6 the drag only compensates the axes it
            drags, so the card moves down with its slot instead of being held in place by a
            <code>translateY</code>.
        </p>
        <p>
            Before 14.6 the card stayed put during the drag and was left with a stale
            <code>translateY</code> after release, because nothing ever animates a non-drag axis back.
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
    :global(body) {
        margin: 0;
        background: #07100f;
        color: #e8fffa;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    main {
        width: min(920px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 64px;
    }

    h1,
    h2,
    p {
        margin-top: 0;
    }

    section {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid #28504a;
        background: #0b1816;
    }

    .stage,
    .pin-stage {
        min-height: 150px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px dashed #35786c;
        background: #091311;
    }

    .pin-stage {
        margin-top: 12px;
        align-content: start;
        padding: 24px;
    }

    .inserted {
        width: min(420px, 100%);
        height: 72px;
        display: grid;
        place-items: center;
        margin-bottom: 16px;
        border: 1px solid #f59e0b;
        color: #fbbf24;
        background: #2a1c08;
    }

    :global(.card) {
        width: 160px;
        height: 88px;
        display: grid;
        place-items: center;
        border: 1px solid #76ead3;
        border-radius: 12px;
        color: #06110f;
        background: #54dbbc;
        cursor: grab;
        user-select: none;
        touch-action: none;
        will-change: transform;
    }

    :global(.pin-card) {
        width: 220px;
    }

    :global(.rotate-card) {
        transform-origin: center;
    }

    .perspective-stage {
        perspective: 900px;
    }

    .hint {
        margin: 0 0 12px;
        color: #9fd9cd;
        font-size: 13px;
    }

    .stack-stage {
        min-height: 280px;
    }

    button {
        padding: 8px 12px;
        border: 1px solid #76ead3;
        color: #e8fffa;
        background: #12352f;
        font: inherit;
        cursor: pointer;
    }

    button:disabled {
        opacity: 0.55;
        cursor: default;
    }
</style>
