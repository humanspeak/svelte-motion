<script lang="ts">
    import { motion } from '$lib'
    import { pwLog } from '$lib/utils/log'
    import ModeExample from './ModeExample.svelte'
    import SyncIcon from './SyncIcon.svelte'
    import WaitIcon from './WaitIcon.svelte'
    // import PopLayoutIcon from './PopLayoutIcon.svelte'

    let internalState = $state(true)

    const switchItems = () => {
        console.log('[AnimatePresenceModes] switchItems', {
            from: internalState,
            to: !internalState
        })
        pwLog('[AnimatePresenceModes] switchItems', { from: internalState, to: !internalState })
        internalState = !internalState
    }

    // Styles matching React example
    const container = `
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 40px;
        color: #f5f5f5;
        border-radius: 12px;
        padding: 40px;
        min-height: 100vh;
        background: #0f1115;
    `

    const modesContainer = `
        display: flex;
        gap: 60px;
        justify-content: center;
        align-items: center;
        width: 100%;
    `

    const button = `
        background-color: #f5f5f5;
        color: #0f1115;
        border: none;
        border-radius: 8px;
        padding: 12px 32px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        outline: none;
    `

    pwLog('[AnimatePresenceModes] Page mounted', { state: $state.snapshot(internalState) })
</script>

<div style={container} data-testid="modes-container">
    <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 20px;">AnimatePresence Modes</h1>

    <div style={modesContainer}>
        <ModeExample mode="sync" state={internalState}>
            {#snippet icon()}
                <SyncIcon />
            {/snippet}
        </ModeExample>

        <ModeExample mode="wait" state={internalState}>
            {#snippet icon()}
                <WaitIcon />
            {/snippet}
        </ModeExample>

        <!-- <ModeExample mode="popLayout" state={internalState}>
            {#snippet icon()}
                <PopLayoutIcon />
            {/snippet}
        </ModeExample> -->
    </div>

    <motion.button
        style={button}
        onclick={switchItems}
        whileTap={{ scale: 0.95 }}
        data-testid="switch-button"
    >
        Switch
    </motion.button>

    <!-- Debug info -->
    <div style="margin-top: 20px; font-size: 12px; opacity: 0.6;">
        Current state: <code data-testid="current-state">{internalState}</code>
    </div>
</div>
