<script lang="ts">
    // SPIKE 006 only: prints which drag implementation this build uses, so a
    // Playwright run can confirm VITE_UPSTREAM_DRAG reached `vite build`.
    import { USE_UPSTREAM_DRAG } from '$lib/utils/dragImpl'
</script>

<p data-testid="drag-impl">{USE_UPSTREAM_DRAG ? 'upstream' : 'legacy'}</p>
