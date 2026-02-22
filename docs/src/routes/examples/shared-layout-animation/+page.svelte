<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import SharedLayoutAnimationExample from '$lib/examples/SharedLayoutAnimationExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Shared Layout Animation' }
            ]
        }
        if (seo) {
            seo.title = 'Shared Layout Animation | Examples | Svelte Motion'
            seo.description =
                'Animate elements between positions using layoutId for smooth shared layout transitions in Svelte Motion.'
        }
    })
</script>

<Example title="Shared Layout Animation" motionUrl={data.sourceUrl ?? undefined}>
    <SharedLayoutAnimationExample />
</Example>
