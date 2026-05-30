<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import { onDestroy } from 'svelte'

    type CopyStage = 'copy' | 'copied'

    const copyStages: Record<
        CopyStage,
        {
            className: string
            label: string
        }
    > = {
        copy: {
            className: 'copy-state',
            label: 'copy'
        },
        copied: {
            className: 'copied-state',
            label: 'copied'
        }
    }

    let stage = $state<CopyStage>('copy')
    let hasActivated = $state(false)
    let hovered = $state(false)
    let pressed = $state(false)
    let resetTimer: ReturnType<typeof setTimeout> | null = null

    const layoutTransition = { type: 'spring' as const, stiffness: 440, damping: 34 }
    const rollTransition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }
    const settledState = { opacity: 1, y: 0, filter: 'blur(0px)' }
    const rollEnterState = { opacity: 0, y: 14, filter: 'blur(5px)' }
    const contentRestState = { y: 0, scale: 1 }
    const contentHoverState = { y: -1, scale: 1.025 }
    const contentPressedState = { y: 0, scale: 0.94 }
    const contentTransition = { type: 'spring' as const, stiffness: 500, damping: 30 }

    function clearTimers() {
        if (resetTimer) clearTimeout(resetTimer)
        resetTimer = null
    }

    function copySnippet() {
        clearTimers()
        hasActivated = true
        stage = 'copied'
        resetTimer = setTimeout(() => {
            stage = 'copy'
            resetTimer = null
        }, 1800)
    }

    function leaveButton() {
        hovered = false
        pressed = false
    }

    function releasePress() {
        pressed = false
    }

    onDestroy(clearTimers)
</script>

<article class="demo featured-demo" data-testid="rolling-demo">
    <div class="featured-copy">
        <div>
            <p class="eyebrow">dogfood control</p>
            <h2>Hover, tap, and rolling copy label</h2>
            <p>
                This mirrors the docs copy interaction: the shell responds to hover/tap while
                AnimatePresence rolls the icon and label between copy and copied states.
            </p>
        </div>

        <div class="rolling-button-slot">
            <motion.button
                type="button"
                class="copy-button rolling-copy-button"
                data-testid="rolling-button"
                data-stage={stage}
                aria-label="Copy snippet"
                layout
                transition={layoutTransition}
                onpointerenter={() => (hovered = true)}
                onpointerleave={leaveButton}
                onpointerdown={() => (pressed = true)}
                onpointerup={releasePress}
                onpointercancel={releasePress}
                onblur={leaveButton}
                onclick={copySnippet}
            >
                <motion.span
                    class="rolling-button-content"
                    data-testid="rolling-button-content"
                    animate={pressed
                        ? contentPressedState
                        : hovered
                          ? contentHoverState
                          : contentRestState}
                    transition={contentTransition}
                >
                    <span class="state-stack rolling-state-stack">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                                key={stage}
                                class={`state rolling-state ${copyStages[stage].className}`}
                                data-testid={`rolling-${stage}-state`}
                                layout="position"
                                initial={hasActivated ? rollEnterState : settledState}
                                animate={settledState}
                                exit={{ opacity: 0, y: -14, filter: 'blur(5px)' }}
                                transition={rollTransition}
                            >
                                {#if stage === 'copied'}
                                    <svg
                                        aria-hidden="true"
                                        data-testid="rolling-copied-icon"
                                        viewBox="0 0 24 24"
                                    >
                                        <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                {:else}
                                    <svg
                                        aria-hidden="true"
                                        data-testid="rolling-copy-icon"
                                        viewBox="0 0 24 24"
                                    >
                                        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                        <path
                                            d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
                                        />
                                    </svg>
                                {/if}
                                <span>{copyStages[stage].label}</span>
                            </motion.span>
                        </AnimatePresence>
                    </span>
                </motion.span>
            </motion.button>
        </div>
    </div>
</article>
