<script lang="ts">
    import { MoveRight, RotateCcw, Sparkles, Zap } from '@lucide/svelte'
    import { motion, styleString, useAnimationControls } from '@humanspeak/svelte-motion'

    // Wildcard keyframes: `null` = "the current value", and relative strings
    // (`'+=30'`) offset from the current value. Both resolve against the live
    // value at the moment the animation STARTS — so a pulse picks up wherever
    // the card happens to be, even mid-flight.
    const controls = useAnimationControls()

    let note = $state('idle')

    // Glide to a random-ish x. The card can be anywhere when the next command
    // fires — that "anywhere" is exactly what the wildcards below read.
    const drift = () => {
        const x = Math.round(Math.random() * 120 - 60)
        note = `x → ${x}`
        void controls.start({ x }, { duration: 0.9, ease: 'easeInOut' })
    }

    // Relative nudge: `'+=30'` resolves against the card's LIVE x at start, so
    // it steps 30px right from wherever it currently is — no absolute target.
    const nudge = () => {
        note = "x '+=30'"
        void controls.start({ x: '+=30' }, { duration: 0.35, ease: 'easeOut' })
    }

    // Pulse from wherever you are: the leading `null` reads the live scale at
    // start, so the pulse begins from the current value (not a hardcoded 1) and
    // eases back to 1. `x: null` means "hold x at its current value" — another
    // wildcard — so pulsing from a drifted spot keeps the card exactly where it
    // is instead of snapping back to the origin.
    const pulse = () => {
        note = 'scale [null, 1.15, 1]'
        void controls.start(
            { scale: [null, 1.15, 1], x: null },
            { duration: 0.5, ease: 'easeInOut', times: [0, 0.4, 1] }
        )
    }

    const reset = () => {
        note = 'idle'
        controls.set({ x: 0, scale: 1 })
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// wildcard keyframes</span>
            <span class="micro readout">{note}</span>
        </div>

        <div class="toolbar" aria-label="Wildcard controls">
            <button type="button" class="ctrl" onclick={drift} aria-label="Drift to a random x">
                <MoveRight size={14} />
                Drift
            </button>
            <button type="button" class="ctrl" onclick={nudge} aria-label="Nudge x by +=30">
                <Zap size={14} />
                +=30
            </button>
            <button
                type="button"
                class="ctrl primary"
                onclick={pulse}
                aria-label="Pulse from current scale"
            >
                <Sparkles size={14} />
                Pulse
            </button>
            <button type="button" class="ctrl" onclick={reset} aria-label="Reset">
                <RotateCcw size={14} />
                Reset
            </button>
        </div>

        <div class="stage">
            <motion.div
                animate={controls}
                style={styleString(() => ({
                    width: 96,
                    height: 96,
                    display: 'grid',
                    placeItems: 'center',
                    border: '1px solid var(--brut-ink, #0a0a0a)',
                    background: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.12))',
                    color: 'var(--brut-accent, #247768)',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                    transformOrigin: '50% 50%'
                }))}
            >
                <Sparkles size={28} />
            </motion.div>
        </div>

        <div class="strip-foot">
            <span class="micro">null = live value · '+=' = live offset</span>
            <span class="micro">resolved at start</span>
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
        max-width: 480px;
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

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-transform: none;
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
        height: 16rem;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: var(--brut-bg-2, #eef4f1);
    }
</style>
