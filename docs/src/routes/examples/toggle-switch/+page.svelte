<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import ToggleSwitchExample from '$lib/examples/ToggleSwitchExample.svelte'

    let { data } = $props()
    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Toggle Switch' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Toggle Switch | Examples | Svelte Motion</title>
</svelte:head>

<Example motionUrl={data.sourceUrl ?? undefined}>
    <ToggleSwitchExample />
</Example>
