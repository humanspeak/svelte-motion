<script lang="ts">
    import { motion, useAnimationFrame, useMotionValue, useSpring } from '@humanspeak/svelte-motion'
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
    class="w-full max-w-[26rem]"
    whileHover={armed || deleted ? undefined : { x: 2 }}
    transition={{ type: 'spring', stiffness: 520, damping: 32 }}
>
    <button
        type="button"
        disabled={locked || deleted}
        class="relative flex h-12 w-full overflow-hidden items-center gap-3 rounded-lg border px-4 text-sm leading-none font-semibold shadow-sm transition-colors duration-200 {deleted
            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : armed
              ? 'border-destructive bg-destructive text-destructive-foreground'
              : 'border-border/70 bg-background/95 text-foreground hover:bg-muted'} disabled:cursor-not-allowed disabled:opacity-100"
        onclick={handleClick}
        data-testid="delete-wait-button"
        data-armed={armed}
        data-locked={locked}
        data-deleted={deleted}
    >
        {#if armed && !deleted && !deleting}
            <motion.span
                key={secondsLeft > 0 ? 'delete-disarm-meter-wait' : 'delete-disarm-meter-ready'}
                class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current/45"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: secondsLeft > 0 ? 1 : 0 }}
                transition={{ duration: secondsLeft > 0 ? 0 : disarmMeterSeconds, ease: 'linear' }}
                aria-hidden="true"
                data-testid="delete-disarm-meter"
            />
        {/if}

        {#key deleted ? 'done' : locked ? 'locked' : armed ? 'ready' : 'idle'}
            <motion.span
                class="inline-flex size-5 shrink-0 items-center justify-center"
                initial={{ opacity: 0, scale: 0.6, rotate: locked ? -30 : 0 }}
                animate={{ opacity: 1, scale: locked ? [1, 1.12, 1] : 1 }}
                style={locked ? { rotate: spinRotate } : undefined}
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
                    <Trash2 size={17} class={armed ? '' : 'text-destructive'} />
                {/if}
            </motion.span>
        {/key}

        <span class="min-w-0 flex-1 text-left">
            {#if deleted}
                Deleted
            {:else}
                <span
                    class="block text-[0.65rem] leading-[1.15] font-semibold tracking-[0.16em] text-current/55 uppercase"
                >
                    {eyebrow}
                </span>
                <span class="mt-0.5 block leading-[1.25]">{title}</span>
            {/if}
        </span>

        <span class="flex w-16 justify-end">
            {#if armed && secondsLeft > 0}
                {#key secondsLeft}
                    <motion.span
                        class="inline-flex items-center leading-none tabular-nums"
                        initial={{ y: -7, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
                        data-testid="delete-countdown"
                    >
                        {secondsLeft}
                    </motion.span>
                {/key}
            {:else if armed && !deleted}
                <span
                    class="relative top-px inline-flex items-center text-xs leading-none tracking-[0.16em] uppercase"
                    data-testid="delete-ready"
                >
                    Ready
                </span>
            {/if}
        </span>
    </button>
</motion.div>
