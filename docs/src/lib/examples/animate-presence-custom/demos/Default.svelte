<script lang="ts">
    import { ArrowLeft, ArrowRight, Sparkles } from '@lucide/svelte'
    import { AnimatePresence, motion, styleString, type Variants } from '@humanspeak/svelte-motion'

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

    const navButtonStyle = styleString(() => ({
        width: 44,
        height: 44,
        display: 'grid',
        placeItems: 'center',
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        backgroundColor: 'var(--brut-bg, #f8fcfb)',
        color: 'var(--brut-ink, #0a0a0a)',
        cursor: 'pointer'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="stage" aria-label="Directional AnimatePresence custom demo">
        <div class="stage-head">
            <span class="micro">// presence custom</span>
            <div class="rail" aria-hidden="true">
                {#each features as feature, i (feature.id)}
                    <span class:active={i === index}></span>
                {/each}
            </div>
        </div>

        <div class="nav-slot previous">
            <motion.button
                type="button"
                onclick={() => move(-1)}
                aria-label="Previous feature"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={navButtonStyle}
            >
                <ArrowLeft size={16} />
            </motion.button>
        </div>

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
                            <div class="icon"><Sparkles size={18} /></div>
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

        <div class="nav-slot next">
            <motion.button
                type="button"
                onclick={() => move(1)}
                aria-label="Next feature"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                style={navButtonStyle}
            >
                <ArrowRight size={16} />
            </motion.button>
        </div>

        <output class="direction-readout">
            <span>{direction > 0 ? 'next' : 'previous'}</span>
            <b>custom={direction}</b>
        </output>
    </div>
</div>

<style>
    .dk-demo-shell {
        width: 100%;
        min-height: 520px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: clamp(1.25rem, 4vw, 2.5rem);
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .stage {
        position: relative;
        width: 100%;
        max-width: 720px;
        min-height: 420px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background:
            linear-gradient(90deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            linear-gradient(0deg, var(--brut-rule, #d6dedb) 1px, transparent 1px),
            var(--brut-bg-2, #eef4f1);
        background-size:
            54px 54px,
            54px 54px,
            auto;
    }

    .stage-head {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.75rem 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    .viewport {
        position: relative;
        width: min(100%, 520px);
        height: 300px;
        display: grid;
        place-items: center;
        isolation: isolate;
    }

    .track-line {
        position: absolute;
        inset: 50% -120px auto;
        height: 1px;
        background: var(--brut-rule-2, #bbc4c0);
        transform: translateY(-50%);
    }

    .ghost {
        position: absolute;
        width: 250px;
        height: 170px;
        border: 1px dashed var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        opacity: 0.6;
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
        padding: 24px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
        box-shadow: 8px 8px 0 var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        transform-origin: 50% 50%;
        z-index: 2;
    }

    .panel-topline {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .icon {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
    }

    :global(.panel span) {
        color: var(--brut-accent, #247768);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    :global(.panel strong) {
        color: var(--brut-ink, #0a0a0a);
        font-size: clamp(24px, 4vw, 36px);
        line-height: 1;
        max-width: 12ch;
    }

    :global(.panel p) {
        margin: 0;
        color: var(--brut-ink-2, #525252);
        line-height: 1.5;
        max-width: 34ch;
    }

    .panel-footer {
        display: flex;
        align-items: end;
        justify-content: space-between;
        align-self: end;
        gap: 16px;
        color: var(--brut-ink-3, #9a9a9a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .panel-footer small {
        color: var(--brut-accent, #247768);
        font-size: 26px;
        line-height: 1;
    }

    .panel-footer i {
        font-style: normal;
    }

    .rail {
        display: flex;
        gap: 6px;
    }

    .rail span {
        width: 22px;
        height: 5px;
        background: var(--brut-rule-2, #bbc4c0);
    }

    .rail span.active {
        background: var(--brut-accent, #247768);
    }

    .nav-slot {
        position: absolute;
        top: 50%;
        z-index: 3;
        transform: translateY(-50%);
    }

    .previous {
        left: clamp(18px, 8vw, 74px);
    }

    .next {
        right: clamp(18px, 8vw, 74px);
    }

    .direction-readout {
        position: absolute;
        right: 16px;
        bottom: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink-3, #9a9a9a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .direction-readout span {
        color: var(--brut-ink-2, #525252);
    }

    .direction-readout b {
        color: var(--brut-accent, #247768);
        font-weight: 700;
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

        .nav-slot {
            top: auto;
            bottom: 24px;
            transform: none;
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
            bottom: 76px;
            translate: -50% 0;
        }
    }
</style>
