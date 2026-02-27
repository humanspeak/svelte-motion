<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import AnimatedButton from '$lib/examples/AnimatedButton.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Animated Button' }
            ]
        }
        if (seo) {
            seo.title = 'Animated Button | Examples | Svelte Motion'
            seo.description =
                'Build a spring-based animated button with Svelte Motion featuring press feedback, hover lift, and smooth transitions for interactive UIs.'
            seo.ogTitle = 'Animated Button'
            seo.ogTagline = 'Build a spring-based animated button with Svelte Motion'
            seo.ogFeatures = ['Spring Press', 'Hover Lift', 'Smooth Transitions', 'Interactive UI']
            seo.ogSlug = 'examples-animated-button'
        }
    })
</script>

<Example title="Animated Button">
    <AnimatedButton />
</Example>
