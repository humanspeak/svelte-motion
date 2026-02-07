<!--
  @component
  Reusable SEO component that renders meta description, Open Graph, and Twitter Card tags.

  Place in the root layout with page-specific data flowing through.
  Falls back to site-wide defaults for any missing values.
-->
<script lang="ts">
    const SITE_NAME = 'Svelte Motion'
    const DEFAULT_DESCRIPTION =
        'Svelte Motion is a Svelte animation library for building smooth, production-grade UI animations.'
    const DEFAULT_IMAGE = 'https://motion.svelte.page/og-default.png'

    type SeoProps = {
        title?: string
        description?: string
        image?: string
        type?: string
        url?: string
    }

    const { title, description, image, type = 'website' }: SeoProps = $props()

    const resolvedTitle = $derived(title ? `${title} | ${SITE_NAME}` : SITE_NAME)
    const resolvedDescription = $derived(description || DEFAULT_DESCRIPTION)
    const resolvedImage = $derived(image || DEFAULT_IMAGE)
</script>

<svelte:head>
    <meta name="description" content={resolvedDescription} />
    <meta property="og:title" content={resolvedTitle} />
    <meta property="og:description" content={resolvedDescription} />
    <meta property="og:image" content={resolvedImage} />
    <meta property="og:type" content={type} />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={resolvedTitle} />
    <meta name="twitter:description" content={resolvedDescription} />
    <meta name="twitter:image" content={resolvedImage} />
</svelte:head>
