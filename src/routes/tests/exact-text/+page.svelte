<script lang="ts">
    import ExactText from '$lib/html/__tests__/ExactText.svelte'
    import { onMount } from 'svelte'

    let hydrated = $state(false)
    onMount(() => {
        hydrated = true
    })
</script>

<h1>Exact text preservation</h1>
<p>Motion elements preserve authored spaces, graphemes, and MotionValue text.</p>
<p data-testid="hydrated">{hydrated ? 'yes' : 'no'}</p>
<section data-testid="plain">
    <h2>Without optimized appear</h2>
    <ExactText />
</section>
<section data-testid="appear">
    <h2>With optimized appear</h2>
    <ExactText appear />
</section>
