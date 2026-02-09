<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'

    let bounds: HTMLElement | null = null
</script>

<div class="flex flex-col items-center gap-4">
    <p class="text-sm text-text-muted">Constrained to the dashed area</p>
    <div
        bind:this={bounds}
        class="relative grid size-56 place-items-center rounded-xl border-2 border-dashed border-border-mid"
    >
        <motion.div
            drag
            dragConstraints={bounds}
            whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
            class="size-16 cursor-grab rounded-lg bg-amber-400"
        />
    </div>
</div>
