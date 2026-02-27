<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import AnimatedTabsExample from '$lib/examples/AnimatedTabsExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Animated Tabs' }
            ]
        }
        if (seo) {
            seo.title = 'Animated Tabs | Examples | Svelte Motion'
            seo.description =
                'Spring-based animated tabs with a sliding indicator powered by svelte-motion layoutId and bits-ui.'
            seo.ogTitle = 'Animated Tabs'
            seo.ogTagline =
                'Spring-based animated tabs with a sliding indicator powered by svelte-motion layoutId'
            seo.ogFeatures = ['layoutId', 'Sliding Indicator', 'Spring Physics', 'bits-ui']
        }
    })
</script>

<Example title="Animated Tabs">
    <AnimatedTabsExample />
</Example>
