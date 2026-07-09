<script lang="ts">
    import { ChevronDown, LoaderCircle } from '@lucide/svelte'
    import {
        animate,
        motion,
        useMotionTemplate,
        useMotionValue,
        useTransform
    } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    // AI Gradient Animation Card — a rotating conic-gradient border with a
    // masked glow spill. A single `turn` motion value sweeps 0 → 1 on an
    // infinite linear loop; `useMotionTemplate` composes it into a
    // `conic-gradient(from <turn>turn, …)` string that drives two layers:
    //   1. the crisp border ring behind the card, and
    //   2. a blurred, radially-masked glow that bleeds a soft halo of the same
    //      gradient out from under the card edges.
    //
    // Entrance: the card SSRs with both gradient layers fully transparent
    // (`glowOpacity` starts at 0, serialized into the markup), so first paint
    // never shows a frozen gradient during hydration. Once hydrated, the spin
    // is already running while the glow warms up from transparent — fading
    // into motion, so there is no visible moment where a static gradient
    // starts to move.
    //
    // Ported to Svelte 5 (useMotionValue + animate + useMotionTemplate) from
    // the "AI Gradient Animation Card" by hover.dev:
    // https://www.hover.dev/components/cards#ai-gradient-animation-card

    const duration = 3
    const turn = useMotionValue(0)
    const glowOpacity = useMotionValue(0)
    // The spill's resting opacity is 0.7 (a soft halo, not a full-strength
    // duplicate), so it tracks the shared entrance value scaled down.
    const spillOpacity = useTransform(() => glowOpacity.get() * 0.7)

    // onMount, not $effect: `animate(glowOpacity, 1, …)` with a scalar target
    // reads the value's current value to derive its start keyframe, and the
    // augmented motion value's read is reactive — inside `$effect` that makes
    // the animation's own per-frame writes re-trigger the effect, which
    // restarts the animation forever. `onMount` runs once and tracks nothing.
    onMount(() => {
        // Reduced motion: light the gradient up immediately, skip the spin.
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
            glowOpacity.set(1)
            return
        }

        // Both run concurrently: the gradient is never visible while static.
        const spin = animate(turn, [0, 1], {
            ease: 'linear',
            duration,
            repeat: Infinity
        })
        const enter = animate(glowOpacity, 1, { duration: 1.2, ease: 'easeOut' })

        return () => {
            spin.stop()
            enter.stop()
        }
    })

    const gradient = useMotionTemplate`conic-gradient(from ${turn}turn, transparent 0%, #f472b600 5%, #f472b6 10%, #c084fc 18%, #818cf8 26%, #38bdf8 34%, #2dd4bf 42%, #fbbf24 46%, #fbbf2400 52%, transparent 56%)`
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <!-- Animated gradient border -->
    <div class="ai-border">
        <motion.div
            class="ai-border-ring"
            style={{ backgroundImage: gradient, opacity: glowOpacity }}
        />

        <div class="ai-border-inner">
            <div class="ai-card-body">
                <!-- Temp logo from https://logoipsum.com/ -->
                <svg
                    width="40"
                    height="31"
                    viewBox="0 0 50 39"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    class="ai-logo"
                    aria-hidden="true"
                >
                    <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
                    <path
                        d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z"
                    />
                </svg>

                <button type="button" class="ai-question">
                    <img
                        src="https://api.dicebear.com/8.x/lorelei/svg?seed=Tom&backgroundColor=10b981"
                        alt="avatar"
                        class="ai-avatar"
                    />
                    <span class="ai-question-text">What is the meaning of life?</span>
                    <ChevronDown size={16} class="ai-chevron" />
                </button>

                <p class="ai-output">
                    Hmm, that's a tough one... The traditional answer is 42, but I don't think
                    that's clever enough for this demo application. Let me search the internet for
                    some answers.
                </p>

                <div class="ai-loading">
                    <LoaderCircle size={16} class="ai-spinner" />
                    <span>Committing tomfoolery...</span>
                </div>
            </div>

            <!-- Blurred, radially-masked glow spill sharing the same gradient -->
            <motion.div
                class="ai-glow-spill"
                aria-hidden="true"
                style={{ backgroundImage: gradient, opacity: spillOpacity }}
            />
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 6rem 1rem;
        min-height: 480px;
        background: #f5f5f5;
    }

    :global(.dark) .dk-demo-shell {
        background: #0a0a0a;
    }

    .ai-border {
        /* Theme tokens — light defaults; overridden under :global(.dark). The
           rotating conic gradient (ring + glow) is theme-agnostic. */
        --ai-card-bg: #ffffff;
        --ai-border-col: #e5e5e5;
        --ai-field-bg: #fafafa;
        --ai-field-bg-hover: #f0f0f0;
        --ai-logo: #171717;
        --ai-output: #3f3f46;

        position: relative;
        width: 100%;
        max-width: 24rem;
        padding: 1px;
        border: 1px solid var(--ai-border-col);
        border-radius: 1.5rem;
    }

    :global(.dark) .ai-border {
        --ai-card-bg: #171717;
        --ai-border-col: #404040;
        --ai-field-bg: #0a0a0a;
        --ai-field-bg-hover: #171717;
        --ai-logo: #fafafa;
        --ai-output: #d4d4d4;
    }

    .ai-border :global(.ai-border-ring) {
        position: absolute;
        inset: 0;
        border-radius: inherit;
    }

    .ai-border-inner {
        position: relative;
        border-radius: inherit;
        overflow: hidden;
    }

    .ai-card-body {
        position: relative;
        display: grid;
        gap: 1.5rem;
        padding: 1rem 1rem 1.5rem;
        background: var(--ai-card-bg);
    }

    .ai-border :global(.ai-glow-spill) {
        position: absolute;
        inset: -40%;
        z-index: 10;
        overflow: hidden;
        /* Opacity is animated inline (entrance fade → 0.7 resting halo). */
        filter: blur(40px);
        pointer-events: none;
        /* Radial spill mask: transparent through the centre, opaque toward the
           edges, so the blurred gradient bleeds a soft halo inward from the
           border. Fade stops (20% → 70%) are pulled in from the source's
           50% → 100% so the halo reaches into the card instead of hugging the
           border as a thin rim. */
        -webkit-mask-image: radial-gradient(
            ellipse 100% 100% at 50% 50%,
            transparent 20%,
            black 70%
        );
        mask-image: radial-gradient(ellipse 100% 100% at 50% 50%, transparent 20%, black 70%);
    }

    .ai-logo {
        fill: var(--ai-logo);
    }

    .ai-question {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 1rem;
        border: 1px solid var(--ai-border-col);
        border-radius: 1rem;
        background: var(--ai-field-bg);
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .ai-question:hover {
        background: var(--ai-field-bg-hover);
    }

    .ai-avatar {
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 9999px;
        flex-shrink: 0;
    }

    .ai-question-text {
        flex: 1;
        min-width: 0;
        font-size: 0.75rem;
        color: #737373;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .ai-question :global(.ai-chevron) {
        color: #737373;
        flex-shrink: 0;
    }

    .ai-output {
        margin: 0;
        font-size: 0.875rem;
        line-height: 1.625;
        color: var(--ai-output);
    }

    .ai-loading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.75rem;
        color: #737373;
    }

    .ai-loading :global(.ai-spinner) {
        color: #737373;
        animation: ai-spin 1s linear infinite;
    }

    @keyframes ai-spin {
        to {
            transform: rotate(360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .ai-loading :global(.ai-spinner) {
            animation: none;
        }
    }
</style>
