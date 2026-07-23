<script lang="ts">
    import { motion, styleString, type MotionTransition } from '@humanspeak/svelte-motion'

    let isOn = $state(true)

    // From https://easings.net/#easeOutBounce
    const bounceEase = (x: number): number => {
        const n1 = 7.5625
        const d1 = 2.75

        if (x < 1 / d1) {
            return n1 * x * x
        } else if (x < 2 / d1) {
            return n1 * (x -= 1.5 / d1) * x + 0.75
        } else if (x < 2.5 / d1) {
            return n1 * (x -= 2.25 / d1) * x + 0.9375
        } else {
            return n1 * (x -= 2.625 / d1) * x + 0.984375
        }
    }

    const bounce: MotionTransition = {
        duration: 1.2,
        ease: bounceEase
    }

    const spring: MotionTransition = {
        type: 'spring',
        stiffness: 700,
        damping: 30
    }

    // Spring on the way up (snappy), bounce on the way down (playful).
    const currentTransition = $derived(isOn ? spring : bounce)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// toggle-switch</span>
            <span class="micro state">state: {isOn ? 'on' : 'off'}</span>
        </div>

        <div class="stage">
            <motion.button
                onclick={() => (isOn = !isOn)}
                type="button"
                aria-label={isOn ? 'Turn off' : 'Turn on'}
                whileHover={{ backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))' }}
                style={styleString(() => ({
                    width: 80,
                    height: 200,
                    display: 'flex',
                    alignItems: isOn ? 'flex-start' : 'flex-end',
                    padding: 10,
                    border: '1px solid var(--brut-ink, #0a0a0a)',
                    background: 'var(--brut-bg-2, #eef4f1)',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                    cursor: 'pointer'
                }))}
            >
                <motion.div
                    layout
                    transition={currentTransition}
                    style={styleString(() => ({
                        width: 60,
                        height: 60,
                        background: 'var(--brut-accent, #247768)',
                        border: '1px solid var(--brut-ink, #0a0a0a)',
                        boxShadow: '4px 4px 0 var(--brut-rule, #d6dedb)',
                        willChange: 'transform'
                    }))}
                ></motion.div>
            </motion.button>
        </div>

        <div class="strip-foot">
            <span class="micro">up: spring 700/30</span>
            <span class="micro state">
                {isOn ? 'transition: spring' : 'transition: bounce'}
            </span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 360px;
    }

    .strip {
        width: 100%;
        max-width: 320px;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .state {
        color: var(--brut-accent, #247768);
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .stage {
        height: 15rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
