<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseAnimationFrameExample from '$lib/examples/UseAnimationFrameExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'useAnimationFrame' }
            ]
        }
        if (seo) {
            seo.title = 'useAnimationFrame | Examples | Svelte Motion'
            seo.description =
                'Run animations on every frame with Svelte Motion useAnimationFrame. Access delta time and elapsed time for smooth, frame-based effects.'
        }
    })
</script>

<Example title="useAnimationFrame" motionUrl={data.sourceUrl}>
    <UseAnimationFrameExample />
</Example>
