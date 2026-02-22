<!--
  @component
  Animated shadcn Tabs list component.

  Wraps bits-ui Tabs.List for ARIA-compliant keyboard navigation
  (arrow keys, Home/End, roving tabindex).
-->
<script lang="ts">
    import { cn, type WithoutChildrenOrChild } from '$lib/shadcn/utils'
    import { Tabs as TabsPrimitive, type TabsListProps as BitsTabsListProps } from 'bits-ui'

    export type TabsListProps = WithoutChildrenOrChild<BitsTabsListProps>

    let {
        class: className,
        ref = $bindable(null),
        children,
        ...restProps
    }: TabsListProps & { children?: import('svelte').Snippet } = $props()
</script>

<TabsPrimitive.List
    bind:ref
    class={cn(
        'inline-flex h-9 w-fit items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        className
    )}
    {...restProps}
>
    {@render children?.()}
</TabsPrimitive.List>
