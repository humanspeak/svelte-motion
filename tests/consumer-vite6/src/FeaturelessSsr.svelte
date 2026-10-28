<script>
    import { LazyMotion, domMax, m, motion } from '@humanspeak/svelte-motion'
</script>

<div data-kind="m-bare">
    <m.div
        data-testid="box"
        style="width: 10px"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileTap={{ scale: 0.9 }}
        drag="x"
        variants={{ on: { opacity: 1 } }}
    />
</div>
<div data-kind="m-lazy">
    <LazyMotion features={domMax}>
        <m.div
            data-testid="box"
            style="width: 10px"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileTap={{ scale: 0.9 }}
            drag="x"
            variants={{ on: { opacity: 1 } }}
        />
    </LazyMotion>
</div>
<div data-kind="motion">
    <motion.div
        data-testid="box"
        style="width: 10px"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        whileTap={{ scale: 0.9 }}
        drag="x"
        variants={{ on: { opacity: 1 } }}
    />
</div>
