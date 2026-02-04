<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import AnimatedButton from '$lib/examples/AnimatedButton.svelte'

    // Placeholder canvas; hook up live example later.
    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Animated Button' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Animated Button | Examples | Svelte Motion</title>
</svelte:head>

<Example>
    <AnimatedButton />
</Example>
