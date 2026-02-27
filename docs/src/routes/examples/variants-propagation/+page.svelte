<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import VariantsPropagationExample from '$lib/examples/VariantsPropagationExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Variants Propagation' }
            ]
        }
        if (seo) {
            seo.title = 'Variants Propagation | Examples | Svelte Motion'
            seo.description =
                'Propagate variant animations through nested component trees with Svelte Motion. Parent state changes automatically cascade to child elements.'
            seo.ogTitle = 'Variants Propagation'
            seo.ogTagline =
                'Propagate variant animations through nested component trees with Svelte Motion'
            seo.ogFeatures = [
                'Parent Cascade',
                'Nested Trees',
                'Auto Propagation',
                'Variant States'
            ]
        }
    })
</script>

<Example title="Variants Propagation">
    <VariantsPropagationExample />
</Example>
