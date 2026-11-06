<script lang="ts">
    import { motion } from '$lib'

    const noop = () => {}
</script>

<motion.button
    data-testid="btn"
    tap={{ count: 2 }}
    globalTapTarget={false}
    propagate={{ tap: true }}
    onTap={noop}>double tap</motion.button
>
