<script lang="ts">
    import { MotionConfig, motion } from '$lib'
</script>

<!-- Regression page for plan 004 (per-key gesture ownership).

     whileHover owns `opacity`; whileTap owns `scale` — DISJOINT keys. Upstream
     framer-motion resolves gestures per-key (animation-state.ts protectedKeys),
     so a tap that only animates `scale` must never block hover's `opacity`:

     1. Hovering while pressed still applies opacity (tap doesn't own it).
     2. Hover ending mid-press must restore opacity to base even though the tap
        release only knows about `scale` — otherwise opacity stays stuck. -->
<MotionConfig transition={{ duration: 0.3 }}>
    <motion.div
        whileHover={{ opacity: 0.5 }}
        whileTap={{ scale: 0.9 }}
        style="width: 100px; height: 100px; background: #247768; opacity: 1;"
        data-testid="motion-disjoint-keys"
    />
</MotionConfig>
