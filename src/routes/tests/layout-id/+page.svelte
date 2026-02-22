<script lang="ts">
    import { AnimatePresence, motion } from '$lib'

    let selectedTab = $state(0)

    const tabs = [
        { label: 'Tab 0', id: 0 },
        { label: 'Tab 1', id: 1 },
        { label: 'Tab 2', id: 2 }
    ]
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center gap-8 p-8">
    <h1 class="text-2xl font-bold">layoutId Test</h1>

    <div data-active-tab={selectedTab} class="flex gap-1" data-testid="tabs">
        {#each tabs as tab (tab.id)}
            <button
                data-testid="tab-{tab.id}"
                class="relative px-6 py-2"
                onclick={() => (selectedTab = tab.id)}
            >
                {tab.label}
                <AnimatePresence>
                    {#if selectedTab === tab.id}
                        <motion.div
                            key="underline"
                            layoutId="underline"
                            data-testid="underline"
                            style="position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: royalblue; border-radius: 2px;"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                    {/if}
                </AnimatePresence>
            </button>
        {/each}
    </div>
</div>
