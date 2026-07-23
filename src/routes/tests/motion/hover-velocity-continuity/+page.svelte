<script lang="ts">
    import { motion } from '$lib'
</script>

<!-- No explicit transition: upstream spring defaults apply (scale → spring
     stiffness 550, damping 30). Hover drives scale toward 1.5 with a high
     mid-flight velocity. A press that interrupts the spring mid-flight must
     re-target toward 0.9 WHILE CARRYING that velocity — so the scale keeps
     climbing for a frame or two (momentum) before it reverses toward 0.9
     (overshoot-then-reverse). Re-seeding a fresh animation with zero velocity
     would reverse immediately, which is the regression this page exercises. -->
<motion.div
    whileHover={{ scale: 1.5 }}
    whileTap={{ scale: 0.9 }}
    style="width: 120px; height: 120px; background-color: #247768; border-radius: 8px;"
    data-testid="motion-hover-velocity-continuity"
/>
