<!--
  @component
  A multi-state badge that cycles through idle, processing, success, and error states.
  Demonstrates AnimatePresence, useTime, useTransform, SVG pathLength animations,
  and imperative animate() calls for shake/scale effects.

  Ported from: https://examples.motion.dev/react/multi-state-badge
-->
<script lang="ts">
    import { styleString } from '@humanspeak/svelte-motion'
    import Badge from './multi-state-badge/Badge.svelte'
    import { getNextState, styles, type BadgeState } from './multi-state-badge/constants'

    let badgeState = $state<BadgeState>('idle')

    // DEBUG: Track animated elements via data attributes (for debug UI)
    let iconFilter = $state('none')
    let iconTransform = $state('none')
    let labelFilter = $state('none')
    let labelOpacity = $state('1')
    let labelTransform = $state('none')

    // DEBUG: Poll for style changes during animation (for debug UI)
    $effect(() => {
        const pollStyles = () => {
            const iconEl = document.querySelector('[data-debug="icon-motion"]') as HTMLElement
            const labelEl = document.querySelector('[data-debug="label-motion"]') as HTMLElement

            if (iconEl) {
                const computed = getComputedStyle(iconEl)
                iconFilter = computed.filter || 'none'
                iconTransform = computed.transform || 'none'
            }
            if (labelEl) {
                const computed = getComputedStyle(labelEl)
                labelFilter = computed.filter || 'none'
                labelOpacity = computed.opacity || '1'
                labelTransform = computed.transform || 'none'
            }
        }

        // Poll frequently to catch animation values
        const interval = setInterval(pollStyles, 16) // ~60fps
        pollStyles() // Initial read

        return () => clearInterval(interval)
    })
</script>

<!-- DEBUG: Display current filter values (outside button) -->
<div
    style="display:none; position: fixed; top: 10px; left: 10px; background: rgba(0,0,0,0.9); color: white; padding: 12px; font-family: monospace; font-size: 11px; z-index: 9999; border-radius: 6px; max-width: 350px; line-height: 1.5;"
>
    <div style="color: lime; font-weight: bold; margin-bottom: 8px;">Icon Debug</div>
    <div>State: <span style="color: yellow;">{badgeState}</span></div>
    <div>
        Filter: <span style="color: {iconFilter !== 'none' ? 'lime' : 'red'};">{iconFilter}</span>
    </div>
    <div>Transform: <span style="color: #888;">{iconTransform}</span></div>
    <div style="margin-top: 4px; font-size: 10px; color: #666;">
        Expected: blur(6px) → blur(0px) on enter
    </div>

    <hr style="border: none; border-top: 1px solid #444; margin: 12px 0;" />

    <div style="color: cyan; font-weight: bold; margin-bottom: 8px;">Label Debug</div>
    <div>State: <span style="color: yellow;">{badgeState}</span></div>
    <div>
        Filter: <span style="color: {labelFilter !== 'none' ? 'lime' : 'red'};">{labelFilter}</span>
    </div>
    <div>Opacity: <span style="color: #888;">{labelOpacity}</span></div>
    <div>Transform: <span style="color: #888;">{labelTransform}</span></div>
    <div style="margin-top: 4px; font-size: 10px; color: #666;">
        Expected: blur(10px) → blur(0px) on enter
    </div>
</div>

<div style={styleString(() => styles.container)}>
    <button
        onclick={() => {
            badgeState = getNextState(badgeState)
        }}
        style="background: none; border: none; cursor: pointer; padding: 0;"
    >
        <Badge state={badgeState} />
    </button>
</div>
