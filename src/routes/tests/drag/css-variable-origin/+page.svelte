<script lang="ts">
    import { page } from '$app/state'
    import { motion, useMotionValue } from '$lib'

    /**
     * Drag origin from a CSS-variable / percentage `y` (spike 006 acceptance test).
     *
     * Port of upstream motion `dev/react/src/tests/issue-2390.tsx` (v14.5.0). The
     * box is 400px tall and `--slide-to` is `20%`, so the resting `y` is 80px.
     *
     * Variants (`?variant=`):
     * - `animate` (default): `y` animates from `var(--slide-from)` to `var(--slide-to)`.
     * - `mv-var`: `style={{ y }}` bound to `useMotionValue('var(--slide-to)')`.
     * - `mv-percent`: `style={{ y }}` bound to `useMotionValue('20%')`.
     */
    const variant = page.url.searchParams.get('variant') ?? 'animate'
    const y = useMotionValue<string | number>(variant === 'mv-percent' ? '20%' : 'var(--slide-to)')
    const boxStyle =
        'position: fixed; top: 0; left: 0; height: 400px; width: 300px; background: lightblue; --slide-from: 120%; --slide-to: 20%;'
</script>

{#if variant === 'animate'}
    <motion.div
        data-testid="box"
        initial={{ y: 'var(--slide-from)' }}
        animate={{ y: 'var(--slide-to)' }}
        transition={{ duration: 0.3 }}
        drag="y"
        dragElastic={0}
        dragMomentum={false}
        style={boxStyle}
    >
        <div data-testid="handle" style="height: 96px; width: 100%; background: orange"></div>
    </motion.div>
{:else}
    <motion.div
        data-testid="box"
        drag="y"
        dragElastic={0}
        dragMomentum={false}
        style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: 400,
            width: 300,
            background: 'lightblue',
            '--slide-from': '120%',
            '--slide-to': '20%',
            y
        }}
    >
        <div data-testid="handle" style="height: 96px; width: 100%; background: orange"></div>
    </motion.div>
{/if}
