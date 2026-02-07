<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import WhileFocusExample from '$lib/examples/WhileFocusExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'While Focus' }
            ]
        }
    })
</script>

<svelte:head>
    <title>While Focus | Examples | Svelte Motion</title>
</svelte:head>

<Example title="While Focus" motionUrl={data.sourceUrl ?? undefined}>
    <WhileFocusExample />
</Example>
