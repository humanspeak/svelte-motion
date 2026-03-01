<!--
  Left sidebar navigation component
  Hierarchical structure with Lucide icons, collapsible sections, and proper styling
-->
<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    import { slide } from 'svelte/transition'
    import { PersistedState } from 'runed'
    import type { Component } from 'svelte'
    import {
        Play,
        Ghost,
        Layers,
        Move,
        Hand,
        Signal,
        Code,
        Zap,
        ArrowUpDown,
        Activity,
        Timer,
        SlidersHorizontal,
        Gauge,
        Clock,
        Wand,
        MousePointer,
        Columns2,
        Heart,
        Compass,
        Box,
        ChevronDown,
        ArrowRight,
        ExternalLink
    } from '@lucide/svelte'

    const iconMap: Record<string, Component> = {
        play: Play,
        ghost: Ghost,
        layers: Layers,
        move: Move,
        hand: Hand,
        signal: Signal,
        code: Code,
        zap: Zap,
        'arrow-up-down': ArrowUpDown,
        activity: Activity,
        timer: Timer,
        'sliders-horizontal': SlidersHorizontal,
        gauge: Gauge,
        clock: Clock,
        wand: Wand,
        'mouse-pointer': MousePointer,
        columns2: Columns2,
        heart: Heart,
        compass: Compass,
        box: Box
    }

    type NavItem = {
        title: string
        href: string
        icon: string
        external?: boolean
    }

    type NavSection = {
        title: string
        icon: string
        items: NavItem[]
    }

    type OtherProject = {
        url: string
        slug: string
        shortDescription: string
    }

    const {
        currentPath,
        otherProjects: otherProjectsRaw = []
    }: { currentPath: string; otherProjects: OtherProject[] } = $props()

    const formatTitle = (slug: string): string => slug.toLowerCase()

    const otherProjectItems: NavItem[] = $derived(
        otherProjectsRaw.map((project) => ({
            title: formatTitle(project.slug),
            href: project.url,
            icon: 'heart',
            external: true
        }))
    )
    const openSections = new PersistedState<Record<string, boolean>>('sidebar-sections', {})

    const navigation: NavSection[] = $derived([
        {
            title: 'Get started',
            icon: 'play',
            items: [{ title: 'Get started', href: '/docs', icon: 'play' }]
        },
        {
            title: 'Components',
            icon: 'ghost',
            items: [
                {
                    title: 'AnimatePresence',
                    href: '/docs/animate-presence',
                    icon: 'ghost'
                }
            ]
        },
        {
            title: 'Animation',
            icon: 'layers',
            items: [
                {
                    title: 'Layout Animations',
                    href: '/docs/layout-animations',
                    icon: 'move'
                },
                {
                    title: 'Variants',
                    href: '/docs/variants',
                    icon: 'layers'
                }
            ]
        },
        {
            title: 'Gestures',
            icon: 'hand',
            items: [
                {
                    title: 'Drag',
                    href: '/docs/drag',
                    icon: 'hand'
                }
            ]
        },
        {
            title: 'Motion values',
            icon: 'signal',
            items: [
                {
                    title: 'Overview',
                    href: '/docs/motion-values',
                    icon: 'signal'
                },
                {
                    title: 'useMotionTemplate',
                    href: '/docs/use-motion-template',
                    icon: 'code'
                },
                {
                    title: 'useMotionValueEvent',
                    href: '/docs/use-motion-value-event',
                    icon: 'zap'
                },
                {
                    title: 'useScroll',
                    href: '/docs/use-scroll',
                    icon: 'arrow-up-down'
                },
                {
                    title: 'useSpring',
                    href: '/docs/use-spring',
                    icon: 'activity'
                },
                {
                    title: 'useTime',
                    href: '/docs/use-time',
                    icon: 'timer'
                },
                {
                    title: 'useTransform',
                    href: '/docs/use-transform',
                    icon: 'sliders-horizontal'
                },
                {
                    title: 'useVelocity',
                    href: '/docs/use-velocity',
                    icon: 'gauge'
                }
            ]
        },
        {
            title: 'Hooks',
            icon: 'clock',
            items: [
                {
                    title: 'useAnimationFrame',
                    href: '/docs/use-animation-frame',
                    icon: 'clock'
                }
            ]
        },
        {
            title: 'Utilities',
            icon: 'wand',
            items: [
                {
                    title: 'styleString',
                    href: '/docs/style-string',
                    icon: 'wand'
                }
            ]
        },
        {
            title: 'shadcn/ui',
            icon: 'mouse-pointer',
            items: [
                {
                    title: 'Button',
                    href: '/docs/shadcn-button',
                    icon: 'mouse-pointer'
                },
                {
                    title: 'Tabs',
                    href: '/docs/shadcn-tabs',
                    icon: 'columns2'
                }
            ]
        },
        {
            title: 'Love and Respect',
            icon: 'heart',
            items: [
                {
                    title: 'Beye.ai',
                    href: 'https://beye.ai',
                    icon: 'heart',
                    external: true
                },
                {
                    title: 'Emil',
                    href: 'https://animations.dev/',
                    icon: 'compass',
                    external: true
                },
                {
                    title: 'shadcn-svelte',
                    href: 'https://www.shadcn-svelte.com',
                    icon: 'box',
                    external: true
                }
            ]
        },
        ...(otherProjectItems.length > 0
            ? [
                  {
                      title: 'Other Projects',
                      icon: 'box',
                      items: otherProjectItems
                  }
              ]
            : [])
    ])

    const isSectionOpen = (section: NavSection): boolean => {
        if (section.title in openSections.current) return openSections.current[section.title]
        return true
    }

    const toggleSection = (section: NavSection) => {
        openSections.current = {
            ...openSections.current,
            [section.title]: !isSectionOpen(section)
        }
    }

    const isActive = (href: string) => {
        const basePath = currentPath.split(/[?#]/)[0]
        if (href === '/docs') {
            return (
                basePath === href ||
                currentPath.startsWith(`${href}?`) ||
                currentPath.startsWith(`${href}#`)
            )
        }
        return (
            basePath === href ||
            currentPath.startsWith(`${href}?`) ||
            currentPath.startsWith(`${href}#`) ||
            basePath.startsWith(`${href}/`)
        )
    }
</script>

<nav class="p-2">
    <div class="space-y-2">
        {#each navigation as section (section.title)}
            <div>
                <button
                    onclick={() => toggleSection(section)}
                    class="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm font-semibold tracking-wide text-text-primary uppercase transition-colors duration-150 hover:bg-muted"
                >
                    <span class="flex items-center gap-2 text-left">
                        <motion.span
                            class="inline-flex shrink-0"
                            whileHover={{ scale: 1.25 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                        >
                            <svelte:component
                                this={iconMap[section.icon]}
                                size={14}
                                class="text-muted-foreground"
                            />
                        </motion.span>
                        {section.title}
                    </span>
                    <ChevronDown
                        size={12}
                        class="shrink-0 text-muted-foreground transition-transform duration-200 {isSectionOpen(
                            section
                        )
                            ? 'rotate-180'
                            : ''}"
                    />
                </button>
                {#if isSectionOpen(section)}
                    <ul
                        class="mt-1 ml-3 space-y-1 border-l border-border pl-1"
                        transition:slide={{ duration: 200 }}
                    >
                        {#each section.items as item (item.href)}
                            <motion.li
                                whileHover={{ x: 2 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            >
                                <a
                                    href={item.href}
                                    target={item?.external ? '_blank' : undefined}
                                    rel={item?.external ? 'noopener' : undefined}
                                    class="group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150
                                     {isActive(item.href)
                                        ? 'bg-sidebar-active text-sidebar-active-foreground'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                                >
                                    {#if item.icon && iconMap[item.icon]}
                                        <motion.span
                                            class="mr-3 inline-flex"
                                            whileHover={{ scale: 1.25 }}
                                            transition={{
                                                type: 'spring',
                                                stiffness: 500,
                                                damping: 15
                                            }}
                                        >
                                            <svelte:component
                                                this={iconMap[item.icon]}
                                                size={14}
                                                class={isActive(item.href)
                                                    ? 'text-sidebar-active-foreground'
                                                    : 'text-muted-foreground group-hover:text-foreground'}
                                            />
                                        </motion.span>
                                    {:else}
                                        <ArrowRight size={12} class="mr-3 text-muted-foreground" />
                                    {/if}
                                    {item.title}
                                    {#if item?.external}
                                        <ExternalLink size={12} class="ml-2 opacity-50" />
                                    {/if}
                                </a>
                            </motion.li>
                        {/each}
                    </ul>
                {/if}
            </div>
        {/each}
    </div>
</nav>
