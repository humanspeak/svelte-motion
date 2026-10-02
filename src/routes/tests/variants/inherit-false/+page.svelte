<script lang="ts">
    import { motion, type Variants } from '$lib'

    /**
     * Ports Motion 13.5.1's `inherit={false}` tests (upstream commit b63833cb0,
     * `variant.test.tsx`). Each scenario's target element has a static
     * `style={{ opacity: 0.5 }}` and variants `a: 0.2` / `b: 0.8`. When it
     * opts out of inheritance it must stay at 0.5 no matter what the outer
     * parent does. The control scenario inherits normally and must reach 0.8.
     */
    let control = $state('a')
    let one = $state('a')
    let two = $state('a')
    let three = $state('a')

    const variants: Variants = { a: { opacity: 0.2 }, b: { opacity: 0.8 } }
    const hoverVariants: Variants = { rest: { opacity: 0.2 }, hover: { opacity: 0.8 } }
    const transition = { type: false } as const
</script>

<svelte:head>
    <title>Variants — inherit={false}</title>
</svelte:head>

<div class="page">
    <h1>inherit={'{false}'}</h1>

    <section>
        <h2>Control (inherits)</h2>
        <button type="button" data-testid="switch-control" onclick={() => (control = 'b')}>
            Switch
        </button>
        <motion.div animate={control} initial="a" data-testid="parent-control">
            <motion.div data-testid="child-control" {variants} {transition} style="opacity: 0.5">
                child
            </motion.div>
        </motion.div>
    </section>

    <section>
        <h2>1. Child does not follow parent</h2>
        <button type="button" data-testid="switch-1" onclick={() => (one = 'b')}>Switch</button>
        <motion.div animate={one} initial="a" data-testid="parent-1">
            <motion.div
                inherit={false}
                data-testid="child-1"
                {variants}
                {transition}
                style="opacity: 0.5"
            >
                child
            </motion.div>
        </motion.div>
    </section>

    <section>
        <h2>2. Descendants of inherit=false node (with variants)</h2>
        <button type="button" data-testid="switch-2" onclick={() => (two = 'b')}>Switch</button>
        <motion.div animate={two} initial="a" data-testid="parent-2">
            <motion.div inherit={false} variants={{}}>
                <motion.div data-testid="grandchild-2" {variants} {transition} style="opacity: 0.5">
                    grandchild
                </motion.div>
            </motion.div>
        </motion.div>
    </section>

    <section>
        <h2>3. Descendants of plain inherit=false node</h2>
        <button type="button" data-testid="switch-3" onclick={() => (three = 'b')}>Switch</button>
        <motion.div animate={three} initial="a" data-testid="parent-3">
            <motion.div inherit={false}>
                <motion.div data-testid="grandchild-3" {variants} {transition} style="opacity: 0.5">
                    grandchild
                </motion.div>
            </motion.div>
        </motion.div>
    </section>

    <section>
        <h2>4. Child does not follow parent gestures</h2>
        <motion.div animate="rest" whileHover="hover" data-testid="parent-4" class="hover-box">
            <motion.div
                inherit={false}
                data-testid="child-4"
                variants={hoverVariants}
                {transition}
                style="opacity: 0.5"
            >
                child (hover the box)
            </motion.div>
        </motion.div>
    </section>
</div>

<style>
    .page {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 32px;
        font-family: system-ui, sans-serif;
    }

    section {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 280px;
    }

    h2 {
        font-size: 0.9rem;
        font-weight: 600;
    }

    button {
        align-self: flex-start;
        border: 1px solid #cbd5f5;
        border-radius: 8px;
        background: #eef2ff;
        padding: 4px 12px;
        cursor: pointer;
    }

    :global(.hover-box) {
        padding: 16px;
        background: #e5e7eb;
    }

    :global([data-testid^='child-']),
    :global([data-testid^='grandchild-']) {
        height: 40px;
        border-radius: 8px;
        background: #22d3ee;
        padding: 8px;
    }
</style>
