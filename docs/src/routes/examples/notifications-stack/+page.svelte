<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import NotificationsStackExample from '$lib/examples/NotificationsStackExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Notifications Stack' }
            ]
        }
        if (seo) {
            seo.title = 'Notifications Stack | Examples | Svelte Motion'
            seo.description =
                'iOS-style notification stack with variant-based stagger animations built with Svelte Motion. Smooth enter, exit, and reorder transitions.'
        }
    })
</script>

<Example title="Notifications Stack">
    <NotificationsStackExample />
</Example>
