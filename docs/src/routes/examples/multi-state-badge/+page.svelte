<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import MultiStateBadgeExample from '$lib/examples/MultiStateBadgeExample.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Multi-State Badge' }
            ]
        }
        if (seo) {
            seo.title = 'Multi-State Badge | Examples | Svelte Motion'
            seo.description =
                'A badge component that cycles through idle, processing, success, and error states with smooth animated transitions in Svelte Motion.'
        }
    })
</script>

<Example title="Multi-State Badge" motionUrl={data.sourceUrl ?? undefined}>
    <MultiStateBadgeExample />
</Example>
