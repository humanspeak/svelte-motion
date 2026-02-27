<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import ColorInterpolationExample from '$lib/examples/ColorInterpolationExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Color Interpolation' }
            ]
        }
        if (seo) {
            seo.title = 'Color Interpolation | Examples | Svelte Motion'
            seo.description =
                'Smooth color transitions between multiple color values using Svelte Motion. Demonstrates interpolation across the full color spectrum.'
            seo.ogTitle = 'Color Interpolation'
            seo.ogTagline =
                'Smooth color transitions between multiple color values using Svelte Motion'
            seo.ogFeatures = [
                'Color Transitions',
                'Spectrum Animation',
                'Smooth Interpolation',
                'Multi-Color'
            ]
        }
    })
</script>

<Example title="Color Interpolation" sourceUrl={data.sourceUrl}>
    <ColorInterpolationExample />
</Example>
