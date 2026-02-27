<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import PathMorphingExample from '$lib/examples/PathMorphingExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Path Morphing' }
        ]
    }
    if (seo) {
        seo.title = 'Path Morphing | Examples | Svelte Motion'
        seo.description =
            'Interactive path morphing animation using SVG shape interpolation with Svelte Motion.'
        seo.ogTitle = 'Path Morphing'
        seo.ogTagline =
            'Interactive path morphing animation using SVG shape interpolation with Svelte Motion'
        seo.ogFeatures = ['SVG Morphing', 'Shape Interpolation', 'useMotionValue', 'useTransform']
        seo.ogSlug = 'examples-path-morphing'
    }
</script>

<Example title="Path Morphing" sourceUrl={data.sourceUrl ?? undefined}>
    <PathMorphingExample />
</Example>
