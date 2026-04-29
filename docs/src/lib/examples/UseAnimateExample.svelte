<script lang="ts">
    import { stagger, useAnimate } from '@humanspeak/svelte-motion'

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
        animate('li', { opacity: 1, y: 0 }, { duration: 0 })
        animate('button.target', { scale: 1 }, { duration: 0 })
    }
</script>

<div class="flex min-h-[420px] flex-col items-center justify-center gap-4 p-8">
    <div class="controls">
        <button type="button" class="primary" onclick={run}>Animate</button>
        <button type="button" class="secondary" onclick={reset}>Reset</button>
    </div>

    <div {@attach scope} class="stage">
        <ul>
            {#each items as item (item)}
                <li>{item}</li>
            {/each}
        </ul>

        <button type="button" class="target">Target button</button>
    </div>
</div>

<style>
    .controls {
        display: flex;
        gap: 8px;
    }

    .stage {
        display: flex;
        flex-direction: column;
        gap: 12px;
        align-items: center;
    }

    button {
        font-size: 13px;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
    }

    button.primary {
        background: #2563eb;
        color: white;
    }

    button.secondary {
        background: rgba(255, 255, 255, 0.06);
        border-color: rgba(255, 255, 255, 0.18);
        color: white;
    }

    button.target {
        background: linear-gradient(135deg, #db2777 0%, #f59e0b 100%);
        color: white;
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 240px;
    }

    li {
        padding: 10px 14px;
        border-radius: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 500;
        font-size: 14px;
    }
</style>
