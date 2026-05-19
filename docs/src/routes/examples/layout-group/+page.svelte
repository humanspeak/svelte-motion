<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import LayoutGroupExample from '$lib/examples/LayoutGroupExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'LayoutGroup' }
        ]
    }
    if (seo) {
        seo.title = 'LayoutGroup — scope shared-layout animations | Examples | Svelte Motion'
        seo.description =
            'Wrap regions in <LayoutGroup id> to keep identical layoutId values in sibling subtrees from cross-animating. Side-by-side tab strips demo.'
        seo.ogTitle = 'LayoutGroup'
        seo.ogTagline = 'Scope shared-layout animations to a subtree'
        seo.ogFeatures = ['Shared layout', 'LayoutGroup', 'layoutId scoping', 'Tab strips']
        seo.ogSlug = 'examples-layout-group'
    }
</script>

<Example title="LayoutGroup — scope shared-layout animations" file="LayoutGroupExample.svelte">
    <LayoutGroupExample />
</Example>
