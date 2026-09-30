<script lang="ts">
    import { resolve } from '$app/paths'
    import '../demo.css'
</script>

<svelte:head>
    <title>Boundary teardown destination</title>
</svelte:head>

<main class="teardown-lab destination-lab">
    <div class="destination-panel">
        <span class="destination-check" aria-hidden="true">✓</span>
        <p class="eyebrow">Navigation complete</p>
        <h1>Boundary teardown destination</h1>
        <p class="lede">A clean arrival.</p>
        <p class="explanation">
            You should see this green panel with no purple card floating over it. The previous
            page's exit was cancelled as soon as its boundary was removed.
        </p>
        <a class="navigation-button" href={resolve('/tests/animate-presence/boundary-teardown')}
            >Back to boundary teardown <span aria-hidden="true">↗</span></a
        >
    </div>
</main>
