<script lang="ts">
    import { motion } from '$lib/motion'

    /**
     * Harness for plan 007 (Motion 14.7.1, #1935): one `layout` element with
     * `layoutRoot` and `layoutAnchor` props, so a spec can check both reach
     * the projection node and neither leaks onto the DOM.
     */
    let {
        layoutRoot,
        layoutAnchor
    }: { layoutRoot?: boolean; layoutAnchor?: { x: number; y: number } | false } = $props()
</script>

<motion.div id="layout-options" layout {layoutRoot} {layoutAnchor} />
