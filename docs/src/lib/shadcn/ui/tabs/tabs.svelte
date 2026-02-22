<!--
  @component
  Animated shadcn Tabs root component powered by svelte-motion.

  Drop-in replacement for standard shadcn tabs with a spring-based sliding
  indicator (via layoutId) that animates between triggers. Wraps bits-ui
  Tabs primitives for full ARIA compliance.

  Set `animated={false}` to disable motion and get vanilla shadcn behavior.
-->
<script lang="ts" module>
    /** Module-level counter to generate unique layoutIds per tab group. */
    let instanceCounter = 0

    /** Symbol key for the tabs context. */
    export const TABS_CTX = Symbol('animated-tabs')

    /** Context shape propagated to child components. */
    export type TabsContext = {
        animated: boolean
        layoutId: string
        value: () => string
    }
</script>

<script lang="ts">
    import { cn, type WithoutChildrenOrChild } from '$lib/shadcn/utils'
    import { Tabs as TabsPrimitive, type TabsRootProps as BitsTabsRootProps } from 'bits-ui'
    import { setContext } from 'svelte'

    export type TabsProps = WithoutChildrenOrChild<BitsTabsRootProps> & {
        /** Set to false to disable motion animations (vanilla shadcn behavior). */
        animated?: boolean
    }

    let {
        class: className,
        value = $bindable(''),
        onValueChange,
        animated = true,
        ref = $bindable(null),
        children,
        ...restProps
    }: TabsProps & { children?: import('svelte').Snippet } = $props()

    // eslint-disable-next-line no-useless-assignment -- counter is read on next instance mount
    const layoutId = `animated-tabs-${instanceCounter++}`

    setContext<TabsContext>(TABS_CTX, {
        animated,
        layoutId,
        get value() {
            return () => value
        }
    })
</script>

<TabsPrimitive.Root bind:ref bind:value {onValueChange} class={cn(className)} {...restProps}>
    {@render children?.()}
</TabsPrimitive.Root>
