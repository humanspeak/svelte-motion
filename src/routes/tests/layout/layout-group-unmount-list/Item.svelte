<script lang="ts">
    import { LayoutGroup, motion } from '$lib'

    const { id, backgroundColor }: { id: string; backgroundColor: string } = $props()

    let visible = $state(true)
</script>

<LayoutGroup id="group-2">
    <motion.div style="display: contents;">
        {#if visible}
            <motion.div
                {id}
                layoutId={id}
                style="width: 100px; height: 100px; opacity: 1; border-radius: 20px; margin: 20px; background-color: {backgroundColor};"
                onclick={() => (visible = false)}
                transition={{ duration: 10, ease: () => 0.5 }}
            />
        {/if}
    </motion.div>
</LayoutGroup>
