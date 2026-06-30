<!--
  @component
  Animated shadcn Tabs trigger component.

  In the `default` list variant with `animated=true` (from context), renders a
  spring-based sliding indicator via svelte-motion `layoutId`. The `line`
  variant and `animated=false` fall back to shadcn's CSS active styling
  (background swap for `default`, underline for `line`).
-->
<script lang="ts">
    import { cn, type WithoutChildrenOrChild } from '$lib/shadcn/utils'
    import { AnimatePresence, MotionDiv } from '@humanspeak/svelte-motion'
    import { Tabs as TabsPrimitive, type TabsTriggerProps as BitsTabsTriggerProps } from 'bits-ui'
    import { getContext } from 'svelte'
    import { TABS_CTX, type TabsContext } from './tabs.svelte'
    import { TABS_LIST_CTX, type TabsListContext } from './tabs-list.svelte'

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
    const listCtx = getContext<TabsListContext>(TABS_LIST_CTX)
    const isActive = $derived(ctx.value() === value)
    const variant = $derived(listCtx?.variant() ?? 'default')
    // The sliding box indicator represents the `default` filled variant; the
    // `line` variant uses shadcn's CSS underline instead.
    const showIndicator = $derived((animated ?? ctx.animated) && variant === 'default')

    const defaultTransition = { type: 'spring' as const, stiffness: 500, damping: 30 }
</script>

<TabsPrimitive.Trigger
    bind:ref
    {value}
    data-slot="tabs-trigger"
    class={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1",
        // `line` variant chrome: transparent background + sliding underline,
        // driven purely by the list's `data-variant` group selector.
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
        'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100',
        // `default` variant CSS active styling — used whenever the motion
        // indicator is not handling the active background (line variant or
        // `animated=false`). Skipped while the indicator paints it.
        !showIndicator &&
            'group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm dark:group-data-[variant=default]/tabs-list:data-[state=active]:border-input dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30 dark:group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground',
        className
    )}
    {...restProps}
>
    {#if showIndicator}
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
