<script lang="ts">
    import { motion } from '$lib'
</script>

<main class="min-h-screen bg-slate-950 px-6 py-12 text-white">
    <section class="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1fr_1.2fr] md:items-center">
        <div>
            <p class="text-sm font-medium uppercase tracking-wide text-cyan-300">
                Optimized appear
            </p>
            <h1 class="mt-3 text-3xl font-semibold">SSR handoff without the cold-start flash</h1>
            <p class="mt-4 text-sm leading-6 text-slate-300">
                This page renders an initial state in SSR, starts an appear animation from inline
                server HTML, then hydrates into the normal motion runtime.
            </p>
        </div>

        <motion.div
            data-testid="optimized-appear-card"
            class="rounded-lg border border-cyan-300/30 bg-cyan-300/10 p-8 shadow-2xl shadow-cyan-950/50"
            initial={{ opacity: 0, y: 28, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
            <div class="h-2 w-24 rounded-full bg-cyan-300"></div>
            <h2 class="mt-6 text-xl font-semibold">Compositor-first entry</h2>
            <p class="mt-3 text-sm leading-6 text-slate-200">
                The browser starts opacity and transform before Svelte Motion takes ownership.
            </p>
        </motion.div>
    </section>
</main>
