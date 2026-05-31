<script lang="ts">
    import { AnimatePresence, MotionButton, MotionSpan } from '$lib'
    import { onDestroy } from 'svelte'

    type CopyStage = 'copy' | 'copied'

    const stateTransition = { duration: 0.16 }
    const copyPress = { scale: 0.96 }
    const copyHover = { scale: 1.03 }

    let stage = $state<CopyStage>('copy')
    let resetTimer: ReturnType<typeof setTimeout> | null = null

    const clearResetTimer = () => {
        if (resetTimer) clearTimeout(resetTimer)
        resetTimer = null
    }

    const copySnippet = () => {
        clearResetTimer()
        stage = 'copied'
        resetTimer = setTimeout(() => {
            stage = 'copy'
            resetTimer = null
        }, 1600)
    }

    onDestroy(clearResetTimer)
</script>

<article class="demo docs-kit-demo" data-testid="docs-kit-copy-demo">
    <div>
        <p class="eyebrow">docs-kit regression</p>
        <h2>Fixed overlay copy feedback</h2>
        <p>
            This mirrors the docs code copy button: hover/tap can scale the shell, but the
            copy/copied text must never drop outside the fixed button box.
        </p>
    </div>

    <MotionButton
        type="button"
        class={stage === 'copied' ? 'docs-kit-copy copied' : 'docs-kit-copy'}
        data-testid="docs-kit-copy-button"
        data-stage={stage}
        aria-label="Copy docs snippet"
        whileTap={copyPress}
        whileHover={copyHover}
        onclick={copySnippet}
    >
        <AnimatePresence initial={false}>
            {#if stage === 'copied'}
                <MotionSpan
                    key="copied"
                    class="docs-kit-copy-state copied-state"
                    data-testid="docs-kit-copied-state"
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 0 }}
                    transition={stateTransition}
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>copied</span>
                </MotionSpan>
            {:else}
                <MotionSpan
                    key="copy"
                    class="docs-kit-copy-state copy-state"
                    data-testid="docs-kit-copy-state"
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 0 }}
                    transition={stateTransition}
                >
                    <svg aria-hidden="true" viewBox="0 0 24 24">
                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                    <span>copy</span>
                </MotionSpan>
            {/if}
        </AnimatePresence>
    </MotionButton>
</article>
