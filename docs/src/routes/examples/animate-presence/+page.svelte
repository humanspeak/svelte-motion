<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import AnimatePresenceExample from '$lib/examples/AnimatePresenceExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'AnimatePresence' }
            ]
        }
    })
</script>

<svelte:head>
    <title>AnimatePresence | Examples | Svelte Motion</title>
</svelte:head>

<Example>
    <AnimatePresenceExample />
</Example>
