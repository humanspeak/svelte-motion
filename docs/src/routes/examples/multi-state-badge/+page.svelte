<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import MultiStateBadgeExample from '$lib/examples/MultiStateBadgeExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Multi-State Badge' }
        ]
    }
    if (seo) {
        seo.title = 'Multi-State Badge | Examples | Svelte Motion'
        seo.description =
            'A badge component that cycles through idle, processing, success, and error states with smooth animated transitions in Svelte Motion.'
        seo.ogTitle = 'Multi-State Badge'
        seo.ogTagline =
            'A badge component that cycles through idle, processing, success, and error states'
        seo.ogFeatures = [
            'State Machine',
            'Smooth Transitions',
            'Multiple States',
            'AnimatePresence'
        ]
        seo.ogSlug = 'examples-multi-state-badge'
    }
</script>

<Example title="Multi-State Badge" sourceUrl={data.sourceUrl ?? undefined}>
    <MultiStateBadgeExample />
</Example>
