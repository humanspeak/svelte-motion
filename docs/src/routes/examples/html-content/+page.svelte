<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import HTMLContent from '$lib/examples/HTMLContent.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'HTML Content' }
            ]
        }
        if (seo) {
            seo.title = 'HTML Content | Examples | Svelte Motion'
            seo.description =
                'Animate HTML content with smooth enter and exit transitions using Svelte Motion. Demonstrates AnimatePresence with dynamic HTML elements.'
        }
    })
</script>

<Example title="HTML Content" motionUrl={data.sourceUrl}>
    <HTMLContent />
</Example>
