<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
    import { animate } from 'motion'
    import { styles, type BadgeState } from './constants'
    import Icon from './Icon.svelte'
    import Label from './Label.svelte'

    type Props = {
        state: BadgeState
    }

    const { state: badgeState }: Props = $props()

    let badgeElement: HTMLElement | null = $state(null)

    // Trigger shake/scale animations on state change
    $effect(() => {
        if (!badgeElement) return

        if (badgeState === 'error') {
            animate(
                badgeElement,
                { x: [0, -6, 6, -6, 0] },
                {
                    duration: 0.3,
                    ease: 'easeInOut',
                    times: [0, 0.25, 0.5, 0.75, 1],
                    repeat: 0,
                    delay: 0.1
                }
            )
        } else if (badgeState === 'success') {
            animate(
                badgeElement,
                { scale: [1, 1.2, 1] },
                {
                    duration: 0.3,
                    ease: 'easeInOut',
                    times: [0, 0.5, 1],
                    repeat: 0
                }
            )
        }
    })
</script>

<motion.div
    bind:ref={badgeElement}
    style={styleString(() => ({
        ...styles.badge,
        gap: badgeState === 'idle' ? 0 : 8
    }))}
>
    <Icon state={badgeState} />
    <Label {badgeState} />
</motion.div>
