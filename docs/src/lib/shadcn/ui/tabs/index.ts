import Content, { type TabsContentProps } from './tabs-content.svelte'
import List, {
    tabsListVariants,
    type TabsListProps,
    type TabsListVariant
} from './tabs-list.svelte'
import Trigger, { type TabsTriggerProps } from './tabs-trigger.svelte'
import Root, { type TabsProps } from './tabs.svelte'

export {
    Content,
    List,
    Root,
    //
    Root as Tabs,
    Content as TabsContent,
    List as TabsList,
    tabsListVariants,
    Trigger as TabsTrigger,
    Trigger,
    type TabsContentProps,
    type TabsListProps,
    type TabsListVariant,
    type TabsProps,
    type TabsTriggerProps
}
