<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import FancyLikeButtonExample from '$lib/examples/FancyLikeButtonExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Fancy Like Button' }
            ]
        }
        if (seo) {
            seo.title = 'Fancy Like Button | Examples | Svelte Motion'
            seo.description =
                'Heart button with animated particle burst on press and hold using Svelte Motion.'
        }
    })
</script>

<Example title="Fancy Like Button" sourceUrl={data.sourceUrl ?? undefined}>
    <FancyLikeButtonExample />
</Example>
