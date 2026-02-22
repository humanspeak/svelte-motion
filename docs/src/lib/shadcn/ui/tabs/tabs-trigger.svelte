<!--
  @component
  Animated shadcn Tabs trigger component.

  When `animated=true` (from context), renders a spring-based sliding
  indicator via svelte-motion layoutId. Falls back to standard CSS
  background swap when `animated=false`.
-->
<script lang="ts">
    import { cn, type WithoutChildrenOrChild } from '$lib/shadcn/utils'
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
    import { Tabs as TabsPrimitive, type TabsTriggerProps as BitsTabsTriggerProps } from 'bits-ui'
    import { getContext } from 'svelte'
    import { TABS_CTX, type TabsContext } from './tabs.svelte'

    export type TabsTriggerProps = WithoutChildrenOrChild<BitsTabsTriggerProps> & {
        /** Override animation for this trigger. Inherits from Root when unset. */
        animated?: boolean
        /** Override the indicator spring transition. Default: `{ type: 'spring', stiffness: 500, damping: 30 }` */
        transition?: Record<string, unknown>
    }

    let {
        class: className,
        value,
        animated,
        transition,
        ref = $bindable(null),
        children,
        ...restProps
    }: TabsTriggerProps & { children?: import('svelte').Snippet } = $props()

    const ctx = getContext<TabsContext>(TABS_CTX)
    const isActive = $derived(ctx.value() === value)
    const isAnimated = $derived(animated ?? ctx.animated)

    const defaultTransition = { type: 'spring' as const, stiffness: 500, damping: 30 }
</script>

<TabsPrimitive.Trigger
    bind:ref
    {value}
    class={cn(
        'focus-visible:ring-ring relative inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium whitespace-nowrap ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
        !isAnimated &&
            'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className
    )}
    {...restProps}
>
    {#if isAnimated}
        <AnimatePresence>
            {#if isActive}
                <motion.div
                    key="indicator"
                    layoutId={ctx.layoutId}
                    class="absolute inset-0 rounded-md bg-background shadow-sm"
                    transition={transition ?? defaultTransition}
                />
            {/if}
        </AnimatePresence>
        <span class="relative z-10" class:text-foreground={isActive}>
            {@render children?.()}
        </span>
    {:else}
        {@render children?.()}
    {/if}
</TabsPrimitive.Trigger>
