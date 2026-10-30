<script lang="ts">
    import { m, motion } from '$lib'
</script>

<!-- A `motion` child under a bare (featureless) `m` parent. -->
<m.div data-testid="parent" variants={{ on: { opacity: 1 } }}>
    <motion.div data-testid="motion-child" variants={{ on: { opacity: 0.5 } }} />
</m.div>
