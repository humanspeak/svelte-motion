<script lang="ts">
    import { AnimatePresence, MotionConfig, motion, wrap, type Variants } from '$lib'
    import PresenceDataSquare from './PresenceDataSquare.svelte'

    type Slide = {
        id: string
        eyebrow: string
        title: string
        detail: string
    }

    const slides: Slide[] = [
        {
            id: 'alpha',
            eyebrow: 'presence custom',
            title: 'Outgoing slides know direction',
            detail: 'The old panel exits left when moving forward.'
        },
        {
            id: 'bravo',
            eyebrow: 'dynamic exit',
            title: 'The entering panel uses the same data',
            detail: 'Initial and exit variants read AnimatePresence custom.'
        },
        {
            id: 'charlie',
            eyebrow: 'upstream parity',
            title: 'Element custom does not win exit',
            detail: 'The child deliberately has the opposite custom value.'
        }
    ]

    let index = $state(0)
    let direction = $state(1)
    let selectedSquare = $state(1)
    let squareDirection: 1 | -1 = $state(1)
    let isolatedSquare = $state(1)
    let isolatedSquareDirection: 1 | -1 = $state(1)
    let nestedScrollSquare = $state(1)
    let nestedScrollDirection: 1 | -1 = $state(1)

    const current = $derived(slides[index])
    const squareColor = $derived(`var(--hue-${selectedSquare})`)
    const isolatedSquareColor = $derived(`var(--hue-${isolatedSquare})`)
    const nestedScrollColor = $derived(`var(--hue-${nestedScrollSquare})`)

    const variants: Variants = {
        enter: (custom) => ({
            x: (custom as number) > 0 ? 170 : -170,
            opacity: 0,
            filter: 'blur(10px)'
        }),
        center: {
            x: 0,
            opacity: 1,
            filter: 'blur(0px)'
        },
        exit: (custom) => ({
            x: (custom as number) > 0 ? -170 : 170,
            opacity: 0,
            filter: 'blur(10px)'
        })
    }

    const go = (nextDirection: number) => {
        direction = nextDirection
        index = (index + nextDirection + slides.length) % slides.length
    }

    const setSquare = (nextDirection: 1 | -1) => {
        selectedSquare = wrap(1, 6, selectedSquare + nextDirection)
        squareDirection = nextDirection
    }

    const setIsolatedSquare = (nextDirection: 1 | -1) => {
        isolatedSquare = wrap(1, 6, isolatedSquare + nextDirection)
        isolatedSquareDirection = nextDirection
    }

    const setNestedScrollSquare = (nextDirection: 1 | -1) => {
        nestedScrollSquare = wrap(1, 6, nestedScrollSquare + nextDirection)
        nestedScrollDirection = nextDirection
    }
</script>

<svelte:head>
    <title>AnimatePresence custom</title>
</svelte:head>

<main>
    <section class="intro">
        <p class="kicker">AnimatePresence custom (#309)</p>
        <h1>Directional exits should use parent presence data.</h1>
        <p>
            Click next or previous. The outgoing panel's dynamic <code>exit</code> variant must use
            <code>&lt;AnimatePresence custom={direction}&gt;</code>, not the exiting element's stale
            <code>custom</code> prop.
        </p>
    </section>

    <section class="stage" data-testid="presence-custom-stage">
        <div class="frame">
            <AnimatePresence custom={direction} initial={false}>
                {#key current.id}
                    <motion.div
                        key={current.id}
                        class="slide"
                        data-testid="presence-custom-slide"
                        data-slide={current.id}
                        data-direction={direction}
                        custom={direction * -999}
                        {variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.7, ease: 'linear' }}
                    >
                        <span>{current.eyebrow}</span>
                        <strong>{current.title}</strong>
                        <p>{current.detail}</p>
                    </motion.div>
                {/key}
            </AnimatePresence>
        </div>

        <div class="controls">
            <button type="button" data-testid="previous" onclick={() => go(-1)}>
                <span aria-hidden="true">←</span>
                Previous
            </button>
            <output data-testid="direction">direction {direction}</output>
            <button type="button" data-testid="next" onclick={() => go(1)}>
                Next
                <span aria-hidden="true">→</span>
            </button>
        </div>
    </section>

    <section class="stage canonical-stage" data-testid="presence-data-pop-layout-stage">
        <div>
            <p class="kicker">usePresenceData popLayout</p>
            <h2>Canonical square transition should not stack extra visual layers.</h2>
        </div>

        <div class="canonical-row" data-testid="presence-data-container">
            <motion.button
                initial={false}
                animate={{ backgroundColor: squareColor }}
                aria-label="Canonical previous"
                class="circle-button"
                data-testid="presence-data-previous"
                onclick={() => setSquare(-1)}
                whileFocus={{ outline: `2px solid ${squareColor}` }}
                whileTap={{ scale: 0.9 }}
            >
                ←
            </motion.button>

            <AnimatePresence custom={squareDirection} initial={false} mode="popLayout">
                {#key selectedSquare}
                    <PresenceDataSquare slideKey={selectedSquare} color={squareColor} />
                {/key}
            </AnimatePresence>

            <motion.button
                initial={false}
                animate={{ backgroundColor: squareColor }}
                aria-label="Canonical next"
                class="circle-button"
                data-testid="presence-data-next"
                onclick={() => setSquare(1)}
                whileFocus={{ outline: `2px solid ${squareColor}` }}
                whileTap={{ scale: 0.9 }}
            >
                →
            </motion.button>
        </div>
    </section>

    <section class="stage canonical-stage" data-testid="presence-data-motion-config-stage">
        <div>
            <p class="kicker">parent MotionConfig isolation</p>
            <h2>Upstream-style demo should not inherit slow page-level defaults.</h2>
        </div>

        <MotionConfig transition={{ duration: 0.6 }}>
            <MotionConfig>
                <div class="canonical-row" data-testid="presence-data-isolated-container">
                    <motion.button
                        initial={false}
                        animate={{ backgroundColor: isolatedSquareColor }}
                        aria-label="Isolated previous"
                        class="circle-button"
                        data-testid="presence-data-isolated-previous"
                        onclick={() => setIsolatedSquare(-1)}
                        whileFocus={{ outline: `2px solid ${isolatedSquareColor}` }}
                        whileTap={{ scale: 0.9 }}
                    >
                        ←
                    </motion.button>

                    <AnimatePresence
                        custom={isolatedSquareDirection}
                        initial={false}
                        mode="popLayout"
                    >
                        {#key isolatedSquare}
                            <PresenceDataSquare
                                slideKey={isolatedSquare}
                                color={isolatedSquareColor}
                            />
                        {/key}
                    </AnimatePresence>

                    <motion.button
                        initial={false}
                        animate={{ backgroundColor: isolatedSquareColor }}
                        aria-label="Isolated next"
                        class="circle-button"
                        data-testid="presence-data-isolated-next"
                        onclick={() => setIsolatedSquare(1)}
                        whileFocus={{ outline: `2px solid ${isolatedSquareColor}` }}
                        whileTap={{ scale: 0.9 }}
                    >
                        →
                    </motion.button>
                </div>
            </MotionConfig>
        </MotionConfig>
    </section>

    <section class="stage canonical-stage" data-testid="presence-data-nested-scroll-stage">
        <div>
            <p class="kicker">nested scroll popLayout</p>
            <h2>Cloned exits should stay pinned inside a scrolled layout parent.</h2>
        </div>

        <div class="nested-scroll-viewport" data-testid="presence-data-nested-scroll-viewport">
            <div class="nested-scroll-spacer" aria-hidden="true"></div>
            <div
                class="canonical-row nested-scroll-row"
                data-testid="presence-data-nested-scroll-container"
            >
                <motion.button
                    initial={false}
                    animate={{ backgroundColor: nestedScrollColor }}
                    aria-label="Nested scroll previous"
                    class="circle-button"
                    data-testid="presence-data-nested-scroll-previous"
                    onclick={() => setNestedScrollSquare(-1)}
                    whileFocus={{ outline: `2px solid ${nestedScrollColor}` }}
                    whileTap={{ scale: 0.9 }}
                >
                    ←
                </motion.button>

                <AnimatePresence custom={nestedScrollDirection} initial={false} mode="popLayout">
                    {#key nestedScrollSquare}
                        <PresenceDataSquare
                            slideKey={nestedScrollSquare}
                            color={nestedScrollColor}
                        />
                    {/key}
                </AnimatePresence>

                <motion.button
                    initial={false}
                    animate={{ backgroundColor: nestedScrollColor }}
                    aria-label="Nested scroll next"
                    class="circle-button"
                    data-testid="presence-data-nested-scroll-next"
                    onclick={() => setNestedScrollSquare(1)}
                    whileFocus={{ outline: `2px solid ${nestedScrollColor}` }}
                    whileTap={{ scale: 0.9 }}
                >
                    →
                </motion.button>
            </div>
            <div class="nested-scroll-spacer" aria-hidden="true"></div>
        </div>
    </section>
</main>

<style>
    :global(html),
    :global(body) {
        --hue-1: #ff0088;
        --hue-2: #dd00ee;
        --hue-3: #9911ff;
        --hue-4: #0d63f8;
        --hue-5: #0cdcf7;
        --hue-6: #4ff0b7;

        min-height: 100%;
        height: auto;
        margin: 0;
        overflow-y: auto;
        background: #0b1014;
        color: #e7f2fb;
        font-family:
            Inter,
            ui-sans-serif,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
    }

    :global(body > .h-full),
    :global(body > .h-full > .h-full),
    :global(.container),
    :global(#sandbox) {
        min-height: 100vh;
        height: auto;
    }

    main {
        min-height: 100vh;
        display: grid;
        align-content: start;
        gap: 28px;
        width: min(960px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 48px 0;
    }

    .intro {
        max-width: 720px;
    }

    .kicker {
        margin: 0 0 8px;
        color: #72d9f7;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1.08;
    }

    h2 {
        margin: 0;
        color: #f4f8fc;
        font-size: 22px;
        line-height: 1.15;
    }

    .intro p:not(.kicker) {
        margin: 12px 0 0;
        color: #afbfcc;
        font-size: 16px;
        line-height: 1.65;
    }

    code {
        color: #f5b7df;
    }

    .stage {
        display: grid;
        gap: 18px;
        padding: 26px;
        border: 1px solid #263947;
        background:
            linear-gradient(90deg, rgba(114, 217, 247, 0.1) 1px, transparent 1px),
            linear-gradient(0deg, rgba(114, 217, 247, 0.1) 1px, transparent 1px), #0e161c;
        background-size: 44px 44px;
    }

    .frame {
        position: relative;
        height: 280px;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid #324a5b;
        background: rgba(9, 15, 20, 0.78);
    }

    :global(.slide) {
        position: absolute;
        width: min(420px, calc(100% - 48px));
        min-height: 150px;
        display: grid;
        align-content: center;
        gap: 10px;
        padding: 24px;
        border: 1px solid #69c7e8;
        background: #13202a;
        box-shadow: 0 26px 80px rgba(0, 0, 0, 0.34);
        transform-origin: 50% 50%;
    }

    :global(.slide span) {
        color: #72d9f7;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    :global(.slide strong) {
        color: #f4f8fc;
        font-size: 27px;
        line-height: 1.12;
    }

    :global(.slide p) {
        margin: 0;
        color: #b5c6d3;
        line-height: 1.5;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 12px;
    }

    button,
    output {
        height: 38px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 0 13px;
        border: 1px solid #405767;
        border-radius: 6px;
        background: #121c24;
        color: #eef6fb;
        font-size: 13px;
        font-weight: 750;
    }

    button {
        cursor: pointer;
    }

    button:hover {
        border-color: #72d9f7;
    }

    output {
        color: #f5b7df;
    }

    .canonical-stage {
        gap: 28px;
    }

    .canonical-row {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        min-height: 220px;
    }

    :global(.circle-button) {
        position: relative;
        z-index: 1;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 50%;
        outline-offset: 2px;
        color: white;
        cursor: pointer;
    }

    .nested-scroll-viewport {
        height: 260px;
        overflow: auto;
        border: 1px solid #324a5b;
        background: rgba(9, 15, 20, 0.78);
    }

    .nested-scroll-spacer {
        height: 220px;
    }

    .nested-scroll-row {
        min-height: 220px;
    }
</style>
