<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import type { MotionProps } from '$lib/types.js'
    import { getCommonKeys, isNotEmpty } from '$lib/utils/objects.js'
    import { sleep } from '$lib/utils/testing.js'
    import { animate, press } from 'motion'
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

    $effect(() => {
        if (element && isLoaded === 'ready') {
            if (isNotEmpty(whileTapProp)) {
                press(element, (element: Element) => {
                    animate(element, whileTapProp!)
                    return () => {
                        if (isNotEmpty(initialProp)) {
                            const commonProps = getCommonKeys(initialProp!, whileTapProp!)
                            const resetProps = Object.fromEntries(
                                commonProps.map((key) => [key, initialProp![key]])
                            )
                            animate(element, resetProps)
                        }
                    }
                })
            }
        }
    })

    $effect(() => {
        if (element) {
            if (animateProp) {
                if (isNotEmpty(initialProp)) {
                    // Set initial state immediately
                    isLoaded = 'initial'
                    dataPath = 1
                    // Give time for initial render
                    setTimeout(async () => {
                        await animate(element!, initialProp!)
                        if (isPlaywright) {
                            await sleep(250)
                        }
                        isLoaded = 'ready'
                        runAnimation()
                    }, 5)
                } else {
                    dataPath = 2
                    isLoaded = 'ready'
                    runAnimation()
                }
            } else if (isNotEmpty(initialProp)) {
                dataPath = 3
                isLoaded = 'initial'
                setTimeout(async () => {
                    await animate(element!, initialProp!)
                    if (isPlaywright) {
                        await sleep(250)
                    }
                    isLoaded = 'ready'
                }, 5)
            } else {
                dataPath = 4
                isLoaded = 'ready'
            }
        }
    })
</script>

<svelte:element
    this={tag}
    bind:this={element}
    {...rest}
    data-playwright={isPlaywright}
    data-is-loaded={isPlaywright ? isLoaded : undefined}
    data-path={isPlaywright ? dataPath : undefined}
    style={isLoaded === 'ready' ? `${styleProp} ${element?.style.cssText}` : undefined}
    class={isLoaded === 'ready' ? classProp : undefined}
>
    {#if isLoaded === 'ready'}
        {@render children?.()}
    {/if}
</svelte:element>
