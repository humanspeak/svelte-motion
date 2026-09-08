<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { MotionTransformPoint } from '$lib/types.js'

    // eslint-disable-next-line svelte/no-unused-props -- this harness must test omitted versus explicitly undefined props
    let props: {
        parentTransformPagePoint?: MotionTransformPoint
        childTransformPagePoint?: MotionTransformPoint
        dragEnabled?: boolean
    } = $props()

    const hasChildTransformPagePoint = $derived(
        Object.prototype.hasOwnProperty.call(props, 'childTransformPagePoint')
    )
</script>

{#snippet configuredChild()}
    {@const config = getMotionConfig()}
    {@const mapped = config?.transformPagePoint?.({ x: 10, y: 20 })}
    <span data-testid="config-probe" data-point={mapped ? JSON.stringify(mapped) : 'none'}></span>
    <MotionContainer
        tag="div"
        data-testid="motion-target"
        drag={props.dragEnabled ? 'x' : false}
        dragMomentum={false}
    />
{/snippet}

<MotionConfig transformPagePoint={props.parentTransformPagePoint}>
    {#if hasChildTransformPagePoint}
        <MotionConfig transformPagePoint={props.childTransformPagePoint}>
            {@render configuredChild()}
        </MotionConfig>
    {:else}
        <MotionConfig>
            {@render configuredChild()}
        </MotionConfig>
    {/if}
</MotionConfig>
