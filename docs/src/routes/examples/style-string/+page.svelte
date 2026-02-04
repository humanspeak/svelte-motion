<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import StyleStringExample from '$lib/examples/StyleStringExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'styleString' }
            ]
        }
    })
</script>

<svelte:head>
    <title>styleString | Examples | Svelte Motion</title>
</svelte:head>

<Example>
    <StyleStringExample />
</Example>
