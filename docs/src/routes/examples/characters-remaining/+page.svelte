<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import Example from '$lib/components/general/Example.svelte'
    import CharactersRemainingExample from '$lib/examples/CharactersRemainingExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Characters Remaining' }
            ]
        }
    })
</script>

<svelte:head>
    <title>Characters Remaining | Examples | Svelte Motion</title>
</svelte:head>

<Example
    title="Characters Remaining"
    motionUrl="https://examples.motion.dev/react/characters-remaining"
>
    <CharactersRemainingExample />
</Example>
