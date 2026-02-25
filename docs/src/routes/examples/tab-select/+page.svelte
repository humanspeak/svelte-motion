<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import TabSelectExample from '$lib/examples/TabSelectExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Tab Select' }
            ]
        }
        if (seo) {
            seo.title = 'Tab Select | Examples | Svelte Motion'
            seo.description =
                'Animated tab selector using layoutId for a shared indicator that slides between tabs in Svelte Motion.'
        }
    })
</script>

<Example title="Tab Select" sourceUrl={data.sourceUrl ?? undefined}>
    <TabSelectExample />
</Example>
