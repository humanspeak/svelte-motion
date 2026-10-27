<script lang="ts">
    import { page } from '$app/state'
    import { motion } from '$lib'

    // Port of upstream motion `dev/react/src/tests/issue-2362.tsx`
    // (https://github.com/motiondivision/motion/issues/2362, fixed in Motion
    // 14.6.0 by commits ca68023ce and 8e3e394bd).
    //
    // An element with a layoutId that's conditionally rendered into a different
    // parent. The shared layout animation should carry it across, without
    // re-running the entering element's initial -> animate opacity animation.
    // Elements without an `initial` keep their default values (`?noInitial`).
    // e2e/layout-id/takeover-initial.spec.ts.
    //
    // Modes:
    // - default: plain object initial/animate on the underline.
    // - `?variants`: variant labels, with a variant child dot.
    // - `?parent`: each tab's content is wrapped in a mounted motion.div.
    // - `?noInitial`: a keyed layoutId box with no initial (upstream's last unit case).

    const params = page.url.searchParams
    const useVariants = params.has('variants')
    const parentIsMotion = params.has('parent')
    const noInitial = params.has('noInitial')

    let active = $state(0)
    let step = $state(0)

    const transition = {
        duration: 2,
        ease: 'linear' as const,
        layout: { duration: 0.2 }
    }
    const variants = { hidden: { opacity: 0 }, shown: { opacity: 1 } }
    const underlineStyle =
        'position: absolute; bottom: 0; left: 0; right: 0; height: 5px; background-color: #f00;'
</script>

<svelte:head>
    <title>layoutId · takeover skips initial</title>
</svelte:head>

{#snippet underline()}
    {#if useVariants}
        <motion.div
            data-testid="underline"
            layoutId="underline"
            {variants}
            initial="hidden"
            animate="shown"
            {transition}
            style={underlineStyle}
        >
            <motion.div
                data-testid="underline-child"
                {variants}
                {transition}
                style="position: absolute; top: -10px; left: 45px; width: 10px; height: 10px; border-radius: 50%; background-color: #f00;"
            />
        </motion.div>
    {:else}
        <motion.div
            data-testid="underline"
            layoutId="underline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            {transition}
            style={underlineStyle}
        />
    {/if}
{/snippet}

<main style="padding: 50px; font-family: sans-serif;">
    {#if noInitial}
        <button data-testid="step" type="button" onclick={() => (step = (step + 1) % 3)}>
            step {step}
        </button>
        {#key step === 0 ? 'a' : 'b'}
            <motion.div
                data-testid="box"
                layoutId="box"
                animate={step === 1 ? { scale: 2 } : {}}
                transition={{ type: false }}
                style="width: 100px; height: 100px; margin-top: 50px; background-color: #f00;"
            />
        {/key}
    {:else}
        <div style="display: flex; gap: 100px;">
            {#each [0, 1] as index (index)}
                <button
                    data-testid={`tab-${index}`}
                    type="button"
                    onclick={() => (active = index)}
                    style="position: relative; width: 100px; height: 50px;"
                >
                    {#if parentIsMotion}
                        <motion.div>
                            {`tab ${index}`}
                            {#if active === index}
                                {@render underline()}
                            {/if}
                        </motion.div>
                    {:else}
                        {`tab ${index}`}
                        {#if active === index}
                            {@render underline()}
                        {/if}
                    {/if}
                </button>
            {/each}
            <button data-testid="none" type="button" onclick={() => (active = -1)}>none</button>
        </div>
    {/if}
</main>
