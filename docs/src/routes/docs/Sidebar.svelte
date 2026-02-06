<!--
  Left sidebar navigation component
  Hierarchical structure with FontAwesome icons and proper styling
-->
<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    import { onMount } from 'svelte'

    const { currentPath } = $props()

    type NavItem = {
        title: string
        href: string
        icon: string
        external?: boolean
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
            title: 'Components',
            items: [
                {
                    title: 'AnimatePresence',
                    href: '/docs/animate-presence',
                    icon: 'fa-solid fa-ghost'
                }
            ]
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
            items: [
                {
                    title: 'Beye.ai',
                    href: 'https://beye.ai',
                    icon: 'fa-solid fa-heart',
                    external: true
                },
                {
                    title: 'Emil',
                    href: 'https://animations.dev/',
                    icon: 'fa-solid fa-compass-drafting',
                    external: true
                }
            ]
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
                        <motion.li
                            whileHover={{ x: 4 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        >
                            <a
                                href={item.href}
                                target={item.external ? '_blank' : undefined}
                                rel={item.external ? 'noopener' : undefined}
                                class="group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150
						     	{isActive(item.href)
                                    ? 'bg-sidebar-active text-sidebar-active-foreground'
                                    : 'text-sidebar-foreground hover:bg-muted hover:text-text-primary'}"
                            >
                                {#if item.icon}
                                    <motion.span
                                        class="mr-3 inline-flex"
                                        whileHover={{ scale: 1.25 }}
                                        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                                    >
                                        <i
                                            class="{item.icon} fa-fw text-sm {isActive(item.href)
                                                ? 'text-sidebar-active-foreground'
                                                : 'text-text-muted group-hover:text-text-secondary'}"
                                        ></i>
                                    </motion.span>
                                {:else}
                                    <i class="fa-solid fa-arrow-right mr-3 text-xs text-text-muted"
                                    ></i>
                                {/if}
                                {item.title}
                                {#if item.external}
                                    <i
                                        class="fa-solid fa-arrow-up-right-from-square ml-2 text-xs opacity-50"
                                    ></i>
                                {/if}
                            </a>
                        </motion.li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>
</nav>
