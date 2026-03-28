<!--
  @component
  Animated shadcn Tabs trigger component.

  When `animated=true` (from context), renders a spring-based sliding
  indicator via svelte-motion layoutId. Falls back to standard CSS
  background swap when `animated=false`.
-->
<script lang="ts">
    import { cn, type WithoutChildrenOrChild } from '$lib/shadcn/utils'
    import { AnimatePresence, MotionDiv } from '@humanspeak/svelte-motion'
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
        'relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4',
        !isAnimated &&
            'text-foreground data-[state=active]:bg-background data-[state=active]:shadow-sm dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground',
        className
    )}
    {...restProps}
>
    {#if isAnimated}
        <AnimatePresence>
            {#if isActive}
                <MotionDiv
                    key="indicator"
                    layoutId={ctx.layoutId}
                    class="absolute inset-0 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30"
                    transition={transition ?? defaultTransition}
                />
            {/if}
        </AnimatePresence>
        <span
            class="relative z-10 inline-flex items-center gap-1.5"
            class:text-foreground={isActive}
        >
            {@render children?.()}
        </span>
    {:else}
        {@render children?.()}
    {/if}
</TabsPrimitive.Trigger>
