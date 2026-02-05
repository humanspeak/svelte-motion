<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { AnimatePresenceMode } from '$lib/types'
    import { motion, AnimatePresence } from '$lib'
    import { pwLog } from '$lib/utils/log'

    const { mode, icon, state } = $props<{
        mode: AnimatePresenceMode
        icon: Snippet
        state: boolean
    }>()

    const defaultEase = [0.26, 0.02, 0.23, 0.94] as [number, number, number, number]

    // Styles matching React example
    const modeSection = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
    `

    const iconContainer = `
        width: 80px;
        height: 80px;
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    `

    const modeTitle = `
        font-size: 14px;
        font-weight: 500;
        color: #f5f5f5;
        opacity: 0.9;
    `

    const baseCircleStyle = `
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        will-change: transform;
        box-sizing: border-box;
        flex-shrink: 0;
    `

    // Computed style based on state
    const getCircleStyle = (currentState: boolean) => `
        ${baseCircleStyle}
        background-color: ${currentState ? '#f5f5f5' : 'transparent'};
        color: ${currentState ? '#0f1115' : '#f5f5f5'};
        border: ${currentState ? '2px solid #1d2628' : '2px solid #f5f5f5'};
    `

    // Ease values matching React example
    const getAnimateEase = (): [number, number, number, number] => {
        return mode === 'wait' ? [0.02, 0.35, 0.25, 0.99] : defaultEase
    }

    const getExitEase = (): [number, number, number, number] => {
        return mode === 'wait' ? [0.46, 0.04, 0.97, 0.44] : defaultEase
    }

    // Get transition config with mode-appropriate ease
    const getTransition = () => ({
        duration: 0.3,
        ease: getAnimateEase()
    })

    // Get exit config with keyframes and transition
    const getExit = () => ({
        opacity: 0,
        scale: 0.8,
        transition: {
            duration: 0.3,
            ease: getExitEase()
        }
    })

    console.log('[ModeExample] render', { mode, state })
    pwLog('[ModeExample] render', { mode, state })
</script>

<div style={modeSection} data-testid="mode-section-{mode}">
    <div style={iconContainer}>
        <AnimatePresence {mode}>
            {#key state}
                <motion.div
                    key={String(state)}
                    style={getCircleStyle(state)}
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={getExit()}
                    transition={getTransition()}
                    data-testid="{mode}-circle"
                >
                    {@render icon()}
                </motion.div>
            {/key}
        </AnimatePresence>
    </div>
    <code style={modeTitle} data-testid="mode-label-{mode}">{mode}</code>
</div>
