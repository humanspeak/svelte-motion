<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import ToggleSwitchExample from '$lib/examples/ToggleSwitchExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
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
        }
    })
</script>

<Example title="Toggle Switch" motionUrl={data.sourceUrl ?? undefined}>
    <ToggleSwitchExample />
</Example>
