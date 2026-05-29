<script lang="ts">
    import { AnimatePresence, motion } from '$lib'
    import { onDestroy, onMount } from 'svelte'
    import type { AnimatePresenceMode } from '$lib/types'

    const { mode, title, testIdPrefix } = $props<{
        mode: AnimatePresenceMode
        title: string
        testIdPrefix: string
    }>()

    let copied = $state(false)
    let resetTimer: ReturnType<typeof setTimeout> | null = null
    let buttonElement: HTMLButtonElement | null = $state(null)
    let observerLog = $state<string[]>([])

    const layoutTransition = { duration: 2.4, ease: 'linear' as const }
    const visibleExit = { opacity: 0, transition: { duration: 0.001 } }
    const labelTransition = { duration: 0.08, ease: 'linear' as const }
    const resetDelay = () => (mode === 'wait' ? 5200 : 3200)

    function pushLog(entry: Record<string, unknown>) {
        const line = JSON.stringify(entry)
        observerLog = [...observerLog.slice(-18), line]
        console.log(`[layout-button:${mode}]`, line)
    }

    function visibleStateElement(): HTMLElement | null {
        if (!buttonElement) return null

        const states = Array.from(buttonElement.querySelectorAll<HTMLElement>('.state'))
        return (
            states.find((state) => {
                const style = getComputedStyle(state)
                const rect = state.getBoundingClientRect()
                return (
                    style.display !== 'none' &&
                    state.getAttribute('data-presence-wait-hidden') !== 'true' &&
                    !state.closest('[data-clone="true"]') &&
                    rect.width > 0 &&
                    rect.height > 0
                )
            }) ??
            states[0] ??
            null
        )
    }

    function snapshot(label: string) {
        if (!buttonElement) return undefined

        const stateElement = visibleStateElement()
        const buttonStyle = getComputedStyle(buttonElement)
        const stateStyle = stateElement ? getComputedStyle(stateElement) : undefined
        const buttonRect = buttonElement.getBoundingClientRect()
        const stateRect = stateElement?.getBoundingClientRect()

        const entry = {
            label,
            mode,
            buttonText: buttonElement.textContent?.trim(),
            buttonClass: buttonElement.className,
            buttonInlineTransform: buttonElement.style.transform || '(none)',
            buttonComputedTransform: buttonStyle.transform,
            buttonFontSize: buttonStyle.fontSize,
            buttonLineHeight: buttonStyle.lineHeight,
            buttonWidth: buttonRect.width.toFixed(3),
            buttonHeight: buttonRect.height.toFixed(3),
            stateClass: stateElement?.className ?? '(missing)',
            stateInlineTransform: stateElement?.style.transform || '(none)',
            stateComputedTransform: stateStyle?.transform ?? '(missing)',
            stateDisplay: stateStyle?.display ?? '(missing)',
            stateFontSize: stateStyle?.fontSize ?? '(missing)',
            stateLineHeight: stateStyle?.lineHeight ?? '(missing)',
            stateWidth: stateRect ? stateRect.width.toFixed(3) : '(missing)',
            stateHeight: stateRect ? stateRect.height.toFixed(3) : '(missing)',
            hiddenWaitStates: buttonElement.querySelectorAll('[data-presence-wait-hidden="true"]')
                .length,
            animationCount: buttonElement.getAnimations({ subtree: true }).length
        }

        pushLog(entry)
        return entry
    }

    function traceFrames(reason: string) {
        let frame = 0
        const started = performance.now()

        const readFrame = () => {
            frame += 1
            snapshot(`${reason} frame ${frame} +${Math.round(performance.now() - started)}ms`)
            if (performance.now() - started < 520) {
                requestAnimationFrame(readFrame)
            }
        }

        requestAnimationFrame(readFrame)
    }

    function showCopied() {
        snapshot('before click')
        copied = true
        if (resetTimer) clearTimeout(resetTimer)
        resetTimer = setTimeout(() => {
            snapshot('before reset')
            copied = false
            resetTimer = null
            traceFrames('reset')
        }, resetDelay())
        traceFrames('click')
    }

    onMount(() => {
        if (!buttonElement) return

        snapshot('mounted')

        const resizeObserver = new ResizeObserver(() => {
            snapshot('ResizeObserver')
        })
        resizeObserver.observe(buttonElement)

        const mutationObserver = new MutationObserver((mutations) => {
            pushLog({
                label: 'MutationObserver',
                mode,
                mutations: mutations.map((mutation) => ({
                    type: mutation.type,
                    target:
                        mutation.target instanceof HTMLElement
                            ? {
                                  tag: mutation.target.tagName.toLowerCase(),
                                  className: mutation.target.className,
                                  style: mutation.target.getAttribute('style'),
                                  hidden:
                                      mutation.target.getAttribute('data-presence-wait-hidden') ===
                                      'true'
                              }
                            : mutation.target.nodeName,
                    attributeName: mutation.attributeName
                }))
            })
            snapshot('MutationObserver')
        })
        mutationObserver.observe(buttonElement, {
            attributes: true,
            attributeFilter: ['class', 'style', 'data-presence-wait-hidden'],
            childList: true,
            subtree: true
        })

        return () => {
            resizeObserver.disconnect()
            mutationObserver.disconnect()
        }
    })

    onDestroy(() => {
        if (resetTimer) clearTimeout(resetTimer)
    })
</script>

<article class="demo" data-testid="{testIdPrefix}-demo">
    <div class="demo-head">
        <div>
            <h2>{title}</h2>
            <p>{mode}</p>
        </div>
        <motion.button
            type="button"
            class="copy-button"
            data-testid="{testIdPrefix}-button"
            data-mode={mode}
            aria-label="Copy snippet"
            bind:ref={buttonElement}
            layout
            transition={layoutTransition}
            onclick={showCopied}
        >
            <span class="state-stack">
                <AnimatePresence initial={false} {mode}>
                    {#if copied}
                        <motion.span
                            key="copied"
                            class="state copied-state"
                            data-testid="{testIdPrefix}-copied-state"
                            layout="position"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={visibleExit}
                            transition={labelTransition}
                        >
                            <svg
                                aria-hidden="true"
                                data-testid="{testIdPrefix}-copied-icon"
                                viewBox="0 0 24 24"
                            >
                                <path d="M20 6 9 17l-5-5" />
                            </svg>
                            <span>copied</span>
                        </motion.span>
                    {:else}
                        <motion.span
                            key="copy"
                            class="state copy-state"
                            data-testid="{testIdPrefix}-copy-state"
                            layout="position"
                            initial={{ opacity: 1 }}
                            animate={{ opacity: 1 }}
                            exit={visibleExit}
                            transition={labelTransition}
                        >
                            <svg
                                aria-hidden="true"
                                data-testid="{testIdPrefix}-copy-icon"
                                viewBox="0 0 24 24"
                            >
                                <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                                <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                            </svg>
                            <span>copy</span>
                        </motion.span>
                    {/if}
                </AnimatePresence>
            </span>
        </motion.button>
    </div>

    <div class="debug-log" data-testid="{testIdPrefix}-observer-log">
        <div class="debug-head">observer log</div>
        {#each observerLog as line, index (index)}
            <code>{index + 1}: {line}</code>
        {/each}
    </div>
</article>
