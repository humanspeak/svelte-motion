<script lang="ts">
    import { animate, motion, styleString } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    // `animate(from, to, options)` drives any imperative value over time.
    // The `onUpdate` callback hands you the latest interpolated value —
    // round it, format it, and stuff it into `$state` to render rich HTML
    // content (here, a giant counter) on each frame.
    let count = $state(0)

    onMount(() => {
        const controls = animate(0, 100, {
            duration: 5,
            onUpdate: (latest: number) => {
                count = Math.round(latest)
            }
        }) as unknown as { stop: () => void }
        return () => controls.stop()
    })
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// html content</span>
            <span class="micro counter">{String(count).padStart(3, '0')} / 100</span>
        </div>

        <div class="stage">
            <motion.pre
                style={styleString(() => ({
                    margin: 0,
                    fontFamily: 'var(--brut-mono, monospace)',
                    fontSize: '64px',
                    fontWeight: 700,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--brut-accent, #247768)'
                }))}>{count}</motion.pre
            >
        </div>

        <div class="strip-foot">
            <span class="micro">source: animate() onUpdate</span>
            <span class="micro">0 → 100 / 5s</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 240px;
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

    .counter {
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
        height: 7rem;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
