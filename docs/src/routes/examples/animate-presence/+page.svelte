<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import AnimatePresenceExample from '$lib/examples/AnimatePresenceExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'AnimatePresence' }
            ]
        }
        if (seo) {
            seo.title = 'AnimatePresence | Examples | Svelte Motion'
            seo.description =
                'Animate components when they are added to or removed from the DOM using Svelte Motion. Smooth enter and exit transitions made easy.'
        }
    })
</script>

<Example title="AnimatePresence">
    <AnimatePresenceExample />
</Example>
