<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import Probe from '$lib/components/__tests__/Probe.svelte'
    export let transition: { duration?: number } = { duration: 0.5 }
</script>

<MotionConfig {transition}>
    <Probe />
</MotionConfig>
