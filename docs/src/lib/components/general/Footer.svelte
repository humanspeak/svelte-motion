<script lang="ts">
    import { motion } from '@humanspeak/svelte-motion'
    import * as m from '$msgs'
</script>

<footer
    class="flex items-center justify-center border-t border-border bg-background py-4 text-sm text-foreground"
>
    <div class="mx-auto flex max-w-7xl gap-1 px-4 text-center">
        {m.footer_made_with()}
        <motion.span
            aria-label={m.footer_love()}
            animate={{
                scale: [1, 1.2, 1, 1.1, 1]
            }}
            transition={{
                duration: 1.2,
                repeat: Infinity,
                repeatDelay: 0.8,
                ease: 'easeInOut'
            }}
            style="transform-origin: center center;"
            class="inline-block origin-center align-middle leading-none"
        >
            ❤️
        </motion.span>
        {m.footer_by()}
        <a
            href="https://humanspeak.com"
            target="_blank"
            class="text-brand-500 hover:text-brand-600 hover:underline"
        >
            Humanspeak
        </a>
        ・ {m.footer_inspired_by()}
        <a
            href="https://motion.dev/"
            target="_blank"
            class="text-brand-500 hover:text-brand-600 hover:underline"
        >
            Motion.dev
        </a>
    </div>
</footer>
