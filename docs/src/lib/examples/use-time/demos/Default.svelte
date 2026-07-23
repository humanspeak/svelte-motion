<script lang="ts">
    import { useTime } from '@humanspeak/svelte-motion'
    import { derived } from 'svelte/store'

    // `useTime()` returns a motion value that ticks ms since the hook
    // mounted. Derive whatever you need from it (svelte/store `derived`
    // or `useTransform`) — every derived store updates each frame.
    const time = useTime()

    const x = derived(time, (t) => Math.sin(t / 1000) * 80)
    const y = derived(time, (t) => Math.cos(t / 1200) * 60)
    const rotate = derived(time, (t) => (t / 15) % 360)
    const scale = derived(time, (t) => 1 + Math.sin(t / 800) * 0.15)
    const hue = derived(time, (t) => (t / 20) % 360)
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-time</span>
            <span class="micro state">hue: {Math.round($hue)}°</span>
        </div>

        <div class="stage">
            <div
                class="tile"
                style="
                    transform: translate({$x}px, {$y}px) rotate({$rotate}deg) scale({$scale});
                    background: linear-gradient(135deg, hsl({$hue}, 62%, 52%), hsl({$hue +
                    60}, 62%, 44%));
                "
            ></div>
        </div>

        <div class="strip-foot">
            <span class="micro">motion value: ms since mount</span>
            <span class="micro state">t = {Math.floor($time / 1000)}s</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 400px;
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
        font-variant-numeric: tabular-nums;
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
        height: 16rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg-2, #eef4f1);
        overflow: hidden;
    }

    .tile {
        width: 108px;
        height: 108px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        box-shadow: 6px 6px 0 var(--brut-rule, #d6dedb);
        will-change: transform;
    }
</style>
