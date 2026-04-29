<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseAnimateExample from '$lib/examples/UseAnimateExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useAnimate' }
        ]
    }
    if (seo) {
        seo.title = 'useAnimate | Examples | Svelte Motion'
        seo.description =
            'Imperative animation with a scoped CSS-selector API. Sequenced staggered list with a follow-up beat on a target button.'
        seo.ogTitle = 'useAnimate'
        seo.ogTagline = 'Imperative animation with scoped selectors'
        seo.ogFeatures = ['Imperative API', 'Scoped Selectors', 'Sequences', 'Auto Cleanup']
        seo.ogSlug = 'examples-use-animate'
    }
</script>

<Example title="useAnimate" sourceUrl={data.sourceUrl}>
    <UseAnimateExample />
</Example>
