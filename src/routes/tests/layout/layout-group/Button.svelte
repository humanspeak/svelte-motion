<script lang="ts">
    import { motion } from '$lib'

    const { onclick }: { onclick?: () => void } = $props()
    const id = $props.id()
</script>

<motion.div
    id="button"
    layoutId={id}
    style="background: blue; color: white; border-radius: 8px; padding: 10px; cursor: pointer;"
    {onclick}
>
    Add child
</motion.div>
