import type { MotionTransition } from '@humanspeak/svelte-motion'

export const STATES = {
    idle: 'Start',
    processing: 'Processing',
    success: 'Done',
    error: 'Something went wrong'
} as const

export type BadgeState = keyof typeof STATES

export const SPRING_CONFIG: MotionTransition = {
    type: 'spring',
    stiffness: 600,
    damping: 30
}

export const ICON_SIZE = 20
export const STROKE_WIDTH = 1.5
export const VIEW_BOX_SIZE = 24

export const svgProps = {
    width: ICON_SIZE,
    height: ICON_SIZE,
    viewBox: `0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': STROKE_WIDTH,
    'stroke-linecap': 'round' as const,
    'stroke-linejoin': 'round' as const
}

const springConfig: MotionTransition = {
    type: 'spring',
    stiffness: 150,
    damping: 20
}

export const animations = {
    initial: { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: springConfig
}

export const secondLineAnimation = {
    ...animations,
    transition: { ...springConfig, delay: 0.1 }
}

export function getNextState(state: BadgeState): BadgeState {
    const states = Object.keys(STATES) as BadgeState[]
    const nextIndex = (states.indexOf(state) + 1) % states.length
    return states[nextIndex]
}

/**
 * ==============   Styles   ================
 * Matches the React example exactly
 */
export const styles = {
    container: {
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        height: 80
    },
    badge: {
        backgroundColor: '#f5f5f5',
        color: '#0f1115',
        display: 'flex',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px 20px',
        borderRadius: 999,
        willChange: 'transform, filter'
    },
    iconContainer: {
        height: 20,
        position: 'relative' as const,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
    },
    icon: {
        position: 'absolute' as const,
        left: 0,
        top: 0
    }
} as const
