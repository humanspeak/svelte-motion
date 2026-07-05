<script lang="ts">
    import { motion } from '$lib'
</script>

<!--
    Tap-only target (no whileHover) used to validate that delegating the tap
    press/release to motion-dom's per-value spring defaults does NOT reintroduce
    the historical "velocity accumulation" runaway during rapid press/release.
-->
<motion.button
    whileTap={{ scale: 0.9 }}
    data-testid="motion-rapid-tap"
    style="width: 120px; height: 120px; background-color: #22aa66; border: none; border-radius: 12px; cursor: pointer;"
>
    tap
</motion.button>
