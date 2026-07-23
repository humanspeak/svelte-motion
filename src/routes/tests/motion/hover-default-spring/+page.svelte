<script lang="ts">
    import { motion } from '$lib'
</script>

<!-- No MotionConfig wrapper and no transition prop: default transitions apply.
     Upstream framer-motion resolves per-value defaults for composed hover
     channels — scale gets a critically-damped spring (stiffness 550,
     damping 30, ~7% overshoot) and y an under-damped spring. A default tween
     would never overshoot the target, so the overshoot is the spring signature.
     The second element plays a 3-keyframe scale array, whose 1.8 waypoint the
     collapse-to-final behavior never reaches. -->
<motion.div
    whileHover={{ scale: 1.5, y: -8 }}
    style="width: 100px; height: 100px; background-color: #247768; border-radius: 5px;"
    data-testid="motion-hover-default-spring"
/>

<motion.div
    whileHover={{ scale: [1, 1.8, 1.2] }}
    style="width: 100px; height: 100px; margin-top: 40px; background-color: #7c3aed; border-radius: 5px;"
    data-testid="motion-hover-keyframe-waypoint"
/>
