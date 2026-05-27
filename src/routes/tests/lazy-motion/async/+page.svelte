<script lang="ts">
    import { LazyMotion, domAnimation, m, type FeatureBundle } from '$lib'

    const loadFeatures = async (): Promise<FeatureBundle> => {
        await new Promise((resolve) => setTimeout(resolve, 300))
        return domAnimation
    }
</script>

<main class="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-8">
    <h1 class="text-2xl font-semibold">LazyMotion async features</h1>

    <LazyMotion features={loadFeatures}>
        <m.div
            data-testid="lazy-motion-async-box"
            class="rounded-md bg-violet-300 px-5 py-3 font-semibold text-slate-950 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
        >
            Async m.div
        </m.div>
    </LazyMotion>
</main>
