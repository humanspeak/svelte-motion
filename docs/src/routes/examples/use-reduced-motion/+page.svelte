<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import UseReducedMotionExample from '$lib/examples/UseReducedMotionExample.svelte'

    const { data } = $props()
    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    if (breadcrumbs) {
        breadcrumbs.breadcrumbs = [
            { title: 'Examples', href: '/examples' },
            { title: 'useReducedMotion' }
        ]
    }
    if (seo) {
        seo.title = 'useReducedMotion | Examples | Svelte Motion'
        seo.description =
            "Honor the user's prefers-reduced-motion accessibility setting with Svelte Motion useReducedMotion. A reactive store that updates live when the OS preference changes."
        seo.ogTitle = 'useReducedMotion'
        seo.ogTagline = "Honor the user's reduced-motion preference"
        seo.ogFeatures = ['Accessibility', 'Reactive Store', 'Live Updates', 'SSR Safe']
        seo.ogSlug = 'examples-use-reduced-motion'
    }
</script>

<Example title="useReducedMotion" sourceUrl={data.sourceUrl}>
    <UseReducedMotionExample />
</Example>
