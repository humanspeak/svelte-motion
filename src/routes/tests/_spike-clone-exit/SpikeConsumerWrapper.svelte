<script lang="ts">
    /**
     * THROWAWAY SPIKE — a consumer-authored wrapper component, to test whether
     * an extra component + snippet boundary between the destroyed block and the
     * transition changes outro locality (component/snippet effects are
     * EFFECT_TRANSPARENT — svelte/src/internal/client/reactivity/effects.js:659).
     */
    import type { Snippet } from 'svelte'
    const { children }: { children?: Snippet } = $props()
</script>

<div class="consumer-wrapper">
    {@render children?.()}
</div>

<style>
    .consumer-wrapper {
        display: flex;
        gap: 0.75rem;
        padding: 0.5rem;
        border: 1px dotted #6b7280;
    }
</style>
