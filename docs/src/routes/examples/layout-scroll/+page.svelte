<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import LayoutScrollExample from '$lib/examples/LayoutScrollExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'layoutScroll' }
        ]
    }
    if (seo) {
        seo.title = 'layoutScroll — FLIP inside scroll containers | Examples | Svelte Motion'
        seo.description =
            'Use layoutScroll to keep FLIP layout animations anchored when the user scrolls the parent container mid-animation. Side-by-side demo of the drift vs the fix.'
        seo.ogTitle = 'layoutScroll'
        seo.ogTagline = 'Keep layout animations anchored across container scroll'
        seo.ogFeatures = ['FLIP layout', 'layoutScroll', 'Scroll containers', 'Anchored animations']
        seo.ogSlug = 'examples-layout-scroll'
    }
</script>

<Example title="layoutScroll — FLIP inside scroll containers" file="LayoutScrollExample.svelte">
    <LayoutScrollExample />
</Example>
