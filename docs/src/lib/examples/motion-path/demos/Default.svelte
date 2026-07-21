<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'

    // Two parallel motion tracks driven by the same SVG path:
    //   1) `motion.path` tweens `pathLength` 0 → 1 — the line draws itself.
    //   2) `motion.div` uses CSS `offset-path` so the box rides the same
    //      curve as `offsetDistance` goes 0% → 100%.
    // Both run on the same transition so they stay in sync.
    const transition = {
        duration: 4,
        repeat: Infinity,
        repeatType: 'reverse' as const,
        ease: 'easeInOut' as const
    }

    const pathData =
        'M 239 17 C 142 17 48.5 103 48.5 213.5 C 48.5 324 126 408 244 408 C 362 408 412 319 412 213.5 C 412 108 334 68.5 244 68.5 C 154 68.5 102.68 135.079 99 213.5 C 95.32 291.921 157 350 231 345.5 C 305 341 357.5 290 357.5 219.5 C 357.5 149 314 121 244 121 C 174 121 151.5 167 151.5 213.5 C 151.5 260 176 286.5 224.5 286.5 C 273 286.5 296.5 253 296.5 218.5 C 296.5 184 270 177 244 177 C 218 177 197 198 197 218.5 C 197 239 206 250.5 225.5 250.5 C 245 250.5 253 242 253 218.5'

    const box = {
        width: 50,
        height: 50,
        backgroundColor: 'var(--brut-ink, #0a0a0a)',
        border: '1px solid var(--brut-accent, #247768)',
        position: 'absolute',
        top: 0,
        left: 0,
        offsetPath: `path("${pathData}")`
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// motion-path</span>
            <span class="micro readout">pathLength 0 → 1</span>
        </div>

        <div class="stage">
            <div style={styleString(() => ({ position: 'relative' }))}>
                <svg xmlns="http://www.w3.org/2000/svg" width="451" height="437">
                    <motion.path
                        d={pathData}
                        fill="transparent"
                        stroke-width="12"
                        stroke-linecap="round"
                        style={styleString(() => ({
                            stroke: 'var(--brut-accent, #247768)',
                            strokeOpacity: 0.55
                        }))}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        {transition}
                    />
                </svg>
                <motion.div
                    style={styleString(() => box)}
                    initial={{ offsetDistance: '0%', scale: 2.5 }}
                    animate={{ offsetDistance: '100%', scale: 1 }}
                    {transition}
                />
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">path draws · box rides offset-path</span>
            <span class="micro">4s · reverse loop</span>
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
        max-width: 483px;
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

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        overflow-x: auto;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg-2, #eef4f1);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
    }
</style>
