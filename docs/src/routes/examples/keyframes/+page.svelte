<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import KeyframesExample from '$lib/examples/KeyframesExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Keyframes' }
            ]
        }
        if (seo) {
            seo.title = 'Keyframes | Examples | Svelte Motion'
            seo.description =
                'Multi-property keyframe animation with scale, rotate, and borderRadius using Svelte Motion.'
        }
    })
</script>

<Example title="Keyframes" motionUrl={data.sourceUrl ?? undefined}>
    <KeyframesExample />
</Example>
