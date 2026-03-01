<script lang="ts">
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'

    const BASE_URL = 'https://motion.svelte.page'

    const breadcrumbs = getBreadcrumbContext()

    const jsonLd = $derived.by(() => {
        const items = breadcrumbs?.breadcrumbs ?? []
        if (items.length === 0) return ''
        const listItems = [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE_URL}/` },
            ...items.map((b, i) => ({
                '@type': 'ListItem',
                position: i + 2,
                name: b.title,
                ...(b.href ? { item: `${BASE_URL}${b.href}` } : {})
            }))
        ]
        return `<${'script'} type="application/ld+json">${JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: listItems
        })}</${'script'}>`
    })
</script>

<svelte:head>
    {#if jsonLd}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- static JSON-LD, no user input -->
        {@html jsonLd}
    {/if}
</svelte:head>
