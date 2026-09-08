<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { MotionTransformPoint } from '$lib/types.js'

    let {
        parentTransformPagePoint = undefined,
        childTransformPagePoint = undefined,
        dragEnabled = false
    }: {
        parentTransformPagePoint?: MotionTransformPoint
        childTransformPagePoint?: MotionTransformPoint
        dragEnabled?: boolean
    } = $props()
</script>

{#snippet configuredChild()}
    {@const config = getMotionConfig()}
    {@const mapped = config?.transformPagePoint?.({ x: 10, y: 20 })}
    <span data-testid="config-probe" data-point={mapped ? JSON.stringify(mapped) : 'none'}></span>
    <MotionContainer
        tag="div"
        data-testid="motion-target"
        drag={dragEnabled ? 'x' : false}
        dragMomentum={false}
    />
{/snippet}

<MotionConfig transformPagePoint={parentTransformPagePoint}>
    <MotionConfig transformPagePoint={childTransformPagePoint}>
        {@render configuredChild()}
    </MotionConfig>
</MotionConfig>
