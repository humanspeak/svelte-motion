<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import NotificationsStackExample from '$lib/examples/NotificationsStackExample.svelte'

    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Notifications Stack' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Notifications Stack | Examples | Examples | Svelte Motion</title>
</svelte:head>

<Example>
    <NotificationsStackExample />
</Example>
