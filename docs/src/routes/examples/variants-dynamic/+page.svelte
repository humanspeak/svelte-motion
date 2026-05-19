<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import VariantsDynamicExample from '$lib/examples/VariantsDynamicExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Variants Dynamic (custom)' }
        ]
    }
    if (seo) {
        seo.title = 'Variants Dynamic — custom prop | Examples | Svelte Motion'
        seo.description =
            'Per-instance variants using the custom prop and function-form factories in Svelte Motion. Staggered list reveals with index-driven delays.'
        seo.ogTitle = 'Variants Dynamic (custom)'
        seo.ogTagline = 'Per-instance variants using the custom prop and function-form factories'
        seo.ogFeatures = ['Variants', 'custom prop', 'Staggered list', 'Function-form variants']
        seo.ogSlug = 'examples-variants-dynamic'
    }
</script>

<Example title="Variants Dynamic — custom prop">
    <VariantsDynamicExample />
</Example>
