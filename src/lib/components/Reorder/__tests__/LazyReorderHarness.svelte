<script lang="ts">
    import { LazyMotion, type FeatureBundle, type LazyFeatureBundle } from '$lib'
    import { Reorder as MReorder } from '$lib/m'
    import { Reorder as MainReorder } from '$lib/reorder'

    let {
        features,
        strict = false,
        entry = 'm',
        onReorder = () => {}
    }: {
        features: FeatureBundle | LazyFeatureBundle
        strict?: boolean
        entry?: 'main' | 'm'
        onReorder?: (next: string[]) => void
    } = $props()

    let items = $state(['a', 'b', 'c'])

    const Reorder = $derived(entry === 'm' ? MReorder : MainReorder)
</script>

<LazyMotion {features} {strict}>
    <Reorder.Group
        axis="y"
        values={items}
        onReorder={(next: string[]) => {
            onReorder(next)
            items = next
        }}
        data-testid="group"
    >
        {#each items as item (item)}
            <Reorder.Item value={item} data-testid={item}>{item}</Reorder.Item>
        {/each}
    </Reorder.Group>
</LazyMotion>
