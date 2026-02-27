<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import Rotate from '$lib/examples/Rotate.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Rotate' }
            ]
        }
        if (seo) {
            seo.title = 'Rotate | Examples | Svelte Motion'
            seo.description =
                'Continuous rotation animation with configurable easing built with Svelte Motion. A simple example demonstrating infinite transform animations.'
            seo.ogTitle = 'Rotate'
            seo.ogTagline =
                'Continuous rotation animation with configurable easing built with Svelte Motion'
            seo.ogFeatures = ['Infinite Loop', 'Transform', 'Configurable Easing', 'Simple API']
            seo.ogSlug = 'examples-rotate'
        }
    })
</script>

<Example title="Rotate" sourceUrl={data.sourceUrl}>
    <Rotate />
</Example>
