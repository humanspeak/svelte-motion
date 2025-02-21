<script lang="ts">
    import { motion } from '$lib/index.js'
</script>

<div class="container">
    <main id="sandbox">
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
                duration: 0.4,
                scale: { type: 'spring', visualDuration: 0.4, bounce: 0.5 }
            }}
            style="width: 100px; height: 100px; background-color: red; border-radius: 50%;"
        />
    </main>
</div>

<style>
    :global(html, body) {
        height: 100vh;
        margin: 0;
        padding: 0;
        overflow: hidden;
    }

    #sandbox {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        width: 100%;
    }

    .container {
        height: 100vh;
        width: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>
