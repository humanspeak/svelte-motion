<script lang="ts">
    /**
     * `arc()` driven by `useAnimate()` on a plain (non-motion) element.
     *
     * Svelte port of upstream's `UseAnimateArc`
     * (`dev/react/src/tests/transition-arc.tsx`, variant `use-animate`, commit
     * `72a1ee2ec`). From Motion 14.3.1, element animations (`animate(el, …)` /
     * `useAnimate`) honor `transition.path` through `MotionPath.animateValues`,
     * so the indicator deflects perpendicular to its x travel instead of moving
     * in a straight line. `?freeze` pins the ease at 0.5 (midpoint) for e2e.
     *
     * @component
     */
    import { arc, useAnimate } from '$lib'
    import { onMount } from 'svelte'

    const [scope, animate] = useAnimate()
    // Created once so the arc's direction-continuity closure survives clicks.
    const path = arc({ strength: 1 })

    let freeze = false

    onMount(() => {
        freeze = new URLSearchParams(location.search).has('freeze')
    })

    const run = () => {
        if (!scope.current) return
        animate(
            scope.current,
            { x: 400, y: 0 },
            freeze ? { duration: 4, ease: () => 0.5, path } : { duration: 1.2, path }
        )
    }
</script>

<svelte:head>
    <title>arc() via useAnimate()</title>
</svelte:head>

<div class="container">
    <button type="button" class="toggle" data-testid="toggle" onclick={run}>Toggle</button>
    <div class="indicator" data-testid="indicator" {@attach scope}></div>
</div>

<style>
    .container {
        position: relative;
        width: 100vw;
        height: 100vh;
    }

    .toggle {
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 1;
    }

    .indicator {
        position: absolute;
        top: 200px;
        left: 50px;
        width: 100px;
        height: 100px;
        background: red;
    }
</style>
