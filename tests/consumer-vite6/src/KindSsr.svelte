<script>
    import { m, motion } from '@humanspeak/svelte-motion'
</script>

<div data-kind="motion">
    <motion.div
        class="box"
        style="color: red"
        initial={{ opacity: 0 }}
        whileTap={{ scale: 0.9 }}
        drag="x"
    />
</div>
<div data-kind="m">
    <m.div
        class="box"
        style="color: red"
        initial={{ opacity: 0 }}
        whileTap={{ scale: 0.9 }}
        drag="x"
    />
</div>
