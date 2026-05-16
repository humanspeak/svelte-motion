<script lang="ts">
    import { CompareIndexV2 } from '@humanspeak/docs-kit'
    import { competitors, ours } from '$lib/compare-data'
</script>

<CompareIndexV2
    {competitors}
    {ours}
    introHtml="Honest, side-by-side comparisons of <b>@humanspeak/svelte-motion</b> against every major animation library you'd consider — including <b>Framer Motion</b> (React), <b>Motion One</b> / <code>motion.dev</code>, and <b>GSAP</b>. Feature matrices, pros / cons, verdicts. No spin."
/>
