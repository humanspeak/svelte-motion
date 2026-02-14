<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import StyleStringExample from '$lib/examples/StyleStringExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'styleString' }
            ]
        }
        if (seo) {
            seo.title = 'styleString | Examples | Svelte Motion'
            seo.description =
                'Reactive style strings with automatic unit handling via the Svelte Motion styleString utility. Simplifies dynamic inline styles in components.'
        }
    })
</script>

<Example title="styleString">
    <StyleStringExample />
</Example>
