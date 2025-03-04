<script lang="ts">
    import { type Snippet } from 'svelte'
    import type { SvelteHTMLElements } from 'svelte/elements'
    import type { MotionProps } from '../types.js'
    import { animate, press } from 'motion'
    import { isNotEmpty, getCommonKeys } from '../utils/objects.js'
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'

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
    let isLoaded = $state(false)

    const motionConfig = getMotionConfig()

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

    const setIsLoaded = () => {
        setTimeout(() => {
            isLoaded = true
        }, 1)
    }

    $effect(() => {
        if (element && isLoaded) {
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
                    animate(element, initialProp!)
                        .then(() => {
                            setIsLoaded()
                        })
                        .then(runAnimation)
                } else {
                    setIsLoaded()
                    runAnimation()
                }
            } else if (isNotEmpty(initialProp)) {
                animate(element, initialProp!).then(() => {
                    setIsLoaded()
                })
            } else {
                setIsLoaded()
            }
        }
    })
</script>

<svelte:element
    this={tag}
    bind:this={element}
    {...rest}
    style={isLoaded ? `${styleProp} ${element?.style.cssText}` : undefined}
    class={isLoaded ? classProp : undefined}
>
    {#if isLoaded}
        {@render children?.()}
    {/if}
</svelte:element>
