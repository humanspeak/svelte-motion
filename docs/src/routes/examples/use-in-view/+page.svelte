<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseInViewExample from '$lib/examples/UseInViewExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'useInView' }]
    }
    if (seo) {
        seo.title = 'useInView | Examples | Svelte Motion'
        seo.description =
            'Detect viewport entry from a Svelte store with useInView. Reactive boolean store, IntersectionObserver-backed, with optional once-latch.'
        seo.ogTitle = 'useInView'
        seo.ogTagline = 'Detect viewport entry from a Svelte store'
        seo.ogFeatures = ['Reactive Store', 'IntersectionObserver', 'Once Latch', 'SSR Safe']
        seo.ogSlug = 'examples-use-in-view'
    }
</script>

<Example title="useInView" sourceUrl={data.sourceUrl}>
    <UseInViewExample />
</Example>
