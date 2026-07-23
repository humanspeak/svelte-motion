<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // `whileFocus` reacts to keyboard focus + click focus on natively
    // focusable elements. The animation lasts as long as the element
    // holds focus and reverses on blur — perfect for keyboard-driven
    // affordances.
    let focused = $state<'button' | 'input' | 'card' | 'none'>('none')

    const ring = '0 0 0 3px var(--brut-accent-soft, rgba(36, 119, 104, 0.1))'
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// while-focus</span>
            <span class="micro state">focus: {focused}</span>
        </div>

        <div class="stage">
            <p class="instructions">Tab through or click the targets to see focus animations.</p>

            <motion.button
                whileHover={{ scale: 1.04 }}
                whileFocus={{ scale: 1.1, boxShadow: ring }}
                onFocusStart={() => (focused = 'button')}
                onFocusEnd={() => (focused = 'none')}
                style={styleString(() => ({
                    width: 160,
                    height: 48,
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.8125rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: '1px solid var(--brut-accent, #247768)',
                    background: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                    color: 'var(--brut-accent, #247768)',
                    cursor: 'pointer'
                }))}
            >
                Focus me
            </motion.button>

            <motion.input
                type="text"
                placeholder="Type here…"
                whileHover={{ scale: 1.02 }}
                whileFocus={{
                    scale: 1.05,
                    borderColor: 'var(--brut-accent, #247768)',
                    boxShadow: ring
                }}
                onFocusStart={() => (focused = 'input')}
                onFocusEnd={() => (focused = 'none')}
                style={styleString(() => ({
                    width: 240,
                    padding: '0.75rem 1rem',
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.8125rem',
                    border: '1px solid var(--brut-rule-2, #bbc4c0)',
                    background: 'var(--brut-bg, #f8fcfb)',
                    color: 'var(--brut-ink, #0a0a0a)'
                }))}
            />

            <motion.div
                tabindex="0"
                whileHover={{ scale: 1.02 }}
                whileFocus={{
                    scale: 1.08,
                    backgroundColor: 'var(--brut-accent, #247768)',
                    color: 'var(--brut-accent-ink, #f8fcfb)',
                    transition: { duration: 0.2 }
                }}
                onFocusStart={() => (focused = 'card')}
                onFocusEnd={() => (focused = 'none')}
                style={styleString(() => ({
                    width: 200,
                    height: 80,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    border: '1px solid var(--brut-ink, #0a0a0a)',
                    background: 'var(--brut-bg-2, #eef4f1)',
                    color: 'var(--brut-ink, #0a0a0a)',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
                    cursor: 'pointer',
                    userSelect: 'none'
                }))}
            >
                Focusable card
            </motion.div>
        </div>

        <div class="strip-foot">
            <span class="micro">gesture: whileFocus</span>
            <span class="micro">reverses on blur</span>
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
        max-width: 420px;
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
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1.5rem;
        padding: 1.5rem 0;
    }

    .instructions {
        margin: 0;
        font-size: 0.75rem;
        color: var(--brut-ink-2, #525252);
        text-align: center;
    }
</style>
