<script>
    import { LazyMotion, domMax, m, motion } from '@humanspeak/svelte-motion'

    const loadFeatures = () => Promise.resolve(domMax)
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
<div data-kind="m-async">
    <LazyMotion features={loadFeatures}>
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
<div data-kind="m-path">
    <svg width="100" height="10">
        <m.path
            data-testid="path"
            d="M0 0 L100 0"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
        />
    </svg>
</div>
<div data-kind="motion-path">
    <svg width="100" height="10">
        <motion.path
            data-testid="path"
            d="M0 0 L100 0"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
        />
    </svg>
</div>
