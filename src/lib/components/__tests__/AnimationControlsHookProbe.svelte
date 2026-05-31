<script lang="ts">
    import { useAnimationControls, type AnimationControls } from '$lib'

    let { onReady }: { onReady: (controls: AnimationControls) => void } = $props()

    const controls = useAnimationControls()

    $effect(() => {
        onReady(controls)
    })
</script>

<div data-testid="animation-controls-hook-probe"></div>
