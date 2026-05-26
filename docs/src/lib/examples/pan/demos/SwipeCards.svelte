<script lang="ts">
    import CardItem from './CardItem.svelte'

    type Card = {
        id: number
        name: string
        line: string
        emoji: string
        from: string
        to: string
    }

    const SEED: Card[] = [
        {
            id: 0,
            name: 'Ada',
            line: 'designs algorithms in her sleep',
            emoji: '🧮',
            from: '#a78bfa',
            to: '#7c3aed'
        },
        {
            id: 1,
            name: 'Grace',
            line: 'wrote the manual you read',
            emoji: '🐛',
            from: '#f472b6',
            to: '#db2777'
        },
        {
            id: 2,
            name: 'Linus',
            line: 'built it on a coffee break',
            emoji: '🐧',
            from: '#22d3ee',
            to: '#0891b2'
        },
        {
            id: 3,
            name: 'Margaret',
            line: 'shipped to the moon',
            emoji: '🚀',
            from: '#fb923c',
            to: '#ea580c'
        },
        {
            id: 4,
            name: 'Alan',
            line: 'asked the machine what it wanted',
            emoji: '🤖',
            from: '#34d399',
            to: '#059669'
        }
    ]

    let deck: Card[] = $state([...SEED])

    // Each CardItem owns its own pan MotionValue + commit animation,
    // so the parent's job here is purely "remove the top card once the
    // child has finished flinging itself off-screen". No shared MV to
    // reset → no one-frame flash of the outgoing card snapping back to
    // centre while the unmount is queued.
    const onCommit = () => {
        deck = deck.slice(1)
    }

    const reset = () => {
        deck = [...SEED]
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="dating-stage">
        {#if deck.length === 0}
            <button class="reset" type="button" onclick={reset}>↺ shuffle the deck</button>
        {:else}
            <!-- Render the top 3 cards. Back cards get a subtle Y offset + scale
                 to fake depth without using any actual 3D transforms.
                 Each CardItem owns its own pan MotionValue + LIKE/NOPE
                 derived opacities + commit animation (see CardItem.svelte).
                 The parent only knows about the deck array; cards signal
                 "I'm done flying off, drop me" via the onCommit prop. -->
            {#each deck.slice(0, 3) as card, i (card.id)}
                <CardItem
                    {card}
                    isTop={i === 0}
                    depthY={i === 0 ? 0 : i * 16}
                    depthRotate={i === 0 ? 0 : i === 1 ? -3 : 4}
                    depthScale={1 - i * 0.03}
                    zIndex={3 - i}
                    {onCommit}
                />
            {/each}
        {/if}
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        width: 100%;
    }

    .dating-stage {
        position: relative;
        width: 100%;
        max-width: 360px;
        height: 460px;
        border-radius: 18px;
        background: linear-gradient(180deg, #fafafa 0%, #e5e7eb 100%);
        border: 1px solid #d4d4d8;
        overflow: hidden;
        font-family:
            ui-sans-serif,
            system-ui,
            -apple-system,
            sans-serif;
    }

    :global(.card) {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 260px;
        height: 360px;
        border-radius: 22px;
        color: #ffffff;
        padding: 28px 24px;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        gap: 6px;
        box-shadow:
            0 24px 48px -16px rgba(15, 23, 42, 0.45),
            0 2px 4px rgba(15, 23, 42, 0.15);
        will-change: transform;
        user-select: none;
        touch-action: none;
        cursor: grab;
    }

    :global(.card.behind) {
        opacity: 0.96;
        cursor: default;
        pointer-events: none;
    }

    :global(.card .emoji) {
        position: absolute;
        top: 24px;
        right: 24px;
        font-size: 48px;
        line-height: 1;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25));
    }

    :global(.card h3) {
        margin: 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.01em;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
    }

    :global(.card p) {
        margin: 0;
        font-size: 13px;
        line-height: 1.4;
        opacity: 0.92;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    :global(.card .hint) {
        margin-top: 8px;
        font-size: 11px;
        font-family: ui-monospace, monospace;
        letter-spacing: 0.05em;
        opacity: 0.65;
    }

    :global(.card .badge) {
        position: absolute;
        top: 28px;
        left: 24px;
        padding: 6px 12px;
        border-radius: 8px;
        font-family: ui-monospace, monospace;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.12em;
        border: 2px solid currentColor;
        background: rgba(255, 255, 255, 0.06);
        pointer-events: none;
    }

    :global(.card .badge.like) {
        color: #10b981;
        transform: rotate(-14deg);
    }

    :global(.card .badge.nope) {
        color: #ef4444;
        left: auto;
        right: 24px;
        transform: rotate(14deg);
    }

    .reset {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 10px 18px;
        border-radius: 10px;
        border: 1px solid #d4d4d8;
        background: #ffffff;
        color: #0f172a;
        font-family: inherit;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    }

    .reset:hover {
        border-color: #94a3b8;
    }
</style>
