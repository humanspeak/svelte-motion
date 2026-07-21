<script lang="ts">
    import {
        motion,
        styleString,
        useAnimationFrame,
        useMotionValue,
        useSpring
    } from '@humanspeak/svelte-motion'
    import { Check, LoaderCircle, Trash2 } from '@lucide/svelte'

    interface Props {
        title?: string
        eyebrow?: string
        armed?: boolean
        countdownSeconds?: number
        disarmAfterMs?: number
        onArm?: () => void
        onDisarm?: () => void
        onDelete?: () => void
    }

    const {
        title = 'Delete workspace',
        eyebrow = 'Danger action',
        armed: controlledArmed,
        countdownSeconds = 3,
        disarmAfterMs = 10000,
        onArm,
        onDisarm,
        onDelete
    }: Props = $props()

    let armedState = $state(false)
    let secondsLeft = $state(0)
    let deleting = $state(false)
    let deleted = $state(false)

    const armed = $derived(controlledArmed ?? armedState)
    const locked = $derived((armed && secondsLeft > 0) || deleting)
    const disarmMeterSeconds = $derived(
        Math.max((disarmAfterMs - countdownSeconds * 1000) / 1000, 0.1)
    )
    const spinTarget = useMotionValue(0)
    const spinRotate = useSpring(spinTarget, { stiffness: 220, damping: 18, mass: 0.8 })

    let spinStartedAt: number | undefined
    let nextSpinAt = 0
    let spinTurns = 0

    // Motion-driven color state: idle / armed (danger) / deleted (accent).
    const rowColors = $derived(
        deleted
            ? {
                  backgroundColor: 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))',
                  borderColor: 'var(--brut-accent, #247768)',
                  color: 'var(--brut-accent, #247768)'
              }
            : armed
              ? {
                    backgroundColor: 'var(--armed-danger, #b91c1c)',
                    borderColor: 'var(--armed-danger, #b91c1c)',
                    color: 'var(--brut-accent-ink, #f8fcfb)'
                }
              : {
                    backgroundColor: 'var(--brut-bg-2, #eef4f1)',
                    borderColor: 'var(--brut-rule-2, #bbc4c0)',
                    color: 'var(--brut-ink, #0a0a0a)'
                }
    )

    useAnimationFrame((time) => {
        if (!locked) {
            spinStartedAt = undefined
            nextSpinAt = 0
            spinTurns = 0
            spinTarget.jump(0)
            return
        }

        spinStartedAt ??= time
        if (time < nextSpinAt) return

        spinTurns += 1
        spinTarget.set(spinTurns * 720)
        nextSpinAt = time + 1180
    })

    $effect(() => {
        if (!armed) return

        secondsLeft = countdownSeconds
        const ticker = window.setInterval(() => {
            secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : 0
        }, 1000)
        const disarm = window.setTimeout(() => {
            if (!deleting && !deleted) {
                if (controlledArmed === undefined) {
                    armedState = false
                } else {
                    onDisarm?.()
                }
            }
        }, disarmAfterMs)

        return () => {
            window.clearInterval(ticker)
            window.clearTimeout(disarm)
        }
    })

    const handleClick = () => {
        if (deleted) return
        if (!armed) {
            if (controlledArmed === undefined) {
                armedState = true
            } else {
                onArm?.()
            }
            return
        }
        if (locked) return

        deleting = true
        window.setTimeout(() => {
            deleting = false
            deleted = true
            armedState = false
            onDisarm?.()
            onDelete?.()
        }, 520)
    }
</script>

<motion.div
    whileHover={armed || deleted ? undefined : { x: 2 }}
    transition={{ type: 'spring', stiffness: 520, damping: 32 }}
    style={styleString(() => ({
        width: '100%',
        maxWidth: '26rem'
    }))}
>
    <motion.button
        type="button"
        disabled={locked || deleted}
        onclick={handleClick}
        data-testid="delete-wait-button"
        data-armed={armed}
        data-locked={locked}
        data-deleted={deleted}
        animate={rowColors}
        whileHover={armed || deleted ? undefined : { backgroundColor: 'var(--brut-bg, #f8fcfb)' }}
        transition={{ type: 'spring', stiffness: 520, damping: 32 }}
        style={styleString(() => ({
            position: 'relative',
            display: 'flex',
            height: '3rem',
            width: '100%',
            overflow: 'hidden',
            alignItems: 'center',
            gap: '0.75rem',
            borderWidth: '1px',
            borderStyle: 'solid',
            padding: '0 1rem',
            fontSize: '0.8125rem',
            lineHeight: 1,
            fontWeight: 600,
            boxShadow: '6px 6px 0 var(--brut-rule, #d6dedb)',
            cursor: locked || deleted ? 'not-allowed' : 'pointer'
        }))}
    >
        {#if armed && !deleted && !deleting}
            <motion.span
                key={secondsLeft > 0 ? 'delete-disarm-meter-wait' : 'delete-disarm-meter-ready'}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: secondsLeft > 0 ? 1 : 0 }}
                transition={{ duration: secondsLeft > 0 ? 0 : disarmMeterSeconds, ease: 'linear' }}
                aria-hidden="true"
                data-testid="delete-disarm-meter"
                style={styleString(() => ({
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: '2px',
                    transformOrigin: 'left',
                    background: 'currentColor',
                    opacity: 0.45,
                    pointerEvents: 'none'
                }))}
            />
        {/if}

        {#key deleted ? 'done' : locked ? 'locked' : armed ? 'ready' : 'idle'}
            <motion.span
                initial={{ opacity: 0, scale: 0.6, rotate: locked ? -30 : 0 }}
                animate={{ opacity: 1, scale: locked ? [1, 1.12, 1] : 1 }}
                style={{
                    display: 'inline-flex',
                    width: '1.25rem',
                    height: '1.25rem',
                    flex: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(!armed && !deleted ? { color: 'var(--armed-danger, #b91c1c)' } : {}),
                    ...(locked ? { rotate: spinRotate } : {})
                }}
                transition={{
                    type: locked ? 'tween' : 'spring',
                    duration: locked ? 0.42 : undefined,
                    ease: locked ? 'easeOut' : undefined,
                    stiffness: locked ? undefined : 520,
                    damping: locked ? undefined : 30
                }}
                data-testid="delete-icon-state"
            >
                {#if deleted}
                    <Check size={17} />
                {:else if locked}
                    <LoaderCircle size={17} />
                {:else}
                    <Trash2 size={17} />
                {/if}
            </motion.span>
        {/key}

        <span class="label">
            {#if deleted}
                Deleted
            {:else}
                <span class="eyebrow">{eyebrow}</span>
                <span class="title">{title}</span>
            {/if}
        </span>

        <span class="trail">
            {#if armed && secondsLeft > 0}
                {#key secondsLeft}
                    <motion.span
                        initial={{ y: -7, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                        data-testid="delete-countdown"
                        style={styleString(() => ({
                            display: 'inline-flex',
                            alignItems: 'center',
                            lineHeight: 1,
                            fontVariantNumeric: 'tabular-nums'
                        }))}
                    >
                        {secondsLeft}
                    </motion.span>
                {/key}
            {:else if armed && !deleted}
                <span class="ready" data-testid="delete-ready">Ready</span>
            {/if}
        </span>
    </motion.button>
</motion.div>

<style>
    .label {
        min-width: 0;
        flex: 1;
        text-align: left;
    }

    .eyebrow {
        display: block;
        font-family: var(--brut-mono, monospace);
        font-size: 0.625rem;
        line-height: 1.15;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        opacity: 0.62;
    }

    .title {
        display: block;
        margin-top: 0.125rem;
        line-height: 1.25;
    }

    .trail {
        display: flex;
        width: 4rem;
        justify-content: flex-end;
    }

    .ready {
        position: relative;
        top: 1px;
        display: inline-flex;
        align-items: center;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        line-height: 1;
        letter-spacing: 0.16em;
        text-transform: uppercase;
    }
</style>
