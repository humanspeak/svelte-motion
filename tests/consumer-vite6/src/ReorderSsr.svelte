<script>
    import { Reorder } from '@humanspeak/svelte-motion'
</script>

<Reorder.Group as="article" values={[]} onReorder={() => {}}>
    <Reorder.Item as="main" value={0} />
</Reorder.Group>
