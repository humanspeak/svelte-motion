<!--
  @component
  Animated shadcn Tabs content panel.

  Wraps bits-ui Tabs.Content. When animated, uses the child render prop
  to keep the panel element always in the DOM (never `hidden`). Inactive
  panels use `display:none` so they collapse. The active panel's children
  are wrapped in a motion.div that replays a fade+slide entrance on each
  tab switch — the panel container (and any styling on it) stays stable.
-->
<script lang="ts">
    import { cn, type WithoutChildrenOrChild } from '$lib/shadcn/utils'
    import { motion } from '@humanspeak/svelte-motion'
    import { Tabs as TabsPrimitive, type TabsContentProps as BitsTabsContentProps } from 'bits-ui'
    import { getContext } from 'svelte'
    import { TABS_CTX, type TabsContext } from './tabs.svelte'

    export type TabsContentProps = WithoutChildrenOrChild<BitsTabsContentProps> & {
        /** Override animation for this panel. Inherits from Root when unset. */
        animated?: boolean
        /** Override the content entrance initial state. Default: `{ opacity: 0, y: 8 }` */
        initial?: Record<string, unknown>
        /** Override the content entrance animate target. Default: `{ opacity: 1, y: 0 }` */
        animate?: Record<string, unknown>
        /** Override the content entrance transition. Default: `{ duration: 0.3, ease: 'easeOut' }` */
        transition?: Record<string, unknown>
    }

    let {
        class: className,
        value,
        animated,
        initial,
        animate,
        transition,
        ref = $bindable(null),
        children,
        ...restProps
    }: TabsContentProps & { children?: import('svelte').Snippet } = $props()

    const ctx = getContext<TabsContext>(TABS_CTX)
    const isActive = $derived(ctx.value() === value)
    const isAnimated = $derived(animated ?? ctx.animated)

    const defaultInitial = { opacity: 0, y: 8 }
    const defaultAnimate = { opacity: 1, y: 0 }
    const defaultTransition = { duration: 0.3, ease: 'easeOut' }
</script>

{#if isAnimated}
    <TabsPrimitive.Content bind:ref {value} {...restProps}>
        {#snippet child({ props: panelProps })}
            <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -- hidden must be stripped so the panel stays in the DOM -->
            {@const { hidden: _hidden, style: panelStyle, ...safeProps } = panelProps}
            <div
                {...safeProps}
                class={cn(
                    'focus-visible:ring-ring mt-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    className
                )}
                style="{panelStyle ?? ''}{isActive ? '' : ';display:none'}"
            >
                {#key ctx.value()}
                    <motion.div
                        initial={initial ?? defaultInitial}
                        animate={animate ?? defaultAnimate}
                        transition={transition ?? defaultTransition}
                    >
                        {@render children?.()}
                    </motion.div>
                {/key}
            </div>
        {/snippet}
    </TabsPrimitive.Content>
{:else}
    <TabsPrimitive.Content
        bind:ref
        {value}
        class={cn(
            'focus-visible:ring-ring mt-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
            className
        )}
        {...restProps}
    >
        {@render children?.()}
    </TabsPrimitive.Content>
{/if}
