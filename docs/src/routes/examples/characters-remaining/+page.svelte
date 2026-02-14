<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import CharactersRemainingExample from '$lib/examples/CharactersRemainingExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Characters Remaining' }
            ]
        }
        if (seo) {
            seo.title = 'Characters Remaining | Examples | Svelte Motion'
            seo.description =
                'Character counter with spring-based bounce animation and color-mapped feedback built with Svelte Motion for smooth, reactive UI updates.'
        }
    })
</script>

<Example
    title="Characters Remaining"
    motionUrl="https://examples.motion.dev/react/characters-remaining"
>
    <CharactersRemainingExample />
</Example>
