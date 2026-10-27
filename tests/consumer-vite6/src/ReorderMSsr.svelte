<script>
    import { LazyMotion, domMax } from '@humanspeak/svelte-motion'
    import { Reorder } from '@humanspeak/svelte-motion/m'
</script>

<LazyMotion features={domMax} strict>
    <Reorder.Group as="article" values={[]} onReorder={() => {}}>
        <Reorder.Item as="main" value={0} />
    </Reorder.Group>
</LazyMotion>
