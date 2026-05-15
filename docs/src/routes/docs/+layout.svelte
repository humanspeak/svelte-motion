<script lang="ts">
    import { page } from '$app/state'
    import { afterNavigate } from '$app/navigation'
    import {
        HeaderV2,
        FooterV2,
        SidebarV2,
        TableOfContentsV2,
        DocSlugStrip,
        getBreadcrumbContext,
        enhanceCodeBlocks,
        extractHeadings,
        type TocHeading
    } from '@humanspeak/docs-kit'
    import { docsConfig } from '$lib/docs-config'
    import favicon from '$lib/assets/logo.svg'
    import { docsSections, motionLoveAndRespect } from '$lib/docsNav'
    import sitemapManifest from '$lib/sitemap-manifest.json'
    import rootPkg from '../../../../package.json'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'

    const BASE_URL = 'https://motion.svelte.page'
    const PKG_VERSION = rootPkg.version

    const { children, data } = $props()

    /** Pretty slug for the brut strip — "/docs" → "index", "/docs/use-spring" → "use-spring". */
    const docSlug = $derived.by(() => {
        const path = page.url.pathname.replace(/\/+$/, '')
        if (path === '/docs' || path === '') return 'index'
        return path.replace('/docs/', '')
    })

    let contentElement: HTMLElement | undefined = $state(undefined)
    let headings: TocHeading[] = $state([])

    // Breadcrumb context. Top-level assignment populates the context during
    // SSR (so HeaderV2 and BreadcrumbJsonLd see the crumbs in the server
    // HTML). The $effect catches client-side navigation between sibling
    // docs pages where the layout doesn't remount.
    const breadcrumbs = getBreadcrumbContext()
    if (breadcrumbs) {
        const initialTitle = (page.data?.title as string | undefined) || 'Get Started'
        breadcrumbs.breadcrumbs = [{ title: 'Docs', href: '/docs' }, { title: initialTitle }]
    }
    $effect(() => {
        if (!breadcrumbs) return
        const pageTitle = (page.data?.title as string | undefined) || 'Get Started'
        breadcrumbs.breadcrumbs = [{ title: 'Docs', href: '/docs' }, { title: pageTitle }]
    })

    const techArticleJsonLd = $derived.by(() => {
        const title = page.data?.title as string | undefined
        const description = page.data?.description as string | undefined
        if (!title) return ''
        const pathname = page.url.pathname
        const lastmod =
            (sitemapManifest as Record<string, string>)[pathname] ??
            new Date().toISOString().split('T')[0]
        return `<${'script'} type="application/ld+json">${JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: title,
            description: description || title,
            url: `${BASE_URL}${pathname}`,
            dateModified: lastmod,
            author: {
                '@type': 'Organization',
                name: 'Humanspeak',
                url: 'https://humanspeak.com'
            },
            publisher: {
                '@type': 'Organization',
                name: 'Humanspeak',
                url: 'https://humanspeak.com'
            },
            proficiencyLevel: 'Beginner'
        })}</${'script'}>`
    })

    // FAQPage JSON-LD — emitted only on the /docs root so the four canonical
    // disambiguation Qs ride the highest-authority doc URL. Per SEO.md P2:
    // FAQ rich results lift CTR 15–30% at typical positions; LLMs preferentially
    // cite Q&A-structured content for "which library should I use" prompts.
    const faqJsonLd = $derived.by(() => {
        if (page.url.pathname !== '/docs') return ''
        const faqs: { q: string; a: string }[] = [
            {
                q: 'Is @humanspeak/svelte-motion the same as the legacy svelte-motion package on npm?',
                a: 'No. The legacy svelte-motion package on npm is a separate, unmaintained project. @humanspeak/svelte-motion is an actively maintained library built for Svelte 5 with runes, and is API-compatible with the React framer-motion API.'
            },
            {
                q: 'Does Svelte Motion work in Svelte 4?',
                a: 'No. Svelte Motion requires Svelte 5 because it relies on runes ($state, $derived, $effect) and Svelte 5’s component model. For Svelte 4 projects, the svelte/transition and svelte/animate built-ins are the closest in-tree options.'
            },
            {
                q: 'How does Svelte Motion compare to GSAP, Motion One, and svelte/transition?',
                a: 'Svelte Motion is the only Svelte 5 library that matches Framer Motion’s declarative API: motion.<tag> components, AnimatePresence exit animations, gestures (hover, tap, drag, focus, in-view), variants, FLIP layout and shared layout, spring physics, and scroll-linked motion values. GSAP and Motion One (motion.dev) are imperative and framework-agnostic — powerful, but you build the declarative layer yourself. svelte/transition is built-in and great for simple enter/exit, but has no gestures, no layout animation, and no shared layout.'
            },
            {
                q: 'Is the API really compatible with React Framer Motion?',
                a: 'Yes for component code. Prop names and semantics match Framer Motion: initial, animate, exit, transition, variants, whileHover, whileTap, whileFocus, whileInView, drag (with dragConstraints / dragElastic / dragMomentum), layout, layoutId, and AnimatePresence with mode="sync" | "wait" | "popLayout". Hooks (useAnimate, useScroll, useSpring, useTransform, useMotionValue, useInView, useCycle, useReducedMotion, etc.) keep their names and behaviour, adapted for Svelte 5 runes.'
            }
        ]
        return `<${'script'} type="application/ld+json">${JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(({ q, a }) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: a }
            }))
        })}</${'script'}>`
    })

    // Headings extraction. The MutationObserver from earlier versions fired
    // on every motion animation inside the prose subtree (any style/class
    // change bubbled through `childList: true, subtree: true`), running a
    // full querySelectorAll + slugger pass per frame. afterNavigate + the
    // initial $effect cover every real re-extraction case (route change
    // swaps the entire content tree).
    const refreshHeadings = () => {
        if (contentElement) headings = extractHeadings(contentElement)
    }

    $effect(() => {
        if (contentElement) refreshHeadings()
    })

    afterNavigate(() => {
        requestAnimationFrame(refreshHeadings)
    })
</script>

<svelte:head>
    {#if techArticleJsonLd}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- static JSON-LD, no user input -->
        {@html techArticleJsonLd}
    {/if}
    {#if faqJsonLd}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- static JSON-LD, no user input -->
        {@html faqJsonLd}
    {/if}
</svelte:head>

<div class="flex min-h-screen flex-col justify-between bg-background">
    <HeaderV2
        config={docsConfig}
        {favicon}
        version={PKG_VERSION}
        nav={[
            { label: 'docs', href: '/docs' },
            { label: 'examples', href: '/examples' },
            { label: 'compare', href: '/compare' }
        ]}
    />

    <DocSlugStrip slug={docSlug} />

    <div class="flex flex-1">
        <!-- Left sidebar - Navigation -->
        <aside
            class="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar-background/95 shadow-sm lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto"
        >
            <SidebarV2
                config={docsConfig}
                sections={docsSections}
                currentPath={page.url.pathname}
                otherProjects={data.otherProjects}
                loveAndRespect={motionLoveAndRespect}
            />
        </aside>

        <!-- Main content area -->
        <main class="min-w-0 flex-1">
            <div class="flex min-w-0">
                <!-- Content -->
                <article
                    bind:this={contentElement}
                    use:enhanceCodeBlocks
                    class="min-w-0 flex-1 px-4 py-8 sm:px-6 lg:px-8"
                >
                    <div
                        class="prose-v2 prose max-w-none text-text-primary prose-slate dark:prose-invert prose-headings:scroll-mt-20"
                    >
                        {@render children()}
                    </div>
                </article>

                <!-- Right sidebar - Table of Contents -->
                <aside
                    class="hidden w-56 shrink-0 border-l border-sidebar-border bg-sidebar-background/95 shadow-sm xl:sticky xl:top-0 xl:block xl:h-screen xl:overflow-y-auto"
                >
                    <TableOfContentsV2 {headings} />
                </aside>
            </div>
        </main>
    </div>
    <FooterV2 version={PKG_VERSION} />
</div>
