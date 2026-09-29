<script lang="ts">
    import { motion } from '$lib'

    // Upstream wraps this in `motion.create(Fragment)` (a variants-only
    // wrapper that renders no element). It carries no animation props in the
    // fixture, so it is omitted here; #expander renders directly inside
    // #expander-wrapper, matching upstream's DOM.

    let expanded = $state(false)
    const id = $props.id()
</script>

<motion.div
    id="expander"
    layoutId={id}
    onclick={() => (expanded = !expanded)}
    style="height: {expanded
        ? 100
        : 25}px; background-color: red; margin-bottom: 4px; cursor: pointer;"
    transition={{ type: 'tween' }}
>
    {expanded ? 'collapse' : 'expand'} me
</motion.div>
