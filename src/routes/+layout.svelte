<script lang="ts">
    import type { Snippet } from 'svelte'
    import './app.css'

    type Props = {
        children: Snippet
    }

    let { children }: Props = $props()
</script>

<div class="container">
    <main id="sandbox">
        {@render children?.()}
    </main>
</div>
