<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import VariantsBasicExample from '$lib/examples/VariantsBasicExample.svelte'

    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Variants Basic' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Variants Basic | Examples | Svelte Motion</title>
</svelte:head>

<Example>
    <VariantsBasicExample />
</Example>
