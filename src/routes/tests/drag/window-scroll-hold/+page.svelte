<script lang="ts">
    import { motion } from '$lib'
</script>

<!--
    Window scroll while a drag is held still (spike 006 acceptance test).

    Mirrors upstream motion `dev/html/public/playwright/gestures/drag-scroll.html?window=true`
    (v14.5.0): a 100x100 draggable at (50, 50) in a tall document. Scrolling the
    window while the pointer is held still must keep the element under the
    pointer, as PanSession's window-scroll compensation does upstream.
-->
<div style="height: 2000px; padding: 50px 0 0 50px; margin: 0; background: #f0f0f0">
    <motion.div
        drag="y"
        dragMomentum={false}
        data-testid="draggable"
        style="width: 100px; height: 100px; background: #ff0066; border-radius: 10px"
    />
</div>
