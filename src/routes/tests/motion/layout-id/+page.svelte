<script lang="ts">
    import { AnimatePresence, motion } from '$lib'

    /**
     * Type definition for tab items
     */
    type TabItem = {
        icon: string
        label: string
    }

    /**
     * Available ingredient options
     */
    const allIngredients: TabItem[] = [
        { icon: '🍅', label: 'Tomato' },
        { icon: '🥬', label: 'Lettuce' },
        { icon: '🧀', label: 'Cheese' },
        { icon: '🥕', label: 'Carrot' },
        { icon: '🍌', label: 'Banana' },
        { icon: '🫐', label: 'Blueberries' },
        { icon: '🥂', label: 'Champers?' }
    ]

    const [tomato, lettuce, cheese] = allIngredients
    const tabs = [tomato, lettuce, cheese]

    let selectedTab = $state<TabItem>(tabs[0])

    /**
     * Handle tab selection
     * @param {TabItem} item - The selected tab item
     */
    function selectTab(item: TabItem) {
        selectedTab = item
    }
</script>

<div
    class="flex h-[60vh] max-h-[360px] w-[480px] flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl"
>
    <nav class="h-11 rounded-t-[10px] border-b border-gray-200 bg-[#fdfdfd] px-1.5 pt-1.5 pb-0">
        <ul class="flex w-full list-none p-0 text-sm font-medium">
            {#each tabs as item (item.label)}
                <motion.li
                    initial={false}
                    animate={{
                        backgroundColor: item === selectedTab ? '#eee' : '#eee0'
                    }}
                    transition={{ duration: 0.2 }}
                    class="relative flex h-6 min-w-0 flex-1 cursor-pointer items-center justify-between rounded-t-[5px] bg-white px-[15px] py-2.5 text-[#0f1115] select-none"
                    onclick={() => selectTab(item)}
                >
                    {`${item.icon} ${item.label}`}
                    {#if item === selectedTab}
                        <motion.div
                            layout="position"
                            initial={false}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            class="absolute right-0 -bottom-0.5 left-0 h-0.5 bg-blue-500"
                        />
                    {/if}
                </motion.li>
            {/each}
        </ul>
    </nav>
    <main class="flex flex-1 items-center justify-center">
        <AnimatePresence>
            {#key selectedTab.label}
                <motion.div
                    key={selectedTab.label}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -10, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    class="text-[128px]"
                >
                    {selectedTab ? selectedTab.icon : '😋'}
                </motion.div>
            {/key}
        </AnimatePresence>
    </main>
</div>
