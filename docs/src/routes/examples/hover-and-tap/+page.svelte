<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import HoverAndTap from '$lib/examples/HoverAndTap.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Hover and Tap' }
        ]
    }
    if (seo) {
        seo.title = 'Hover and Tap | Examples | Svelte Motion'
        seo.description =
            'Gesture-driven animations for hover and tap interactions using Svelte Motion. Create responsive, interactive elements with spring physics.'
        seo.ogTitle = 'Hover and Tap'
        seo.ogTagline =
            'Gesture-driven animations for hover and tap interactions using Svelte Motion'
        seo.ogFeatures = ['whileHover', 'whileTap', 'Spring Physics', 'Gesture Events']
        seo.ogSlug = 'examples-hover-and-tap'
    }
</script>

<Example title="Hover and Tap" sourceUrl={data.sourceUrl}>
    <HoverAndTap />
</Example>
