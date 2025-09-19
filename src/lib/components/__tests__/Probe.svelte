<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'

    const cfg = getMotionConfig()
    const duration = (cfg?.transition as { duration?: number } | undefined)?.duration
</script>

<div data-testid="probe" data-probe={duration ?? 'none'}></div>
