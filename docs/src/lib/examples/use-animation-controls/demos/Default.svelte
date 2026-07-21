<script lang="ts">
    import { Check, Pause, Play, RotateCcw, Wand2 } from '@lucide/svelte'
    import { motion, styleString, useAnimationControls } from '@humanspeak/svelte-motion'

    const controls = useAnimationControls()

    let status = $state<'ready' | 'launching' | 'verified' | 'paused'>('ready')
    let count = $state(0)
    let sequenceId = 0

    const shell = {
        ready: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
        launch: { x: 72, y: -8, scale: 1.04, rotate: 2, opacity: 1 },
        verified: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
    }

    const beam = {
        ready: { scaleX: 0.16, opacity: 0.35 },
        launch: { scaleX: 1, opacity: 1 },
        verified: { scaleX: 0.66, opacity: 0.7 }
    }

    const badge = {
        ready: { scale: 0.86, opacity: 0.55, rotate: -8 },
        launch: { scale: 1.18, opacity: 1, rotate: 8 },
        verified: { scale: 1, opacity: 1, rotate: 0 }
    }

    const text = {
        ready: { opacity: 0.66 },
        launch: { opacity: 1 },
        verified: { opacity: 1 }
    }

    const run = async () => {
        const id = ++sequenceId
        count += 1
        status = 'launching'
        await controls.start('launch', { duration: 0.55, ease: 'easeOut' })
        if (id !== sequenceId) return
        status = 'verified'
        await controls.start('verified', { duration: 0.42, ease: 'easeInOut' })
        if (id !== sequenceId) return
    }

    const setVerified = () => {
        sequenceId += 1
        count += 1
        status = 'verified'
        controls.set('verified')
    }

    const stop = () => {
        sequenceId += 1
        status = 'paused'
        controls.stop()
    }

    const reset = () => {
        sequenceId += 1
        status = 'ready'
        controls.set('ready')
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-animation-controls</span>
            <span class="micro state">status: {status}</span>
        </div>

        <div class="toolbar" aria-label="Animation controls">
            <button type="button" class="ctrl primary" onclick={run} aria-label="Start sequence">
                <Play size={14} />
                Start
            </button>
            <button type="button" class="ctrl" onclick={stop} aria-label="Stop animation">
                <Pause size={14} />
                Stop
            </button>
            <button type="button" class="ctrl" onclick={setVerified} aria-label="Set verified">
                <Check size={14} />
                Set
            </button>
            <button type="button" class="ctrl" onclick={reset} aria-label="Reset">
                <RotateCcw size={14} />
                Reset
            </button>
        </div>

        <div class="stage">
            <motion.div
                initial="ready"
                animate={controls}
                variants={shell}
                style={styleString(() => ({
                    width: 230,
                    display: 'grid',
                    gap: '0.875rem',
                    padding: '1.125rem',
                    border: '1px solid var(--brut-ink, #0a0a0a)',
                    background: 'var(--brut-bg-2, #eef4f1)',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                    transformOrigin: '50% 50%'
                }))}
            >
                <div class="ship-top">
                    <Wand2 size={22} />
                    <motion.div
                        initial="ready"
                        animate={controls}
                        variants={text}
                        style={styleString(() => ({
                            fontFamily: 'var(--brut-mono, monospace)',
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: 'var(--brut-accent, #247768)'
                        }))}
                    >
                        {status}
                    </motion.div>
                </div>
                <motion.div
                    initial="ready"
                    animate={controls}
                    variants={beam}
                    style={styleString(() => ({
                        width: '100%',
                        height: 8,
                        background: 'var(--brut-accent, #247768)',
                        transformOrigin: '0 50%'
                    }))}
                />
                <div class="ship-bottom">
                    <span class="run">run {count}</span>
                    <motion.div
                        initial="ready"
                        animate={controls}
                        variants={badge}
                        style={styleString(() => ({
                            width: 34,
                            height: 34,
                            display: 'grid',
                            placeItems: 'center',
                            border: '1px solid var(--brut-accent, #247768)',
                            background: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                            color: 'var(--brut-accent, #247768)'
                        }))}
                    >
                        <Check size={18} />
                    </motion.div>
                </div>
            </motion.div>
        </div>

        <div class="strip-foot">
            <span class="micro">one controls object, four targets</span>
            <span class="micro state">runs: {String(count).padStart(2, '0')}</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 480px;
    }

    .strip {
        width: 100%;
        max-width: 560px;
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

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .ctrl {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.4rem 0.75rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: transparent;
        color: var(--brut-ink-2, #525252);
        cursor: pointer;
    }

    .ctrl.primary {
        border-color: var(--brut-accent, #247768);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
    }

    .stage {
        height: 15rem;
        display: grid;
        place-items: center;
        overflow: hidden;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    .ship-top,
    .ship-bottom {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        color: var(--brut-ink, #0a0a0a);
    }

    .run {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
        font-variant-numeric: tabular-nums;
    }
</style>
