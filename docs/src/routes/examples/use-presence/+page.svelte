<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UsePresenceExample from '$lib/examples/UsePresenceExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'usePresence' }
        ]
    }
    if (seo) {
        seo.title = 'usePresence | Examples | Svelte Motion'
        seo.description =
            'Custom exit animations from inside the child. PresenceChild holds the component rendered until your safeToRemove() fires.'
        seo.ogTitle = 'usePresence'
        seo.ogTagline = 'Custom exit animations from the child'
        seo.ogFeatures = ['Custom Exit', 'PresenceChild', 'safeToRemove', 'AnimatePresence']
        seo.ogSlug = 'examples-use-presence'
    }
</script>

<Example title="usePresence" sourceUrl={data.sourceUrl}>
    <UsePresenceExample />
</Example>
