<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import type { MotionProps } from '$lib/types.js'
    import { isNotEmpty } from '$lib/utils/objects.js'
    import { sleep } from '$lib/utils/testing.js'
    import { animate } from 'motion'
    import { type Snippet } from 'svelte'
    import type { SvelteHTMLElements } from 'svelte/elements'

    type Props = MotionProps & {
        children?: Snippet
        tag: keyof SvelteHTMLElements
        [key: string]: unknown
    }

    let {
        children,
        tag = 'div',
        initial: initialProp,
        animate: animateProp,
        transition: transitionProp,
        style: styleProp,
        class: classProp,
        whileTap: whileTapProp,
        ...rest
    }: Props = $props()
    let element: HTMLElement | null = $state(null)
    let isLoaded = $state<'mounting' | 'initial' | 'ready' | 'animated'>('mounting')
    let dataPath = $state<number>(-1)
    const motionConfig = getMotionConfig()
    const isPlaywright =
        typeof window !== 'undefined' &&
        window.location.search.includes('@humanspeak-svelte-motion-isPlaywright=true')

    $effect(() => {
        transitionProp = {
            ...(motionConfig?.transition ?? {}),
            ...(transitionProp ?? {})
        }
    })

    const runAnimation = () => {
        if (!element || !animateProp) return
        const transitionAmimate = {
            ...(transitionProp ?? {})
        }
        animate(element, animateProp, transitionAmimate)
    }

    // Merge style for before/after ready so styles carry through post-anim
    // Merge styles directly in markup; keep effect solely for readiness logic

    // whileTap handling without relying on motion.press (fallback compatible)
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(whileTapProp))) return

        const handlePointerDown = () => {
            animate(element!, whileTapProp!)
        }
        const handlePointerUp = () => {
            if (isNotEmpty(initialProp)) {
                const initialRecord = (initialProp ?? {}) as Record<string, unknown>
                const whileTapRecord = (whileTapProp ?? {}) as Record<string, unknown>
                const commonKeys = Object.keys(initialRecord).filter((k) => k in whileTapRecord)
                const resetRecord: Record<string, unknown> = {}
                for (const k of commonKeys) resetRecord[k] = initialRecord[k]
                animate(element!, resetRecord as unknown as import('motion').DOMKeyframesDefinition)
            }
        }

        element.addEventListener('pointerdown', handlePointerDown)
        element.addEventListener('pointerup', handlePointerUp)
        element.addEventListener('pointercancel', handlePointerUp)

        return () => {
            element?.removeEventListener('pointerdown', handlePointerDown)
            element?.removeEventListener('pointerup', handlePointerUp)
            element?.removeEventListener('pointercancel', handlePointerUp)
        }
    })

    $effect(() => {
        if (!(element && isLoaded === 'mounting')) return
        if (animateProp) {
            if (isNotEmpty(initialProp)) {
                // Apply initial instantly BEFORE exposing 'initial' state
                animate(element!, initialProp!, { duration: 0 })
                // Mark initial after styles are applied so tests read CSS=0 while state=initial
                isLoaded = 'initial'
                dataPath = 1
                // Then promote to ready and run the enter animation
                requestAnimationFrame(async () => {
                    if (isPlaywright) {
                        await sleep(10)
                    }
                    isLoaded = 'ready'
                    runAnimation()
                })
            } else {
                dataPath = 2
                isLoaded = 'ready'
                runAnimation()
            }
        } else if (isNotEmpty(initialProp)) {
            // Apply initial instantly BEFORE exposing 'initial' state
            animate(element!, initialProp!, { duration: 0 })
            dataPath = 3
            isLoaded = 'initial'
            requestAnimationFrame(async () => {
                if (isPlaywright) {
                    await sleep(10)
                }
                isLoaded = 'ready'
            })
        } else {
            dataPath = 4
            isLoaded = 'ready'
        }
    })
</script>

<svelte:element
    this={tag}
    bind:this={element}
    {...rest}
    data-playwright={isPlaywright ? isPlaywright : undefined}
    data-is-loaded={isPlaywright ? isLoaded : undefined}
    data-path={isPlaywright ? dataPath : undefined}
    style={isLoaded === 'ready' ? `${styleProp ?? ''} ${element?.style.cssText ?? ''}` : styleProp}
    class={classProp}
>
    {#if isLoaded === 'ready'}
        {@render children?.()}
    {/if}
</svelte:element>
