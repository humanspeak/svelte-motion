<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import ToggleSwitchExample from '$lib/examples/ToggleSwitchExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'Toggle Switch' }
        ]
    }
    if (seo) {
        seo.title = 'Toggle Switch | Examples | Svelte Motion'
        seo.description =
            'Animated toggle switch with spring physics built using Svelte Motion. Demonstrates layout animations and gesture-driven state transitions.'
        seo.ogTitle = 'Toggle Switch'
        seo.ogTagline = 'Animated toggle switch with spring physics built using Svelte Motion'
        seo.ogFeatures = ['Layout Animation', 'Spring Physics', 'Gesture Driven', 'State Toggle']
        seo.ogSlug = 'examples-toggle-switch'
    }
</script>

<Example title="Toggle Switch" sourceUrl={data.sourceUrl ?? undefined}>
    <ToggleSwitchExample />
</Example>
