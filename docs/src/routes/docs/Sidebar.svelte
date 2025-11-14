<!--
  Left sidebar navigation component
  Hierarchical structure with FontAwesome icons and proper styling
-->
<script lang="ts">
    import { onMount } from 'svelte'

    const { currentPath } = $props()

    type NavItem = {
        title: string
        href: string
        icon: string
    }

    type OtherProject = {
        url: string
        slug: string
        shortDescription: string
    }

    let otherProjects: NavItem[] = $state([])

    // Navigation structure matching Motion.dev with FontAwesome icons
    let navigation = $derived([
        {
            title: 'Get started',
            items: [{ title: 'Get started', href: '/docs', icon: 'fa-solid fa-play' }]
        },
        {
            title: 'Animation',
            items: [
                {
                    title: 'Variants',
                    href: '/docs/variants',
                    icon: 'fa-solid fa-layer-group'
                }
            ]
        },
        {
            title: 'Hooks',
            items: [
                {
                    title: 'useAnimationFrame',
                    href: '/docs/use-animation-frame',
                    icon: 'fa-solid fa-clock'
                },
                {
                    title: 'useTransform',
                    href: '/docs/use-transform',
                    icon: 'fa-solid fa-sliders'
                },
                {
                    title: 'useTime',
                    href: '/docs/use-time',
                    icon: 'fa-solid fa-stopwatch'
                }
            ]
        },
        {
            title: 'Love and Respect',
            items: [{ title: 'Beye.ai', href: 'https://beye.ai', icon: 'fa-solid fa-heart' }]
        },
        ...(otherProjects.length > 0
            ? [
                  {
                      title: 'Other Projects',
                      items: otherProjects
                  }
              ]
            : [])
    ])

    onMount(async () => {
        try {
            const response = await fetch('/api/other-projects')
            if (!response.ok) {
                return
            }
            const projects: OtherProject[] = await response.json()

            // Convert to nav items format
            otherProjects = projects.map((project) => ({
                title: formatTitle(project.slug),
                href: project.url,
                icon: 'fa-solid fa-heart'
            }))
        } catch (error) {
            console.error('Failed to load other projects:', error)
        }
    })

    function formatTitle(slug: string): string {
        return `/${slug.toLowerCase()}`
    }

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
