<!--
    Port of Motion 14.6.0 `dev/react/src/tests/issue-2579.tsx` (issue #2579;
    upstream commits aed29215d, ee53e616e): the observed element renders
    after mount, then is removed. `useInView` must observe the late element
    and report `false` once it is gone.
-->
<script lang="ts">
    import { useInView } from '$lib'

    let ref = $state<HTMLDivElement>()
    let hidden = $state(true)
    const isInView = useInView(() => ref)
</script>

<svelte:head>
    <title>useInView: element rendered after mount</title>
</svelte:head>

<div class="page">
    <button data-testid="show" onclick={() => (hidden = false)}>Show</button>
    <button data-testid="hide" onclick={() => (hidden = true)}>Hide</button>
    <div data-testid="in-view">{String(isInView.current)}</div>
    {#if !hidden}
        <div bind:this={ref} data-testid="box" class="box"></div>
    {/if}
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        align-items: flex-start;
        padding: 1rem;
    }
    button {
        padding: 0.25rem 0.75rem;
        border: 1px solid currentColor;
        border-radius: 0.25rem;
    }
    .box {
        width: 100px;
        height: 100px;
        background: red;
    }
</style>
