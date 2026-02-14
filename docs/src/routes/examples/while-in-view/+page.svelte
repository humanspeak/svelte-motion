<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import WhileInViewExample from '$lib/examples/WhileInViewExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'While In View' }
            ]
        }
        if (seo) {
            seo.title = 'While In View | Examples | Svelte Motion'
            seo.description =
                'Animate elements when they enter or leave the viewport using Svelte Motion whileInView. Create scroll-triggered reveal and exit animations.'
        }
    })
</script>

<Example title="While In View" motionUrl={data.sourceUrl ?? undefined}>
    <WhileInViewExample />
</Example>
