<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import VariantsPropagationExample from '$lib/examples/VariantsPropagationExample.svelte'

    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Variants Propagation' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Variants Propagation | Examples | Svelte Motion</title>
</svelte:head>

<Example>
    <VariantsPropagationExample />
</Example>
