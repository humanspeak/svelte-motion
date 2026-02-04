<!--
  @component
  A multi-state badge that cycles through idle, processing, success, and error states.
  Demonstrates AnimatePresence, useTime, useTransform, SVG pathLength animations,
  and imperative animate() calls for shake/scale effects.

  NOTE: Due to a namespace issue with motion SVG elements inside AnimatePresence,
  we use imperative animate() for SVG path animations. This is tracked as a bug to fix.
-->
<script lang="ts">
    import {
        motion,
        AnimatePresence,
        useTime,
        useTransform,
        stringifyStyleObject
    } from '@humanspeak/svelte-motion'
    import { animate } from 'motion'

    type BadgeState = keyof typeof STATES

    const STATES = {
        idle: 'Start',
        processing: 'Processing',
        success: 'Done',
        error: 'Something went wrong'
    } as const

    const SPRING_CONFIG = {
        type: 'spring' as const,
        stiffness: 600,
        damping: 30
    }

    const ICON_SPRING = {
        type: 'spring' as const,
        stiffness: 150,
        damping: 20
    }

    const ICON_SIZE = 20
    const STROKE_WIDTH = 1.5

    let badgeState = $state<BadgeState>('idle')
    let badgeElement: HTMLDivElement | null = $state(null)
    let measureElement: HTMLDivElement | null = $state(null)
    let labelWidth = $state(0)

    // SVG element refs for imperative animation
    let loaderPathRef: SVGPathElement | null = $state(null)
    let checkPathRef: SVGPolylineElement | null = $state(null)
    let xLine1Ref: SVGLineElement | null = $state(null)
    let xLine2Ref: SVGLineElement | null = $state(null)

    // For the loader rotation
    const time = useTime()
    const rotate = useTransform(time, [0, 1000], [0, 360], { clamp: false })

    function getNextState(state: BadgeState): BadgeState {
        const states = Object.keys(STATES) as BadgeState[]
        const nextIndex = (states.indexOf(state) + 1) % states.length
        return states[nextIndex]
    }

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

    // Animate loader path when it appears
    $effect(() => {
        if (loaderPathRef && badgeState === 'processing') {
            loaderPathRef.setAttribute('pathLength', '1')
            animate(loaderPathRef, { strokeDasharray: ['0px 1px', '1px 0px'] }, ICON_SPRING)
        }
    })

    // Animate check path when it appears
    $effect(() => {
        if (checkPathRef && badgeState === 'success') {
            checkPathRef.setAttribute('pathLength', '1')
            animate(checkPathRef, { strokeDasharray: ['0px 1px', '1px 0px'] }, ICON_SPRING)
        }
    })

    // Animate X lines when they appear
    $effect(() => {
        if (xLine1Ref && xLine2Ref && badgeState === 'error') {
            xLine1Ref.setAttribute('pathLength', '1')
            xLine2Ref.setAttribute('pathLength', '1')
            animate(xLine1Ref, { strokeDasharray: ['0px 1px', '1px 0px'] }, ICON_SPRING)
            animate(
                xLine2Ref,
                { strokeDasharray: ['0px 1px', '1px 0px'] },
                { ...ICON_SPRING, delay: 0.1 }
            )
        }
    })

    // Measure label width when state changes
    $effect(() => {
        // Access badgeState to create reactive dependency for re-measurement
        void badgeState
        if (measureElement) {
            const { width } = measureElement.getBoundingClientRect()
            labelWidth = width
        }
    })
</script>

<div
    style={stringifyStyleObject({
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        minHeight: 200
    })}
>
    <button
        onclick={() => {
            badgeState = getNextState(badgeState)
        }}
        style="background: none; border: none; cursor: pointer; padding: 0;"
    >
        <!-- Badge -->
        <motion.div
            bind:ref={badgeElement}
            style={stringifyStyleObject({
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
            })}
        >
            <!-- Icon Container -->
            <motion.span
                style={stringifyStyleObject({
                    height: 20,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                })}
                animate={{
                    width: badgeState === 'idle' ? 0 : 20
                }}
                transition={SPRING_CONFIG}
            >
                <AnimatePresence>
                    <motion.span
                        key={badgeState}
                        style={stringifyStyleObject({
                            position: 'absolute',
                            left: 0,
                            top: 0
                        })}
                        initial={{
                            y: -40,
                            scale: 0.5,
                            filter: 'blur(6px)'
                        }}
                        animate={{
                            y: 0,
                            scale: 1,
                            filter: 'blur(0px)'
                        }}
                        exit={{
                            y: 40,
                            scale: 0.5,
                            filter: 'blur(6px)'
                        }}
                        transition={{
                            duration: 0.15,
                            ease: 'easeInOut'
                        }}
                    >
                        {#if badgeState === 'processing'}
                            <!-- Loader Icon -->
                            <motion.div
                                key="loader"
                                style={`rotate: ${$rotate}deg; display: flex; align-items: center; justify-content: center; width: ${ICON_SIZE}px; height: ${ICON_SIZE}px;`}
                            >
                                <svg
                                    width={ICON_SIZE}
                                    height={ICON_SIZE}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width={STROKE_WIDTH}
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        bind:this={loaderPathRef}
                                        d="M21 12a9 9 0 1 1-6.219-8.56"
                                        stroke-dasharray="0px 1px"
                                    />
                                </svg>
                            </motion.div>
                        {:else if badgeState === 'success'}
                            <!-- Check Icon -->
                            <svg
                                width={ICON_SIZE}
                                height={ICON_SIZE}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width={STROKE_WIDTH}
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <polyline
                                    bind:this={checkPathRef}
                                    points="4 12 9 17 20 6"
                                    stroke-dasharray="0px 1px"
                                />
                            </svg>
                        {:else if badgeState === 'error'}
                            <!-- X Icon -->
                            <svg
                                width={ICON_SIZE}
                                height={ICON_SIZE}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width={STROKE_WIDTH}
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <line
                                    bind:this={xLine1Ref}
                                    x1="6"
                                    y1="6"
                                    x2="18"
                                    y2="18"
                                    stroke-dasharray="0px 1px"
                                />
                                <line
                                    bind:this={xLine2Ref}
                                    x1="18"
                                    y1="6"
                                    x2="6"
                                    y2="18"
                                    stroke-dasharray="0px 1px"
                                />
                            </svg>
                        {/if}
                    </motion.span>
                </AnimatePresence>
            </motion.span>

            <!-- Label -->
            <!-- Hidden copy of label to measure width -->
            <div
                bind:this={measureElement}
                style={stringifyStyleObject({
                    position: 'absolute',
                    visibility: 'hidden',
                    whiteSpace: 'nowrap'
                })}
            >
                {STATES[badgeState]}
            </div>

            <motion.span
                style={stringifyStyleObject({
                    position: 'relative'
                })}
                initial={false}
                animate={{
                    width: labelWidth
                }}
                transition={SPRING_CONFIG}
            >
                <AnimatePresence initial={false}>
                    <motion.div
                        key={badgeState}
                        style={stringifyStyleObject({
                            whiteSpace: 'nowrap'
                        })}
                        initial={{
                            y: -20,
                            opacity: 0,
                            filter: 'blur(10px)',
                            position: 'absolute'
                        }}
                        animate={{
                            y: 0,
                            opacity: 1,
                            filter: 'blur(0px)',
                            position: 'relative'
                        }}
                        exit={{
                            y: 20,
                            opacity: 0,
                            filter: 'blur(10px)',
                            position: 'absolute'
                        }}
                        transition={{
                            duration: 0.2,
                            ease: 'easeInOut'
                        }}
                    >
                        {STATES[badgeState]}
                    </motion.div>
                </AnimatePresence>
            </motion.span>
        </motion.div>
    </button>

    <div
        style={stringifyStyleObject({
            marginTop: '2rem',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary, #888)'
        })}
    >
        Click badge to cycle states
    </div>
</div>
