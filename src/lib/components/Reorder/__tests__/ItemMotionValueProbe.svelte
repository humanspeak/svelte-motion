<script lang="ts">
    import type { RawMotionValue } from '$lib/utils/motionValue.svelte'
    import { Reorder } from '$lib/reorder'

    let { x }: { x: RawMotionValue<number> } = $props()
</script>

<Reorder.Group values={[0]} onReorder={() => {}}>
    <Reorder.Item value={0} style={{ x }} data-testid="probe-item">zero</Reorder.Item>
</Reorder.Group>
