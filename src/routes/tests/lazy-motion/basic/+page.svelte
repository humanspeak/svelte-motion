<script lang="ts">
    import { LazyMotion, domAnimation, m } from '$lib'
</script>

<main class="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-8">
    <h1 class="text-2xl font-semibold">LazyMotion basic</h1>

    <LazyMotion features={domAnimation}>
        <m.div
            data-testid="lazy-motion-basic-box"
            class="grid size-32 place-items-center rounded-xl bg-cyan-300 font-semibold text-slate-950 shadow-lg"
            initial={{ opacity: 0, y: 32, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
        >
            m.div
        </m.div>
    </LazyMotion>
</main>
