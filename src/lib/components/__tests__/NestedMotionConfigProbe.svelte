<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import type { ReducedMotionConfig } from '$lib/types'
</script>

{#snippet probe()}
    {@const cfg = getMotionConfig()}
    <div
        data-testid="inner-probe"
        data-duration={(cfg?.transition as { duration?: number } | undefined)?.duration ?? 'none'}
        data-reduced={cfg?.reducedMotion ?? 'none'}
        data-skip={String(cfg?.skipAnimations ?? 'none')}
    ></div>
{/snippet}

<MotionConfig
    transition={{ duration: 0.5 }}
    reducedMotion={'always' as ReducedMotionConfig}
    skipAnimations
>
    <MotionConfig transition={{ duration: 0.2 }}>
        {@render probe()}
    </MotionConfig>
</MotionConfig>
