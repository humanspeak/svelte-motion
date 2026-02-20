<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import WhileFocusExample from '$lib/examples/WhileFocusExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'While Focus' }
            ]
        }
        if (seo) {
            seo.title = 'While Focus | Examples | Svelte Motion'
            seo.description =
                'Animate elements when they receive keyboard focus using Svelte Motion whileFocus. Enhance accessibility with visual feedback on focus events.'
        }
    })
</script>

<Example title="While Focus" motionUrl={data.sourceUrl ?? undefined}>
    <WhileFocusExample />
</Example>
