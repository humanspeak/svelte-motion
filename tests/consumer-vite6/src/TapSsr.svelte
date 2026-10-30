<script>
    import { motion } from '@humanspeak/svelte-motion'

    const noop = () => {}
</script>

<motion.div data-testid="on-tap" onTap={noop} />
<motion.div data-testid="on-tap-start" onTapStart={noop} />
<motion.div data-testid="on-tap-cancel" onTapCancel={noop} />
<motion.div data-testid="tap-label" whileTap="missing" />
<motion.button data-testid="tap-button" whileTap={{ scale: 0.9 }} />
