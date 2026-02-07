<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import HTMLContent from '$lib/examples/HTMLContent.svelte'

    // Placeholder canvas; hook up live example later.
    let { data } = $props()

    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'HTML Content' }
            ]
        }
    })
</script>

<svelte:head>
    <title>HTML Content | Examples | Svelte Motion</title>
</svelte:head>

<Example title="HTML Content" motionUrl={data.sourceUrl}>
    <HTMLContent />
</Example>
