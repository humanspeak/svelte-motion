<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'
    import { getSeoContext } from '$lib/components/contexts/Seo/Seo.context'
    import Example from '$lib/components/general/Example.svelte'
    import VariantsBasicExample from '$lib/examples/VariantsBasicExample.svelte'

    const breadcrumbs = getBreadcrumbContext()
    const seo = getSeoContext()
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [
                { title: 'Examples', href: '/examples' },
                { title: 'Variants Basic' }
            ]
        }
        if (seo) {
            seo.title = 'Variants Basic | Examples | Svelte Motion'
            seo.description =
                'Define and switch between named animation states with Svelte Motion variants. Create reusable, declarative animation presets for components.'
        }
    })
</script>

<Example title="Variants Basic">
    <VariantsBasicExample />
</Example>
