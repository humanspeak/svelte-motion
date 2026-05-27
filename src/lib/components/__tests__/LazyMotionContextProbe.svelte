<script lang="ts">
    import { domAnimation } from '$lib/features/domAnimation'
    import { getLazyMotionContext, setLazyMotionContext } from '$lib/components/lazyMotion.context'

    const context = {
        getFeatures: () => domAnimation,
        getIsLoaded: () => true,
        strict: true
    }

    const returned = setLazyMotionContext(context)
    const read = getLazyMotionContext()
</script>

<div
    data-testid="lazy-context"
    data-returned-same={returned === context}
    data-read-same={read === context}
    data-strict={read?.strict}
    data-gestures={read?.getFeatures().gestures}
    data-loaded={read?.getIsLoaded()}
></div>
