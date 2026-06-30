<!--
  @component
  Animated shadcn Tabs list component.

  Wraps bits-ui Tabs.List for ARIA-compliant keyboard navigation
  (arrow keys, Home/End, roving tabindex). Exposes shadcn's `default`
  (filled pill bar) and `line` (underline) list styles via the
  `tabsListVariants` / `variant` API.
-->
<script lang="ts" module>
    import { tv, type VariantProps } from 'tailwind-variants'

    /** Symbol key for the list-level context (propagates the active `variant`). */
    export const TABS_LIST_CTX = Symbol('animated-tabs-list')

    /** Context shape exposed by the list to its triggers. */
    export type TabsListContext = {
        variant: () => TabsListVariant
    }

    /**
     * shadcn Tabs list style variants. Orientation hooks are keyed off the
     * root's `data-orientation` (emitted by bits-ui) so they resolve in this
     * fork; `data-variant` drives the per-trigger `line`/`default` chrome.
     */
    export const tabsListVariants = tv({
        base: 'group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center rounded-lg p-[3px] group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none',
        variants: {
            variant: {
                default: 'bg-muted',
                line: 'gap-1 bg-transparent'
            }
        },
        defaultVariants: {
            variant: 'default'
        }
    })

    export type TabsListVariant = VariantProps<typeof tabsListVariants>['variant']
</script>

<script lang="ts">
    import { cn, type WithoutChildrenOrChild } from '$lib/shadcn/utils'
    import { Tabs as TabsPrimitive, type TabsListProps as BitsTabsListProps } from 'bits-ui'
    import { setContext } from 'svelte'

    export type TabsListProps = WithoutChildrenOrChild<BitsTabsListProps> & {
        /** shadcn list style. `default` is the filled pill bar; `line` is underline tabs. */
        variant?: TabsListVariant
    }

    let {
        class: className,
        variant = 'default',
        ref = $bindable(null),
        children,
        ...restProps
    }: TabsListProps & { children?: import('svelte').Snippet } = $props()

    setContext<TabsListContext>(TABS_LIST_CTX, {
        variant: () => variant
    })
</script>

<TabsPrimitive.List
    bind:ref
    data-slot="tabs-list"
    data-variant={variant}
    class={cn(tabsListVariants({ variant }), className)}
    {...restProps}
>
    {@render children?.()}
</TabsPrimitive.List>
