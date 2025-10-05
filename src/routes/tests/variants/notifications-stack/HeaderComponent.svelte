<script lang="ts">
    import { motion, stringifyStyleObject, type Variants } from '$lib'

    type Props = {
        isOpen: boolean
        onClose: () => void
    }

    let { isOpen, onClose }: Props = $props()

    const variants: Variants = {
        open: {
            y: 0,
            scale: 1,
            opacity: 1
        },
        closed: {
            y: 60,
            scale: 0.8,
            opacity: 0
        }
    }
</script>

<motion.div
    style={stringifyStyleObject({
        position: 'absolute',
        top: '-40px',
        left: '0',
        height: '28px',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transformOrigin: 'bottom center',
        pointerEvents: 'none'
    })}
    {variants}
    transition={{
        type: 'spring',
        stiffness: 600,
        damping: 50,
        delay: isOpen ? 0.2 : 0
    }}
>
    <motion.h2
        style={stringifyStyleObject({
            fontSize: 18,
            lineHeight: 1,
            marginLeft: 8
        })}
    >
        Notifications
    </motion.h2>
    <motion.button
        style={stringifyStyleObject({
            fontSize: '14px',
            lineHeight: 1,
            marginRight: '8px',
            backgroundColor: '#fff',
            color: '#1f1f1f',
            padding: '4px 12px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '16px',
            cursor: 'pointer',
            pointerEvents: 'auto',
            userSelect: 'none'
        })}
        whileHover={{
            backgroundColor: '#f5f5f5',
            color: '#0f1115'
        }}
        onclick={onClose}
    >
        Collapse
    </motion.button>
</motion.div>
