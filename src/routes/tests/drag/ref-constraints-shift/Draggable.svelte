<script lang="ts">
    /**
     * The draggable block of the ref-constraints-shift fixture. Port of
     * upstream `drag-ref-constraints-shift.tsx`'s memoised `Draggable`: a grey
     * 300×300 constraints box holding a red 50×50 square that drags inside it.
     *
     * It takes no props, so nothing the page changes (the spacer's height)
     * re-renders it or re-measures its layout.
     */
    import { motion } from '$lib'

    let constraintsEl = $state<HTMLElement | undefined>(undefined)
</script>

<div
    data-testid="constraints"
    bind:this={constraintsEl}
    style="width: 300px; height: 300px; background: #eee"
>
    <motion.div
        data-testid="box"
        drag
        dragElastic={0}
        dragMomentum={false}
        dragConstraints={constraintsEl}
        style="width: 50px; height: 50px; background: red"
    />
</div>
