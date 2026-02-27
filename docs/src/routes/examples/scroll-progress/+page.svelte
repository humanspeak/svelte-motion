<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import ScrollProgressExample from '$lib/examples/ScrollProgressExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Scroll Progress' }
        ]
    }
    if (seo) {
        seo.title = 'Scroll Progress | Examples | Svelte Motion'
        seo.description =
            'Interactive scroll progress animation example using Svelte Motion useScroll and useSpring.'
        seo.ogTitle = 'Scroll Progress'
        seo.ogTagline =
            'Interactive scroll progress animation example using Svelte Motion useScroll and useSpring'
        seo.ogFeatures = ['useScroll', 'useSpring', 'Progress Bar', 'Scroll-Linked']
        seo.ogSlug = 'examples-scroll-progress'
    }
</script>

<Example title="Scroll Progress" sourceUrl={data.sourceUrl ?? undefined}>
    <ScrollProgressExample />
</Example>
