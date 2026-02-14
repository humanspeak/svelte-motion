<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import MotionPath from '$lib/examples/MotionPath.svelte'

    let { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Motion Path' }
            ]
        }
        if (seo) {
            seo.title = 'Motion Path | Examples | Svelte Motion'
            seo.description =
                'Animate elements along an SVG path with offset distance using Svelte Motion. Create complex motion trajectories with minimal configuration.'
        }
    })
</script>

<Example title="Motion Path" motionUrl={data.sourceUrl ?? undefined}>
    <MotionPath />
</Example>
