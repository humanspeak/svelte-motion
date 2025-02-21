<script lang="ts">
    import { type Snippet } from 'svelte'
    import type { SvelteHTMLElements } from 'svelte/elements'
    import type { MotionInitial, MotionAnimate, MotionTransition } from './types.js'
    import { animate } from 'motion'
    import { isNotEmpty } from './utils/objects.js'

    type Props = {
        children?: Snippet
        tag: keyof SvelteHTMLElements
        initial?: MotionInitial
        animate?: MotionAnimate
        transition?: MotionTransition
        style?: string
        [key: string]: unknown
    }

    let {
        children,
        tag = 'div',
        initial: initialProp,
        animate: animateProp,
        transition: transitionProp,
        style: styleProp,
        ...rest
    }: Props = $props()
    let element: HTMLElement | null = $state(null)

    const runAnimation = () => {
        if (!element || !animateProp) return
        const transitionAmimate = {
            ...(transitionProp ?? {})
        }
        animate(element, animateProp, transitionAmimate)
    }

    $effect(() => {
        if (element && animateProp) {
            if (isNotEmpty(initialProp)) {
                animate(element, initialProp!)
                    .then(() => {
                        if (element && styleProp) {
                            setTimeout(() => {
                                element.style.cssText = styleProp
                            }, 1)
                        }
                    })
                    .then(runAnimation)
            } else {
                runAnimation()
            }
        }
    })
</script>

<svelte:element this={tag} bind:this={element} {...rest}>
    {@render children?.()}
</svelte:element>
