<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseCycleExample from '$lib/examples/UseCycleExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [{ title: 'Examples', href: '/examples' }, { title: 'useCycle' }]
    }
    if (seo) {
        seo.title = 'useCycle | Examples | Svelte Motion'
        seo.description =
            'Cycle through animation variants in Svelte. useCycle returns a reactive store and a cycle function for toggling motion states.'
        seo.ogTitle = 'useCycle'
        seo.ogTagline = 'Cycle through animation states'
        seo.ogFeatures = ['Variants', 'State Toggle', 'Reactive Store', 'SSR Safe']
        seo.ogSlug = 'examples-use-cycle'
    }
</script>

<Example title="useCycle" sourceUrl={data.sourceUrl}>
    <UseCycleExample />
</Example>
