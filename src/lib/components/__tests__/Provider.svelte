<script lang="ts">
    import type { Snippet } from 'svelte'
    import { createMotionConfig } from '$lib/components/motionConfig.context.js'

    let { transition, children }: { transition: { duration?: number }; children?: Snippet } =
        $props()

    createMotionConfig({ transition })
</script>

{@render children?.()}
