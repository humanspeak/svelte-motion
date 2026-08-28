<script lang="ts">
    import { AnimatePresence, MotionConfig, motion } from '$lib'

    let skip = $state(false)
    let showExit = $state(true)
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center gap-8 p-8">
    <div class="space-y-2 text-center">
        <h1 class="text-3xl font-bold">MotionConfig.skipAnimations</h1>
        <p class="max-w-xl text-gray-600">
            <code class="rounded bg-gray-100 px-2 py-1">&lt;MotionConfig skipAnimations&gt;</code>
            makes every animation in its subtree jump directly to its final value instead of tweening.
        </p>
    </div>

    <label class="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" data-testid="toggle-skip" bind:checked={skip} />
        Skip animations
    </label>

    <p class="text-sm text-gray-600" data-testid="active-skip">
        Active: <strong>{String(skip)}</strong>
    </p>

    <MotionConfig skipAnimations={skip}>
        {#key skip}
            <motion.div
                data-testid="motion-box"
                initial={{ x: 0, opacity: 0 }}
                animate={{ x: 200, opacity: 1 }}
                transition={{ duration: 2, ease: 'linear' }}
                class="box"
            />
        {/key}

        <div class="flex flex-col items-center gap-3">
            <button
                type="button"
                data-testid="toggle-presence"
                class="rounded bg-gray-900 px-4 py-2 text-white"
                onclick={() => (showExit = !showExit)}
            >
                {showExit ? 'Remove exit box' : 'Show exit box'}
            </button>
            <AnimatePresence>
                {#if showExit}
                    <motion.div
                        key="exit-box"
                        data-testid="exit-box"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2 }}
                        class="box"
                    />
                {/if}
            </AnimatePresence>
        </div>
    </MotionConfig>

    <section class="flex flex-col items-center gap-3">
        <h2 class="text-lg font-semibold">Outside MotionConfig</h2>
        <motion.div
            data-testid="outside-box"
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: 200, opacity: 1 }}
            transition={{ duration: 2, ease: 'linear' }}
            class="box"
        />
    </section>

    <div class="max-w-xl space-y-2 text-sm text-gray-600">
        <p>
            When skipping is enabled, the first box settles immediately and the presence exit
            completes without waiting for its two-second transition.
        </p>
        <p>
            The outside box keeps animating normally, demonstrating that the switch applies only to
            descendants of the configured subtree.
        </p>
    </div>
</div>

<style>
    :global(.box) {
        width: 120px;
        height: 120px;
        border-radius: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
</style>
