<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import ConicGradientExample from '$lib/examples/ConicGradientExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Conic Gradient' }
            ]
        }
        if (seo) {
            seo.title = 'Conic Gradient | Examples | Svelte Motion'
            seo.description =
                'Pointer-tracking conic gradient example using Svelte Motion useTransform and writable stores.'
        }
    })
</script>

<Example title="Conic Gradient" motionUrl={data.sourceUrl ?? undefined}>
    <ConicGradientExample />
</Example>
