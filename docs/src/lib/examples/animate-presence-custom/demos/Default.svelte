<script lang="ts">
    import { ArrowLeft, ArrowRight, Sparkles } from '@lucide/svelte'
    import { AnimatePresence, motion, type Variants } from '@humanspeak/svelte-motion'

    type Feature = {
        id: string
        label: string
        title: string
        copy: string
    }

    const features: Feature[] = [
        {
            id: 'context',
            label: 'presence custom',
            title: 'Exit follows your last move',
            copy: 'The leaving card reads the latest parent custom value, even after Svelte has swapped it.'
        },
        {
            id: 'variants',
            label: 'dynamic variants',
            title: 'One exit, two directions',
            copy: 'A single variant function sends the old card left or right based on the navigation intent.'
        },
        {
            id: 'parity',
            label: 'motion parity',
            title: 'Parent data wins',
            copy: 'The child carries stale custom data on purpose. AnimatePresence still provides the fresh exit value.'
        }
    ]

    let index = $state(0)
    let direction = $state(1)

    const active = $derived(features[index])

    const variants: Variants = {
        enter: (custom) => ({
            x: (custom as number) > 0 ? 190 : -190,
            opacity: 0,
            rotate: (custom as number) > 0 ? 5 : -5,
            scale: 0.92,
            filter: 'blur(10px)'
        }),
        center: {
            x: 0,
            opacity: 1,
            rotate: 0,
            scale: 1,
            filter: 'blur(0px)'
        },
        exit: (custom) => ({
            x: (custom as number) > 0 ? -190 : 190,
            opacity: 0,
            rotate: (custom as number) > 0 ? -5 : 5,
            scale: 0.92,
            filter: 'blur(10px)'
        })
    }

    const move = (nextDirection: number) => {
        direction = nextDirection
        index = (index + nextDirection + features.length) % features.length
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="stage" aria-label="Directional AnimatePresence custom demo">
        <div class="rail" aria-hidden="true">
            {#each features as feature, i (feature.id)}
                <span class:active={i === index}></span>
            {/each}
        </div>

        <button
            class="nav-button previous"
            type="button"
            onclick={() => move(-1)}
            aria-label="Previous feature"
        >
            <ArrowLeft size={16} />
        </button>

        <div class="viewport">
            <div class="track-line"></div>
            <div class="ghost ghost-left"></div>
            <div class="ghost ghost-right"></div>
            <AnimatePresence custom={direction} initial={false}>
                {#key active.id}
                    <motion.article
                        key={active.id}
                        class="panel"
                        custom={direction * -999}
                        {variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            type: 'spring',
                            stiffness: 260,
                            damping: 30,
                            mass: 0.9
                        }}
                    >
                        <div class="panel-topline">
                            <div class="icon"><Sparkles size={20} /></div>
                            <span>{active.label}</span>
                        </div>
                        <strong>{active.title}</strong>
                        <p>{active.copy}</p>
                        <div class="panel-footer">
                            <small>{String(index + 1).padStart(2, '0')}</small>
                            <i>{direction > 0 ? 'next exit ->' : '<- previous exit'}</i>
                        </div>
                    </motion.article>
                {/key}
            </AnimatePresence>
        </div>

        <button
            class="nav-button next"
            type="button"
            onclick={() => move(1)}
            aria-label="Next feature"
        >
            <ArrowRight size={16} />
        </button>

        <output class="direction-readout">
            <span>{direction > 0 ? 'next' : 'previous'}</span>
            <b>custom={direction}</b>
        </output>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        min-height: 560px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(1.25rem, 4vw, 2.5rem);
        background:
            radial-gradient(circle at 18% 16%, rgba(245, 183, 223, 0.22), transparent 24%),
            radial-gradient(circle at 78% 78%, rgba(103, 232, 249, 0.16), transparent 28%), #081014;
        color: #eef6fb;
    }

    .stage {
        position: relative;
        width: 100%;
        max-width: 720px;
        min-height: 440px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid rgba(103, 232, 249, 0.22);
        border-radius: 8px;
        background:
            linear-gradient(90deg, rgba(103, 232, 249, 0.11) 1px, transparent 1px),
            linear-gradient(0deg, rgba(103, 232, 249, 0.11) 1px, transparent 1px),
            linear-gradient(135deg, rgba(245, 183, 223, 0.12), transparent 38%), #0b151b;
        background-size:
            54px 54px,
            54px 54px,
            auto,
            auto;
    }

    .viewport {
        position: relative;
        width: min(100%, 520px);
        height: 310px;
        display: grid;
        place-items: center;
        isolation: isolate;
    }

    .track-line {
        position: absolute;
        inset: 50% -120px auto;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(103, 232, 249, 0.45), transparent);
        transform: translateY(-50%);
    }

    .ghost {
        position: absolute;
        width: 250px;
        height: 170px;
        border: 1px solid rgba(103, 232, 249, 0.2);
        border-radius: 8px;
        background: rgba(19, 32, 42, 0.42);
        filter: blur(0.2px);
        opacity: 0.5;
    }

    .ghost-left {
        translate: -205px 24px;
        rotate: -7deg;
    }

    .ghost-right {
        translate: 205px -24px;
        rotate: 7deg;
    }

    :global(.panel) {
        position: absolute;
        width: min(410px, calc(100% - 40px));
        min-height: 220px;
        display: grid;
        align-content: stretch;
        gap: 14px;
        padding: 26px;
        border: 1px solid rgba(103, 232, 249, 0.74);
        border-radius: 8px;
        background: linear-gradient(145deg, rgba(245, 183, 223, 0.1), transparent 32%), #13202a;
        box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.42),
            0 0 42px rgba(103, 232, 249, 0.1);
        transform-origin: 50% 50%;
        z-index: 2;
    }

    .panel-topline {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .icon {
        width: 40px;
        height: 40px;
        display: grid;
        place-items: center;
        border: 1px solid #425b6a;
        border-radius: 6px;
        color: #f5b7df;
        background: #0e161c;
    }

    :global(.panel span) {
        color: #72d9f7;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    :global(.panel strong) {
        color: #f4f8fc;
        font-size: clamp(26px, 4vw, 40px);
        line-height: 0.98;
        max-width: 10ch;
    }

    :global(.panel p) {
        margin: 0;
        color: #b5c6d3;
        line-height: 1.5;
        max-width: 32ch;
    }

    .panel-footer {
        display: flex;
        align-items: end;
        justify-content: space-between;
        align-self: end;
        gap: 16px;
        color: #8ea5b4;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .panel-footer small {
        color: #72d9f7;
        font-size: 30px;
        line-height: 1;
    }

    .panel-footer i {
        font-style: normal;
    }

    .rail {
        position: absolute;
        top: 22px;
        left: 24px;
        display: flex;
        gap: 7px;
    }

    .rail span {
        width: 26px;
        height: 4px;
        border-radius: 999px;
        background: rgba(142, 165, 180, 0.35);
    }

    .rail span.active {
        background: linear-gradient(90deg, #72d9f7, #f5b7df);
    }

    .nav-button {
        position: absolute;
        top: 50%;
        z-index: 3;
        width: 52px;
        height: 52px;
        display: grid;
        place-items: center;
        border: 1px solid rgba(103, 232, 249, 0.36);
        border-radius: 999px;
        background: rgba(18, 28, 36, 0.8);
        color: #eef6fb;
        cursor: pointer;
        transform: translateY(-50%);
        backdrop-filter: blur(14px);
        transition:
            border-color 160ms ease,
            background 160ms ease,
            transform 160ms ease;
    }

    .nav-button:hover {
        border-color: #67e8f9;
        background: rgba(26, 43, 55, 0.92);
        transform: translateY(-50%) scale(1.04);
    }

    .previous {
        left: clamp(18px, 8vw, 74px);
    }

    .next {
        right: clamp(18px, 8vw, 74px);
    }

    .direction-readout {
        position: absolute;
        right: 22px;
        bottom: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid rgba(103, 232, 249, 0.22);
        border-radius: 999px;
        background: rgba(8, 16, 20, 0.68);
        color: #b5c6d3;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .direction-readout span {
        color: #f5b7df;
    }

    .direction-readout b {
        color: #72d9f7;
        font-weight: 800;
        text-transform: none;
    }

    @media (max-width: 640px) {
        .stage {
            min-height: 500px;
        }

        .viewport {
            width: 100%;
            height: 350px;
        }

        .nav-button {
            top: auto;
            bottom: 24px;
            transform: none;
        }

        .nav-button:hover {
            transform: scale(1.04);
        }

        .previous {
            left: 24px;
        }

        .next {
            right: 24px;
        }

        .direction-readout {
            right: auto;
            left: 50%;
            bottom: 34px;
            translate: -50% 0;
        }
    }
</style>
