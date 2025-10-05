<script lang="ts">
    import { page } from '$app/state'
    import { afterNavigate } from '$app/navigation'
    import Header from '$lib/components/general/Header.svelte'
    import Footer from '$lib/components/general/Footer.svelte'
    import Sidebar from './Sidebar.svelte'
    import TableOfContents from './TableOfContents.svelte'
    import { getBreadcrumbContext } from '$lib/components/contexts/Breadcrumb/Breadcrumb.context'

    const { children } = $props()

    let contentElement: HTMLElement | undefined = $state(undefined)
    let headings: { id: string; text: string; level: number; element: HTMLElement }[] = $state([])

    // Create breadcrumb store and context
    const breadcrumbs = $derived(getBreadcrumbContext())
    $effect(() => {
        if (breadcrumbs) {
            breadcrumbs.breadcrumbs = [{ title: 'Docs', href: '/docs' }, { title: 'Get Started' }]
        }
    })

    /**
     * Extract headings from content for table of contents
     * Runs after navigation and DOM updates
     */
    function extractHeadings() {
        if (!contentElement) return

        const headingElements = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
        headings = Array.from(headingElements).map((el, index) => ({
            id: el.id || `heading-${index}`,
            text: el.textContent || '',
            level: parseInt(el.tagName.charAt(1)),
            element: el as HTMLElement
        }))

        // Ensure all headings have IDs
        headings.forEach((heading) => {
            if (!heading.element.id) {
                heading.element.id = heading.id
            }
        })
    }

    // Re-extract headings when navigating between pages
    afterNavigate(() => {
        // Wait for DOM to fully render after navigation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                extractHeadings()
            })
        })
    })

    // Initial extraction when contentElement is first available
    $effect(() => {
        if (contentElement) {
            // Small delay to ensure content is rendered
            const timeoutId = setTimeout(extractHeadings, 100)
            return () => clearTimeout(timeoutId)
        }
    })
</script>

<div class="flex min-h-screen flex-col justify-between bg-background">
    <Header />

    <div class="flex flex-1">
        <!-- Left sidebar - Navigation -->
        <aside
            class="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar-background/95 shadow-sm lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto"
        >
            <Sidebar currentPath={page.url.pathname} />
        </aside>

        <!-- Main content area -->
        <main class="flex-1">
            <div class="flex">
                <!-- Content -->
                <article bind:this={contentElement} class="flex-1 px-4 py-8 sm:px-6 lg:px-8">
                    <div
                        class="prose max-w-none text-text-primary prose-slate dark:prose-invert prose-headings:scroll-mt-20"
                    >
                        {@render children()}
                    </div>
                </article>

                <!-- Right sidebar - Table of Contents -->
                <aside
                    class="hidden w-56 shrink-0 border-l border-sidebar-border bg-sidebar-background/95 shadow-sm xl:sticky xl:top-0 xl:block xl:h-screen xl:overflow-y-auto"
                >
                    <TableOfContents {headings} />
                </aside>
            </div>
        </main>
    </div>
    <Footer />
</div>
