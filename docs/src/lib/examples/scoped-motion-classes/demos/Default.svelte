<script lang="ts">
    import { motion, useTime, useTransform } from '@humanspeak/svelte-motion'

    const time = useTime()
    const y = useTransform(time, (latest) => Math.sin(latest / 280) * -10)
    const scale = useTransform(time, (latest) => 1 + Math.sin(latest / 280) * 0.04)
    const rotate = useTransform(time, (latest) => Math.sin(latest / 360) * -1.5)
</script>

<article class="demo-shell">
    <p class="eyebrow">scoped CSS</p>
    <h2 class="headline">Native heading keeps the style.</h2>
    <motion.h2 scoped:class="headline" style={{ y, scale, rotate }}>
        Motion heading keeps it too.
    </motion.h2>
</article>

<style>
    .demo-shell {
        display: flex;
        min-height: 18rem;
        flex-direction: column;
        justify-content: center;
        gap: 0.85rem;
        width: 100%;
        padding: 1rem;
        border: 1px solid hsl(var(--border));
        background:
            linear-gradient(
                135deg,
                color-mix(in oklab, hsl(var(--accent)) 12%, transparent),
                transparent 42%
            ),
            hsl(var(--background));
    }

    .eyebrow {
        margin: 0;
        color: hsl(var(--muted-foreground));
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0;
        text-transform: uppercase;
    }

    .headline {
        width: fit-content;
        max-width: 100%;
        margin: 0;
        padding: 0.45rem 0.65rem;
        border: 2px solid hsl(var(--primary));
        background: color-mix(in oklab, hsl(var(--primary)) 12%, hsl(var(--background)));
        color: hsl(var(--foreground));
        font-size: clamp(1.2rem, 1.1rem + 0.8vw, 2rem);
        font-weight: 800;
        line-height: 1.1;
        text-wrap: balance;
    }
</style>
