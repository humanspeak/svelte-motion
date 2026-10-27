<script lang="ts">
    import { LazyMotion, domMax, styleString } from '@humanspeak/svelte-motion'
    import { Reorder } from '@humanspeak/svelte-motion/m'

    let items = $state(['Tomato', 'Cucumber', 'Cheese', 'Lettuce'])
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <LazyMotion features={domMax} strict>
        <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next: string[]) => (items = next)}
            style={styleString(() => ({
                listStyle: 'none',
                margin: 0,
                padding: 0,
                width: '240px',
                display: 'grid',
                gap: '0.5rem'
            }))}
        >
            {#each items as item (item)}
                <Reorder.Item
                    value={item}
                    style={styleString(() => ({
                        padding: '0.75rem 1rem',
                        border: '1px solid var(--brut-ink, #0a0a0a)',
                        backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                        boxShadow: '4px 4px 0 var(--brut-rule, #d6dedb)',
                        color: 'var(--brut-ink, #0a0a0a)',
                        fontFamily: 'var(--brut-mono, monospace)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        cursor: 'grab',
                        userSelect: 'none'
                    }))}
                >
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
    </LazyMotion>
</div>

<style>
    .dk-demo-shell {
        display: grid;
        place-items: center;
        width: 100%;
        padding: 1.5rem;
    }
</style>
