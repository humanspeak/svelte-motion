<script lang="ts">
    import { useTime } from '@humanspeak/svelte-motion'
    import { derived } from 'svelte/store'

    // `useTime(key)` returns the *same* motion value for any caller that
    // passes the same key. Two components calling `useTime('synced')`
    // share one clock — perfect when you want independent UI to stay in
    // phase without hoisting state.
    const time = useTime('synced-timeline')
    const time2 = useTime('synced-timeline')

    const rotate1 = derived(time, (t) => (t / 10) % 360)
    const rotate2 = derived(time2, (t) => (t / 10) % 360)

    const scale1 = derived(time, (t) => 1 + Math.sin(t / 800) * 0.2)
    const scale2 = derived(time2, (t) => 1 + Math.sin(t / 800) * 0.2)

    const hue = derived(time, (t) => (t / 30) % 360)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-time-synced</span>
            <span class="micro state">key: "synced-timeline"</span>
        </div>

        <div class="stage">
            <div class="cell">
                <div
                    class="tile"
                    style="
                        transform: rotate({$rotate1}deg) scale({$scale1});
                        background: linear-gradient(135deg, hsl({$hue}, 62%, 52%), hsl({$hue +
                        30}, 62%, 44%));
                    "
                >
                    <span class="tile-label">A</span>
                </div>
            </div>

            <div class="cell">
                <div
                    class="tile"
                    style="
                        transform: rotate({$rotate2}deg) scale({$scale2});
                        background: linear-gradient(135deg, hsl({$hue + 120}, 62%, 52%), hsl({$hue +
                        150}, 62%, 44%));
                    "
                >
                    <span class="tile-label">B</span>
                </div>
            </div>
        </div>

        <div class="strip-foot">
            <span class="micro">time A</span>
            <span class="micro readout">
                {($time / 1000).toFixed(1)}s = {($time2 / 1000).toFixed(1)}s
            </span>
            <span class="micro">time B</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 420px;
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

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }

    .stage {
        height: 14rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
    }

    .cell {
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .tile {
        width: 100px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--brut-ink, #0a0a0a);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        will-change: transform;
    }

    .tile-label {
        font-family: var(--brut-mono, monospace);
        font-size: 2rem;
        font-weight: 700;
        color: #ffffff;
    }
</style>
