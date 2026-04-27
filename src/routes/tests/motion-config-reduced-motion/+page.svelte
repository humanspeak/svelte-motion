<script lang="ts">
    import { motion, MotionConfig, type ReducedMotionConfig } from '$lib'

    let policy = $state<ReducedMotionConfig>('always')
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center gap-8 p-8">
    <div class="space-y-2 text-center">
        <h1 class="text-3xl font-bold">MotionConfig.reducedMotion</h1>
        <p class="max-w-xl text-gray-600">
            <code class="rounded bg-gray-100 px-2 py-1"
                >&lt;MotionConfig reducedMotion="..."&gt;</code
            >
            strips transform animations from descendants while leaving
            <code class="rounded bg-gray-100 px-2 py-1">opacity</code> and other non-transform properties
            animating normally.
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
                    onchange={() => (policy = option)}
                />
                {option}
            </label>
        {/each}
    </div>

    <p class="text-sm text-gray-600" data-testid="active-policy">
        Active policy: <strong>{policy}</strong>
    </p>

    <MotionConfig reducedMotion={policy}>
        {#key policy}
            <motion.div
                data-testid="motion-box"
                initial={{ x: -200, opacity: 0 }}
                animate={{ x: 200, opacity: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                class="box"
            />
        {/key}
    </MotionConfig>

    <div class="max-w-xl space-y-2 text-sm text-gray-600">
        <p>
            With <code class="rounded bg-gray-100 px-1">reducedMotion="always"</code> the box stays at
            its natural position (transform animations stripped) but still fades in.
        </p>
        <p>
            With <code class="rounded bg-gray-100 px-1">reducedMotion="user"</code> the OS preference
            decides; in DevTools toggle "Emulate prefers-reduced-motion: reduce" to see the effect.
        </p>
        <p>
            With <code class="rounded bg-gray-100 px-1">reducedMotion="never"</code> the box translates
            and fades as authored.
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
