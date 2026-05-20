<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import VariantsWhileHoverExample from '$lib/examples/VariantsWhileHoverExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'whileHover variant keys' }
        ]
    }
    if (seo) {
        seo.title =
            'whileHover variant keys — reuse variants across gestures | Examples | Svelte Motion'
        seo.description =
            'Pass a variant key (or array) to whileHover, whileTap, whileFocus, whileDrag, or whileInView to reuse named animation states across gestures.'
        seo.ogTitle = 'whileHover variant keys'
        seo.ogTagline = 'Reuse named variants across gesture props'
        seo.ogFeatures = ['Variants', 'whileHover', 'whileTap', 'String keys']
        seo.ogSlug = 'examples-variants-while-hover'
    }
</script>

<Example
    title="whileX variant keys — reuse variants across gestures"
    file="VariantsWhileHoverExample.svelte"
>
    <VariantsWhileHoverExample />
</Example>
