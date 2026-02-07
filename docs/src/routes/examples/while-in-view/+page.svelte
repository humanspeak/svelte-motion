<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import WhileInViewExample from '$lib/examples/WhileInViewExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'While In View' }
            ]
        }
    })
</script>

<svelte:head>
    <title>While In View | Examples | Svelte Motion</title>
</svelte:head>

<Example title="While In View" motionUrl={data.sourceUrl ?? undefined}>
    <WhileInViewExample />
</Example>
