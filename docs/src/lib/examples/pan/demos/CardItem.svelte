<script lang="ts">
    import {
        animate,
        motion,
        styleString,
        useMotionValue,
        useSpring,
        useTransform
    } from '@humanspeak/svelte-motion'

    type Card = { id: number; name: string; line: string; emoji: string; from: string; to: string }

    type Props = {
        card: Card
        isTop: boolean
        depthY: number
        depthRotate: number
        depthScale: number
        zIndex: number
        /**
         * Called once this card has been flung off-screen on a committed
         * swipe — the parent's cue to remove it from the deck. Snap-home
         * releases (offset/velocity below threshold) don't fire this.
         */
        onCommit: () => void
    }

    const { card, isTop, depthY, depthRotate, depthScale, zIndex, onCommit }: Props = $props()

    // Decision thresholds — either pass the distance bar OR fling fast
    // enough to commit. Local to the card because each card owns its own
    // pan lifecycle now.
    const COMMIT_OFFSET_PX = 140
    const COMMIT_VELOCITY_PX_S = 650

    // Per-card pan state. The big win over a shared parent-owned `x`
    // MotionValue: when this card flies off on commit, its `x` stays at
    // ±600 until the parent unmounts it via `deck.slice(1)`. The next-up
    // card has its own local `x = 0` from its own mount — no one-frame
    // flash of the outgoing card snapping back to centre while the
    // unmount is queued.
    const x = useMotionValue(0)
    const rotate = useTransform(x, [-200, 0, 200], [-18, 0, 18])
    const likeOpacity = useTransform(x, [40, 140], [0, 1])
    const nopeOpacity = useTransform(x, [-140, -40], [1, 0])

    // Depth springs settle on the (depthY, depthRotate, depthScale) targets
    // when this card's stack index changes — e.g. promoted from behind →
    // top after a swipe. No CSS transitions: we're a motion library, MV
    // springs do the work.
    const ySpring = useSpring(depthY, { stiffness: 320, damping: 30 })
    const rotateSpring = useSpring(depthRotate, { stiffness: 320, damping: 30 })
    const scaleSpring = useSpring(depthScale, { stiffness: 320, damping: 30 })

    $effect(() => {
        ySpring.set(depthY)
    })
    $effect(() => {
        rotateSpring.set(depthRotate)
    })
    $effect(() => {
        scaleSpring.set(depthScale)
    })

    const handlePan = (_event: PointerEvent, info: { offset: { x: number } }) => {
        x.set(info.offset.x)
    }

    const handlePanEnd = (
        _event: PointerEvent,
        info: { offset: { x: number }; velocity: { x: number } }
    ) => {
        const passDistance = Math.abs(info.offset.x) > COMMIT_OFFSET_PX
        const passVelocity = Math.abs(info.velocity.x) > COMMIT_VELOCITY_PX_S
        // Prefer the velocity's sign when the release was a clear fling —
        // a user who drags right 50px then yank-flicks left at 800 px/s
        // expects the card to fly LEFT (matching the last gesture vector),
        // not RIGHT just because the lingering offset is positive. Fall
        // back to the offset sign when the gesture stops without much
        // velocity, and to the velocity sign when there's no offset at all.
        const direction = passVelocity
            ? Math.sign(info.velocity.x)
            : info.offset.x !== 0
              ? Math.sign(info.offset.x)
              : Math.sign(info.velocity.x)

        if (direction !== 0 && (passDistance || passVelocity)) {
            // Fling the rest of the way across, then signal the parent.
            // `x` stays at ±600 after the promise resolves; the parent's
            // `deck = deck.slice(1)` unmounts this CardItem before the
            // user can see the end-of-animation pose linger.
            animate(x, direction * 600, {
                type: 'spring',
                stiffness: 200,
                damping: 26
            }).then(onCommit)
            return
        }
        // Snap home — snappy spring so re-grabbing feels immediate.
        animate(x, 0, { type: 'spring', stiffness: 360, damping: 30 })
    }
</script>

<motion.div
    style={styleString(() => ({
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 260,
        height: 360,
        padding: '1.5rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: '0.375rem',
        color: 'var(--brut-accent-ink, #f8fcfb)',
        border: '1px solid var(--brut-ink, #0a0a0a)',
        boxShadow: isTop
            ? '6px 6px 0 var(--brut-ink, #0a0a0a)'
            : '6px 6px 0 var(--brut-rule, #d6dedb)',
        background: `linear-gradient(180deg, ${card.from}, ${card.to})`,
        zIndex,
        transform: `translate(-50%, calc(-50% + ${ySpring.current}px)) translateX(${
            isTop ? x.current : 0
        }px) rotate(${(isTop ? rotate.current : 0) + rotateSpring.current}deg) scale(${
            scaleSpring.current
        })`,
        opacity: isTop ? 1 : 0.96,
        cursor: isTop ? 'grab' : 'default',
        pointerEvents: isTop ? 'auto' : 'none',
        userSelect: 'none',
        touchAction: 'none',
        willChange: 'transform'
    }))}
    onPan={isTop ? handlePan : undefined}
    onPanEnd={isTop ? handlePanEnd : undefined}
    whilePan={isTop ? { cursor: 'grabbing' } : undefined}
    role="article"
    aria-label={isTop ? `${card.name} — pan to like or nope` : `${card.name} — behind`}
>
    {#if isTop}
        <span class="badge like" style="opacity: {likeOpacity.current}">LIKE</span>
        <span class="badge nope" style="opacity: {nopeOpacity.current}">NOPE</span>
    {/if}
    <span class="emoji" aria-hidden="true">{card.emoji}</span>
    <h3>{card.name}</h3>
    {#if isTop}
        <p>{card.line}</p>
        <span class="hint">← nope · like →</span>
    {/if}
</motion.div>

<style>
    /* Plain children of the motion `.card` element DO receive scoped styles. */
    .emoji {
        position: absolute;
        top: 1.25rem;
        right: 1.25rem;
        font-size: 44px;
        line-height: 1;
    }

    h3 {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 1.25rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.02em;
    }

    p {
        margin: 0;
        font-size: 0.8125rem;
        line-height: 1.4;
        opacity: 0.94;
    }

    .hint {
        margin-top: 0.5rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        opacity: 0.7;
    }

    /* LIKE / NOPE swipe stamps — mono uppercase, hard square corners. */
    .badge {
        position: absolute;
        top: 1.5rem;
        left: 1.25rem;
        padding: 0.375rem 0.75rem;
        font-family: var(--brut-mono, monospace);
        font-size: 0.875rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        border: 2px solid currentColor;
        background: rgba(255, 255, 255, 0.08);
        pointer-events: none;
    }

    .badge.like {
        color: #10b981;
        transform: rotate(-14deg);
    }

    .badge.nope {
        color: #ef4444;
        left: auto;
        right: 1.25rem;
        transform: rotate(14deg);
    }
</style>
