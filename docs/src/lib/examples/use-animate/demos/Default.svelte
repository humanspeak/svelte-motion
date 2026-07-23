<script lang="ts">
    import { stagger, useAnimate } from '@humanspeak/svelte-motion'

    // `useAnimate` returns `[scope, animate]`. The scope attaches to a DOM
    // subtree via `{@attach scope}` and the imperative `animate` calls
    // resolve CSS selectors inside it. Sequence steps (and stagger across
    // matched elements) without writing any motion components.
    const [scope, animate] = useAnimate()

    const items = ['Stagger', 'Sequence', 'Compose', 'Done'] as const

    const run = () =>
        animate(
            [
                ['li', { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.08), duration: 0.4 }],
                [
                    'button.target',
                    { scale: [1, 1.08, 1] },
                    { duration: 0.4, at: '-0.2', ease: 'easeOut' }
                ]
            ],
            { defaultTransition: { ease: 'easeOut' } }
        )

    const reset = () => {
        for (const animation of scope.animations) animation.stop()
        scope.animations.length = 0
        animate('li', { opacity: 1, y: 0 }, { duration: 0 })
        animate('button.target', { scale: 1 }, { duration: 0 })
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// use-animate</span>
            <span class="micro state">stagger: 0.08s → target</span>
        </div>

        <div {@attach scope} class="stage">
            <ul>
                {#each items as item, i (item)}
                    <li>
                        <span class="index">{String(i + 1).padStart(2, '0')}</span>
                        <span class="label">{item}</span>
                    </li>
                {/each}
            </ul>

            <button type="button" class="target">Target button</button>
        </div>

        <div class="strip-foot">
            <button type="button" class="ctrl primary" onclick={run}>Animate</button>
            <button type="button" class="ctrl" onclick={reset}>Reset</button>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 440px;
    }

    .strip {
        width: 100%;
        max-width: 360px;
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
        justify-content: flex-start;
        gap: 0.5rem;
    }

    .stage {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        align-items: stretch;
        padding: 0.5rem 0;
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    li {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0.875rem;
        background: var(--brut-bg-2, #eef4f1);
        border: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    .index {
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        letter-spacing: 0.08em;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .label {
        font-family: var(--brut-mono, monospace);
        font-size: 0.8125rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--brut-ink, #0a0a0a);
    }

    button.target {
        padding: 0.75rem 0.875rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        color: var(--brut-accent, #247768);
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
        cursor: pointer;
    }

    .ctrl {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 0.5rem 0.875rem;
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
</style>
