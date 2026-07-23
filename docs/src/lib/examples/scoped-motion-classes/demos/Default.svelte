<script lang="ts">
    import { motion, useTime, useTransform } from '@humanspeak/svelte-motion'

    const time = useTime()
    const y = useTransform(time, (latest) => Math.sin(latest / 280) * -10)
    const scale = useTransform(time, (latest) => 1 + Math.sin(latest / 280) * 0.04)
    const rotate = useTransform(time, (latest) => Math.sin(latest / 360) * -1.5)
</script>

<article class="demo-shell">
    <div class="strip-head">
        <span class="micro">// scoped:class</span>
        <span class="micro status">selector: .headline</span>
    </div>
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
        padding: 1.25rem;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background:
            linear-gradient(
                135deg,
                var(--brut-accent-soft, rgba(36, 119, 104, 0.1)),
                transparent 42%
            ),
            var(--brut-bg, #f8fcfb);
    }

    .strip-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .status {
        color: var(--brut-accent, #247768);
    }

    .eyebrow {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        color: var(--brut-ink-3, #9a9a9a);
        font-size: 0.6875rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    /* `.headline` is a plain component-scoped selector. It styles the native
       <h2> directly, and `scoped:class="headline"` on the motion.h2 keeps this
       component's scope on the rendered element so the same selector applies. */
    .headline {
        width: fit-content;
        max-width: 100%;
        margin: 0;
        padding: 0.45rem 0.65rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
        box-shadow: 4px 4px 0 var(--brut-rule, #d6dedb);
        color: var(--brut-ink, #0a0a0a);
        font-size: clamp(1.2rem, 1.1rem + 0.8vw, 2rem);
        font-weight: 800;
        line-height: 1.1;
        text-wrap: balance;
    }
</style>
