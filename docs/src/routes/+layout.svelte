<script lang="ts">
    import '../app.css'
    import { MotionConfig, motion } from '@humanspeak/svelte-motion'
    import favicon from '$lib/assets/logo.svg'
    import * as m from '$lib/paraglide/messages/_index.js'
    import { resolve } from '$app/paths'

    let { children } = $props()
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

<MotionConfig transition={{ duration: 0.5 }}>
    <div class="flex min-h-svh flex-col">
        <!-- Header with links -->
        <header class="flex items-center justify-between px-6 py-4 text-foreground">
            <a
                href={resolve('/')}
                aria-label={m.nav_home()}
                class="inline-flex items-center justify-center"
            >
                <motion.img
                    src={favicon}
                    alt="logo"
                    class="h-6 w-6 rounded-md transition-transform hover:scale-110 active:scale-95"
                    whileTap={{ scale: 0.9 }}
                />
            </a>
            <div class="flex items-center gap-4">
                <a
                    href="https://github.com/humanspeak/svelte-motion"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center hover:text-white"
                    aria-label={m.nav_github()}
                >
                    <motion.div
                        class="inline-flex size-6 items-center justify-center rounded-full border border-border-weak transition-transform hover:scale-110 hover:border-border-mid active:scale-95"
                        whileTap={{ scale: 0.9 }}
                    >
                        <i class="fa-brands fa-github fa-sm"></i>
                    </motion.div>
                </a>
                <a
                    href="https://www.npmjs.com/package/@humanspeak/svelte-motion"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center justify-center hover:text-white"
                    aria-label={m.nav_npm()}
                >
                    <motion.div
                        class="inline-flex size-6 items-center justify-center rounded-full border border-border-weak transition-transform hover:scale-110 hover:border-border-mid active:scale-95"
                        whileTap={{ scale: 0.9 }}
                    >
                        <i class="fa-brands fa-npm fa-sm"></i>
                    </motion.div>
                </a>
            </div>
        </header>

        <div class="flex flex-1 flex-col">
            {@render children?.()}
        </div>
        <footer class="border-t border-white/10 py-6 text-center text-sm text-white/60">
            {m.footer_made_with()} <span aria-label={m.footer_love()}>❤️</span>
            {m.footer_by()}
            <a
                href="https://humanspeak.com"
                target="_blank"
                rel="noopener noreferrer"
                class="text-brand-500 hover:underline"
            >
                Humanspeak
            </a>
            ・ {m.footer_inspired_by()}
            <a
                href="https://motion.dev/"
                target="_blank"
                rel="noopener noreferrer"
                class="text-brand-500 hover:underline"
            >
                Motion.dev
            </a>
        </footer>
    </div>
</MotionConfig>
