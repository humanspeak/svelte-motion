<!--
  @component
  Interactive example demonstrating the styleString helper with reactive controls.
-->
<script lang="ts">
    import { motion, styleString, useTime, useTransform } from '@humanspeak/svelte-motion'

    // `styleString` takes a JS-style object and returns a CSS string. Passing it
    // a function (getter) makes the result reactive — any $state read inside
    // re-runs the conversion when that state changes. Mix in motion values
    // (`$autoRotate`) and they update every frame.
    let rotation = $state(0)
    let scale = $state(1)
    let hue = $state(200)

    const time = useTime()
    const autoRotate = useTransform(time, [0, 2000], [0, 360], { clamp: false })

    let autoMode = $state(false)

    const resetStyle = styleString(() => ({
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.6875rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        border: '1px solid var(--brut-accent, #247768)',
        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
        color: 'var(--brut-accent, #247768)',
        padding: '0.5rem 0.875rem',
        cursor: 'pointer'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// style-string</span>
            <span class="micro readout">hsl({hue}, 70%, 50%)</span>
        </div>

        <div class="stage">
            <div
                style={styleString({
                    width: 120,
                    height: 120,
                    backgroundColor: `hsl(${hue}, 70%, 50%)`,
                    rotate: autoMode ? $autoRotate : rotation,
                    scale: scale,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#f8fcfb',
                    border: '1px solid var(--brut-ink, #0a0a0a)',
                    boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)'
                })}
            >
                reactive
            </div>
        </div>

        <div class="controls">
            <label class="toggle">
                <input type="checkbox" bind:checked={autoMode} />
                <span>auto rotate</span>
            </label>

            <div class="control" class:muted={autoMode}>
                <div class="control-row">
                    <span id="rotation-label">rotation</span>
                    <span class="val">{rotation}°</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="360"
                    bind:value={rotation}
                    disabled={autoMode}
                    aria-labelledby="rotation-label"
                />
            </div>

            <div class="control">
                <div class="control-row">
                    <span id="scale-label">scale</span>
                    <span class="val">{scale.toFixed(1)}</span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    bind:value={scale}
                    aria-labelledby="scale-label"
                />
            </div>

            <div class="control">
                <div class="control-row">
                    <span id="hue-label">hue</span>
                    <span class="val">{hue}°</span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="360"
                    bind:value={hue}
                    aria-labelledby="hue-label"
                />
            </div>

            <motion.button
                onclick={() => {
                    rotation = 0
                    scale = 1
                    hue = 200
                    autoMode = false
                }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                style={resetStyle}
            >
                reset
            </motion.button>
        </div>

        <div class="strip-foot">
            <span class="micro">object → css string, live</span>
            <span class="micro">mode: {autoMode ? 'auto' : 'manual'}</span>
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
        gap: 1rem;
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

    .stage {
        height: 12rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: var(--brut-bg-2, #eef4f1);
    }

    .controls {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        padding: 0.875rem;
    }

    .toggle {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--brut-ink, #0a0a0a);
    }

    .toggle input {
        width: 14px;
        height: 14px;
        accent-color: var(--brut-accent, #247768);
    }

    .control {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
    }

    .control.muted {
        opacity: 0.4;
    }

    .control-row {
        display: flex;
        justify-content: space-between;
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--brut-ink-2, #525252);
    }

    .control-row .val {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .control input[type='range'] {
        width: 100%;
        accent-color: var(--brut-accent, #247768);
    }
</style>
