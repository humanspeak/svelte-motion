<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseTimeExample from '$lib/examples/UseTimeExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'useTime' }
            ]
        }
        if (seo) {
            seo.title = 'useTime | Examples | Svelte Motion'
            seo.description =
                'Time-based animations using the Svelte Motion useTime reactive store. Creates smooth, continuously updating animations driven by elapsed time.'
            seo.ogTitle = 'useTime'
            seo.ogTagline = 'Time-based animations using the Svelte Motion useTime reactive store'
            seo.ogFeatures = [
                'Elapsed Time',
                'Frame Updates',
                'Continuous Motion',
                'Reactive Store'
            ]
            seo.ogSlug = 'examples-use-time'
        }
    })
</script>

<Example title="useTime" sourceUrl={data.sourceUrl}>
    <UseTimeExample />
</Example>
