<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import Probe from '$lib/components/__tests__/Probe.svelte'
    let { transition = { duration: 0.5 } }: { transition?: { duration?: number } } = $props()
</script>

<MotionConfig {transition}>
    <Probe />
</MotionConfig>
