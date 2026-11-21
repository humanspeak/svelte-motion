<script lang="ts">
    import { AnimatePresence, motion, MotionConfig, type ReducedMotionConfig } from '$lib'
    import TesterPanel, { type TesterStep } from '../layout/_parity/TesterPanel.svelte'

    let policy = $state<ReducedMotionConfig>('always')
    let showExitBox = $state(true)

    const steps: TesterStep[] = [
        {
            text: 'Load the page (policy `always`).',
            expected:
                'The box appears on the right at once, with no slide, and fades in over about a second.'
        },
        {
            text: 'Click Hide exit box.',
            expected:
                'The lower box jumps 200 px right at once and fades out there. It never slides.'
        },
        {
            text: 'Choose `never`.',
            expected:
                'The box slides in from the left while fading in; Hide exit box slides it right while fading.'
        },
        {
            text: 'Choose `user`, then toggle DevTools > Rendering > Emulate prefers-reduced-motion, and choose `user` again.',
            expected: 'With `reduce` it behaves like `always`; with `no-preference`, like `never`.'
        }
    ]
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center gap-8 p-8">
    <div class="space-y-2 text-center">
        <h1 class="text-3xl font-bold">MotionConfig.reducedMotion</h1>
        <p class="max-w-xl text-gray-600">
            <code class="rounded bg-gray-100 px-2 py-1"
                >&lt;MotionConfig reducedMotion="..."&gt;</code
            >
            makes transform and layout values of descendants jump straight to their target, while
            <code class="rounded bg-gray-100 px-2 py-1">opacity</code> and other values keep animating
            normally.
        </p>
    </div>

    <div class="flex flex-wrap items-center justify-center gap-3">
        {#each ['always', 'user', 'never'] as const as option (option)}
            <label class="flex items-center gap-2 text-sm text-gray-700">
                <input
                    type="radio"
                    name="policy"
                    value={option}
                    data-testid={`policy-${option}`}
                    checked={policy === option}
                    onchange={() => {
                        policy = option
                        showExitBox = true
                    }}
                />
                {option}
            </label>
        {/each}
    </div>

    <p class="text-sm text-gray-600" data-testid="active-policy">
        Active policy: <strong>{policy}</strong>
    </p>

    <button
        type="button"
        data-testid="toggle-exit"
        class="rounded bg-gray-800 px-3 py-1 text-sm text-white"
        onclick={() => (showExitBox = !showExitBox)}
    >
        {showExitBox ? 'Hide exit box' : 'Show exit box'}
    </button>

    <MotionConfig reducedMotion={policy}>
        {#key policy}
            <motion.div
                data-testid="motion-box"
                initial={{ x: -200, opacity: 0 }}
                animate={{ x: 200, opacity: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                class="box"
            />
            <AnimatePresence>
                {#if showExitBox}
                    <motion.div
                        key="exit-box"
                        data-testid="exit-box"
                        initial={false}
                        exit={{ x: 200, opacity: 0 }}
                        transition={{ duration: 1.2, ease: 'linear' }}
                        class="box"
                    />
                {/if}
            </AnimatePresence>
        {/key}
    </MotionConfig>

    <div class="max-w-xl space-y-2 text-sm text-gray-600">
        <p>
            With <code class="rounded bg-gray-100 px-1">reducedMotion="always"</code> the box appears
            at its final position at once (no slide) and fades in. Hiding the exit box makes it jump to
            its exit position at once and fade out there.
        </p>
        <p>
            With <code class="rounded bg-gray-100 px-1">reducedMotion="user"</code> the OS preference
            decides; in DevTools toggle "Emulate prefers-reduced-motion: reduce" to see the effect.
        </p>
        <p>
            With <code class="rounded bg-gray-100 px-1">reducedMotion="never"</code> the box slides and
            fades as authored.
        </p>
    </div>
</div>

<TesterPanel
    eyebrow="Motion 14.14.0 · visual-element-target.ts"
    title="MotionConfig reducedMotion"
    {steps}
    status="Covered by e2e/utilities/motion-config-reduced-motion.spec.ts."
>
    {#snippet checks()}
        <p>
            Under a reducing policy Motion keeps every target and drops only the tween for
            positional keys (transforms, width, height, top, left, …), which jump to their target.
            Opacity, colour and other values still animate. Exit animations follow the same rule.
        </p>
    {/snippet}
</TesterPanel>

<style>
    :global(.box) {
        width: 120px;
        height: 120px;
        border-radius: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
</style>
