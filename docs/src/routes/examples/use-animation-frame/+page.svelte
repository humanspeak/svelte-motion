<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseAnimationFrameExample from '$lib/examples/UseAnimationFrameExample.svelte'

    let { data } = $props()
    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'useAnimationFrame' }
            ]
        }
    })
</script>

<Example motionUrl={data.sourceUrl}>
    <UseAnimationFrameExample />
</Example>
