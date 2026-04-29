<script lang="ts">
    import { stagger, useAnimate } from '$lib'

    const [scope, animate] = useAnimate()

    let status: 'idle' | 'running' | 'done' = $state('idle')
    let runToken = 0

    const run = async () => {
        const token = ++runToken
        status = 'running'
        const animation = animate(
            [
                ['li', { opacity: [0, 1], y: [20, 0] }, { delay: stagger(0.08), duration: 0.4 }],
                ['button.target', { scale: 1.15 }, { duration: 0.4, at: '-0.2', ease: 'easeOut' }]
            ],
            { defaultTransition: { ease: 'easeOut' } }
        )
        await animation
        if (token === runToken) status = 'done'
    }

    const reset = () => {
        runToken++
        for (const animation of scope.animations) animation.stop()
        scope.animations.length = 0
        animate('li', { opacity: 1, y: 0 }, { duration: 0 })
        animate('button.target', { scale: 1 }, { duration: 0 })
        status = 'idle'
    }
</script>

<svelte:head>
    <title>useAnimate Test</title>
</svelte:head>

<div class="page">
    <header>
        <h1>useAnimate</h1>
        <p>
            Imperative animation with a scoped CSS-selector API. The scope attaches to the wrapper
            that contains both the list and the target button, so <code>animate('li', …)</code> and
            <code>animate('button.target', …)</code> both resolve against it.
        </p>
    </header>

    <section class="controls">
        <button type="button" class="primary" data-testid="run" data-status={status} onclick={run}>
            Animate
        </button>
        <button type="button" class="secondary" data-testid="reset" onclick={reset}>Reset</button>
        <span class="status" data-testid="status">{status}</span>
    </section>

    <div {@attach scope} class="stage" data-testid="stage">
        <ul data-testid="list">
            <li data-testid="item-1">Item one</li>
            <li data-testid="item-2">Item two</li>
            <li data-testid="item-3">Item three</li>
            <li data-testid="item-4">Item four</li>
        </ul>

        <button type="button" class="target" data-testid="target">Target button</button>
    </div>
</div>

<style>
    .page {
        padding: 24px;
        max-width: 520px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .controls {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .stage {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    button {
        font-size: 14px;
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
        background: white;
        border-color: #d1d5db;
        color: #111;
    }

    button.target {
        background: linear-gradient(135deg, #db2777 0%, #f59e0b 100%);
        color: white;
        align-self: flex-start;
    }

    ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    li {
        padding: 12px 16px;
        border-radius: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 500;
    }

    .status {
        margin-left: auto;
        font-size: 13px;
        color: #555;
    }
</style>
