<script lang="ts">
    import { motion, stringifyStyleObject, type Variants } from '$lib'

    const N_NOTIFICATIONS = 3
    const NOTIFICATION_HEIGHT = 60
    const NOTIFICATION_WIDTH = 280
    const NOTIFICATION_GAP = 8

    type Props = {
        index: number
        onclick: () => void
    }

    let { index, onclick }: Props = $props()

    const variants: Variants = {
        open: {
            y: 0,
            scale: 1,
            opacity: 1,
            pointerEvents: 'auto',
            cursor: 'pointer'
        },
        closed: {
            y: -index * (NOTIFICATION_HEIGHT + 2 * NOTIFICATION_GAP),
            scale: 1 - index * 0.1,
            opacity: 1 - index * 0.4,
            pointerEvents: index === 0 ? 'auto' : 'none',
            cursor: index === 0 ? 'pointer' : 'default'
        }
    }

    const getNotificationStyle = (index: number): string => {
        return stringifyStyleObject({
            height: NOTIFICATION_HEIGHT,
            width: NOTIFICATION_WIDTH,
            backgroundColor: `#f5f5f5`,
            borderRadius: 16,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: N_NOTIFICATIONS - index,
            userSelect: 'none'
        })
    }

    const notificationStyle = $derived(getNotificationStyle(index))
</script>

<motion.div
    {variants}
    transition={{
        type: 'spring',
        stiffness: 600,
        damping: 50,
        delay: index * 0.04
    }}
    style={notificationStyle}
    data-testid={`notification-${index}`}
    {onclick}
/>
