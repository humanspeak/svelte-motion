<!--
  Left sidebar navigation component
  Hierarchical structure with FontAwesome icons and proper styling
-->
<script lang="ts">
    const { currentPath } = $props()

    // Navigation structure matching Motion.dev with FontAwesome icons
    const navigation = [
        {
            title: 'Get started',
            items: [{ title: 'Get started', href: '/docs', icon: 'fa-solid fa-play' }]
        },
        {
            title: 'Love and Respect',
            items: [
                { title: 'Beye.ai', href: 'https://beye.ai', icon: 'fa-solid fa-heart' },
                { title: 'ShadCN', href: 'https://shadcn-svelte.com', icon: 'fa-solid fa-heart' }
            ]
        },
        {
            title: 'Other Projects',
            items: [
                {
                    title: 'Markdown',
                    href: 'https://markdown.svelte.page',
                    icon: 'fa-solid fa-heart'
                },
                { title: 'Table', href: 'https://table.svelte.page', icon: 'fa-solid fa-heart' }
            ]
        }
        // {
        //     title: 'Get started',
        //     items: [
        //         { title: 'Get started', href: '/docs', icon: 'fa-solid fa-play' },
        //         { title: 'Examples', href: '/docs/examples', icon: 'fa-solid fa-book-open' },
        //         { title: 'Tutorials', href: '/docs/tutorials', icon: 'fa-solid fa-graduation-cap' }
        //     ]
        // },
        // {
        //     title: 'Animation',
        //     items: [
        //         { title: 'Overview', href: '/docs/animation', icon: 'fa-solid fa-bolt' },
        //         { title: 'Layout', href: '/docs/animation/layout' },
        //         { title: 'Scroll', href: '/docs/animation/scroll' },
        //         { title: 'SVG', href: '/docs/animation/svg' },
        //         { title: 'Transitions', href: '/docs/animation/transitions' }
        //     ]
        // },
        // {
        //     title: 'Gestures',
        //     items: [
        //         { title: 'Overview', href: '/docs/gestures', icon: 'fa-solid fa-hand-pointer' },
        //         { title: 'Hover', href: '/docs/gestures/hover' },
        //         { title: 'Drag', href: '/docs/gestures/drag' }
        //     ]
        // },
        // {
        //     title: 'Components',
        //     items: [
        //         {
        //             title: 'Motion component',
        //             href: '/docs/components/motion',
        //             icon: 'fa-solid fa-layer-group'
        //         },
        //         { title: 'AnimatePresence', href: '/docs/components/animate-presence' },
        //         { title: 'LayoutGroup', href: '/docs/components/layout-group' },
        //         { title: 'MotionConfig', href: '/docs/components/motion-config' }
        //     ]
        // },
        // {
        //     title: 'Guides',
        //     items: [
        //         {
        //             title: 'Installation',
        //             href: '/docs/guides/installation',
        //             icon: 'fa-solid fa-gear'
        //         },
        //         {
        //             title: 'Accessibility',
        //             href: '/docs/guides/accessibility',
        //             icon: 'fa-solid fa-universal-access'
        //         },
        //         { title: 'Styling', href: '/docs/guides/styling', icon: 'fa-solid fa-palette' }
        //     ]
        // }
    ]

    /**
     * @param {string} href
     * @returns {boolean}
     */
    function isActive(href: string) {
        return currentPath === href || (href !== '/docs' && currentPath.startsWith(href))
    }
</script>

<nav class="p-6">
    <div class="space-y-8">
        {#each navigation as section (section.title)}
            <div>
                <h3 class="mb-3 text-sm font-semibold tracking-wide text-text-primary uppercase">
                    {section.title}
                </h3>
                <ul class="space-y-1">
                    {#each section.items as item (item.href)}
                        <li>
                            <a
                                href={item.href}
                                class="group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150
						     	{isActive(item.href)
                                    ? 'bg-sidebar-active text-sidebar-active-foreground'
                                    : 'text-sidebar-foreground hover:bg-muted hover:text-text-primary'}"
                            >
                                {#if item.icon}
                                    <i
                                        class="{item.icon} mr-3 text-sm {isActive(item.href)
                                            ? 'text-sidebar-active-foreground'
                                            : 'text-text-muted group-hover:text-text-secondary'}"
                                    ></i>
                                {:else}
                                    <i class="fa-solid fa-arrow-right mr-3 text-xs text-text-muted"
                                    ></i>
                                {/if}
                                {item.title}
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>
</nav>
