<script lang="ts">
    import { getSeoContext } from '@humanspeak/docs-kit'
    import { BlogIndexV2, loadBlogPostsMdsvex } from '@humanspeak/docs-kit/blog'

    type MdsvexModule = {
        metadata?: Record<string, unknown>
        default?: unknown
    }

    const modules = import.meta.glob('/src/routes/blog/*/+page.svx', { eager: true })
    const posts = loadBlogPostsMdsvex(modules as Record<string, MdsvexModule>)

    const seo = getSeoContext()
    if (seo) {
        seo.title = 'Blog | Svelte Motion'
        seo.description =
            'Guides and engineering notes about Svelte 5 animation, Framer Motion migration, gestures, layout transitions, springs, and production SvelteKit motion.'
        seo.ogTitle = 'Svelte Motion Blog'
        seo.ogTagline = 'Production animation patterns for Svelte 5.'
        seo.ogFeatures = ['Svelte 5', 'Motion', 'Migration Guides', 'Animation Patterns']
        seo.ogSlug = 'blog'
    }
</script>

<BlogIndexV2 {posts} />
