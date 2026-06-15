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
        gap: 14px;
        width: 260px;
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

    const modeNote = `
        min-height: 48px;
        max-width: 240px;
        margin: 0;
        color: #b8c0cc;
        font-size: 12px;
        line-height: 1.35;
        text-align: center;
    `

    const flowStage = `
        position: relative;
        width: 240px;
        padding: 12px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 10px;
        background:
            linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px) 0 0 / 40px 100%,
            rgba(255, 255, 255, 0.04);
        overflow: visible;
    `

    const flowRow = `
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
    `

    const staticPill = `
        width: 64px;
        height: 36px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #0f1115;
        background: #8bd3ff;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        flex: 0 0 auto;
    `

    const middlePill = `
        ${staticPill}
        background: #f0a6ff;
    `

    const gapMarker = `
        position: absolute;
        top: 12px;
        left: 84px;
        width: 64px;
        height: 36px;
        border: 1px dashed rgba(240, 166, 255, 0.45);
        border-radius: 999px;
        pointer-events: none;
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

    const getFlowExit = () => ({
        opacity: 0,
        scale: 0.8,
        x: mode === 'popLayout' ? 12 : 0,
        transition: {
            duration: 0.6,
            ease: defaultEase
        }
    })

    const iconNote = $derived(
        mode === 'popLayout'
            ? 'Icon swap: enter and exit overlap, and the exiting icon is popped out of layout.'
            : mode === 'sync'
              ? 'Icon swap: enter and exit run together, so this should visually overlap like popLayout.'
              : 'Icon swap: enter waits until the old icon finishes exiting.'
    )

    const flowNote = $derived(
        mode === 'popLayout'
            ? 'Layout row: MID fades as an overlay; RIGHT should move into the dashed slot immediately.'
            : mode === 'sync'
              ? 'Layout row: MID keeps its layout slot while fading; RIGHT should wait, then move after exit.'
              : 'Layout row: enter waits in swaps; here the slot also stays until exit completes.'
    )

    const logRender = () => pwLog('[ModeExample] render', { mode, state })
    logRender()
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
    <p style={modeNote} data-testid="mode-note-{mode}">
        {iconNote}<br />{flowNote}
    </p>

    <div style={flowStage} data-testid="flow-stage-{mode}">
        <div style={gapMarker} aria-hidden="true"></div>
        <div style={flowRow} data-testid="flow-row-{mode}">
            <div style={staticPill}>LEFT</div>
            <AnimatePresence {mode}>
                {#if state}
                    <motion.div
                        key="{mode}-middle"
                        style={middlePill}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={getFlowExit()}
                        transition={{ duration: 0.35, ease: defaultEase }}
                        data-testid="flow-middle-{mode}"
                    >
                        MID
                    </motion.div>
                {/if}
            </AnimatePresence>
            <motion.div
                style={staticPill}
                layout
                transition={{ duration: 0.35, ease: defaultEase }}
                data-testid="flow-right-{mode}"
            >
                RIGHT
            </motion.div>
        </div>
    </div>
</div>
