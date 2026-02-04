<script lang="ts">
    import { motion, styleString } from '@humanspeak/svelte-motion'
    import { animate } from 'motion'
    import { type BadgeState } from './constants'
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
                    delay: 0.1
                }
            )
        } else if (badgeState === 'success') {
            animate(
                badgeElement,
                { scale: [1, 1.2, 1] },
                {
                    duration: 0.3,
                    ease: 'easeInOut'
                }
            )
        }
    })
</script>

<motion.div
    bind:ref={badgeElement}
    style={styleString(() => ({
        backgroundColor: '#f5f5f5',
        color: '#0f1115',
        display: 'flex',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 20px',
        borderRadius: 999,
        willChange: 'transform, filter',
        gap: badgeState === 'idle' ? 0 : 8
    }))}
>
    <Icon state={badgeState} />
    <Label {badgeState} />
</motion.div>
