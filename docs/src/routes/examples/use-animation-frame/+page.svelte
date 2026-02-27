<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseAnimationFrameExample from '$lib/examples/UseAnimationFrameExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
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
        seo.ogTitle = 'useAnimationFrame'
        seo.ogTagline = 'Run animations on every frame with Svelte Motion useAnimationFrame'
        seo.ogFeatures = ['Delta Time', 'Elapsed Time', 'Frame Callback', 'Smooth Effects']
        seo.ogSlug = 'examples-use-animation-frame'
    }
</script>

<Example title="useAnimationFrame" sourceUrl={data.sourceUrl}>
    <UseAnimationFrameExample />
</Example>
