<script lang="ts">
    import { onMount } from 'svelte'

    let {
        container,
        cardId,
        prefix
    }: {
        container: HTMLDivElement | null
        cardId: string
        prefix: string
    } = $props()

    let metrics = $state<{ width: number; inset: number; delta: number; overflow: number } | null>(
        null
    )

    onMount(() => {
        let frame = 0
        let sampledAt = -Infinity
        let previousCard: HTMLElement | null = null
        let baseline = 0

        // Read-only instrumentation lives here so metric updates never rerun
        // the parent fixture's drag props or alter its resize-observer timing.
        const sample = (time: number) => {
            if (time - sampledAt >= 80 && !document.hidden) {
                sampledAt = time
                const card = container?.querySelector<HTMLElement>(`[data-testid="${cardId}"]`)
                if (container && card) {
                    const bounds = container.getBoundingClientRect()
                    const rect = card.getBoundingClientRect()
                    const style = getComputedStyle(container)
                    const left = bounds.left + Number.parseFloat(style.borderLeftWidth)
                    const right = bounds.right - Number.parseFloat(style.borderRightWidth)
                    const inset = rect.left - left
                    if (card !== previousCard) {
                        previousCard = card
                        baseline = inset
                    }
                    const next = {
                        width: right - left,
                        inset,
                        delta: inset - baseline,
                        // Drag constraints use the outer rectangle, including borders.
                        overflow: Math.max(
                            0,
                            bounds.left - rect.left,
                            rect.right - bounds.right,
                            bounds.top - rect.top,
                            rect.bottom - bounds.bottom
                        )
                    }
                    if (
                        !metrics ||
                        Math.abs(next.width - metrics.width) >= 0.05 ||
                        Math.abs(next.inset - metrics.inset) >= 0.05 ||
                        Math.abs(next.delta - metrics.delta) >= 0.05 ||
                        Math.abs(next.overflow - metrics.overflow) >= 0.05
                    ) {
                        metrics = next
                    }
                }
            }
            frame = requestAnimationFrame(sample)
        }
        frame = requestAnimationFrame(sample)
        return () => cancelAnimationFrame(frame)
    })
</script>

<div class="measurements" aria-label="Live geometry measurements">
    <dl>
        <div>
            <dt>Inner width</dt>
            <dd data-testid={`${prefix}-width`}>
                {metrics ? metrics.width.toFixed(1) : '—'} <span>px</span>
            </dd>
        </div>
        <div>
            <dt>Left inset</dt>
            <dd data-testid={`${prefix}-inset`}>
                {metrics ? metrics.inset.toFixed(1) : '—'} <span>px</span>
            </dd>
        </div>
        <div>
            <dt>From reset</dt>
            <dd data-testid={`${prefix}-delta`}>
                {metrics
                    ? Math.abs(metrics.delta) < 0.05
                        ? '0.0'
                        : metrics.delta.toFixed(1)
                    : '—'} <span>px</span>
            </dd>
        </div>
        <div>
            <dt>Overflow</dt>
            <dd data-testid={`${prefix}-overflow`}>
                {metrics ? metrics.overflow.toFixed(1) : '—'} <span>px</span>
            </dd>
        </div>
    </dl>
    <div class="measurement-footer">
        <span
            class:outside={metrics && metrics.overflow > 0.5}
            class="bounds"
            data-testid={`${prefix}-bounds`}
        >
            <span aria-hidden="true">●</span>
            {metrics
                ? metrics.overflow <= 0.5
                    ? 'Inside bounds'
                    : 'Outside bounds'
                : 'Measuring…'}
        </span>
        <span>Outer border bounds · 0.5 px tolerance</span>
    </div>
</div>

<style>
    .measurements {
        border: 1px solid #dce3eb;
        border-radius: 12px;
        background: #fff;
        overflow: hidden;
    }
    dl {
        margin: 0;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
    }
    dl > div {
        padding: 16px;
        border-right: 1px solid #e6ebf0;
    }
    dl > div:last-child {
        border-right: 0;
    }
    dt {
        color: #556275;
        font-size: 12px;
        margin-bottom: 6px;
    }
    dd {
        margin: 0;
        color: #182437;
        font:
            600 21px/1.3 ui-monospace,
            SFMono-Regular,
            monospace;
        font-variant-numeric: tabular-nums;
    }
    dd span {
        font-size: 12px;
        font-weight: 400;
        color: #657287;
    }
    .measurement-footer {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        padding: 10px 16px;
        border-top: 1px solid #e6ebf0;
        font-size: 11px;
        color: #667287;
    }
    .bounds {
        color: #16724c;
        font-weight: 600;
    }
    .bounds span {
        margin-right: 5px;
    }
    .bounds.outside {
        color: #9a510c;
    }
    @media (max-width: 520px) {
        dl {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        dl > div {
            padding: 12px;
        }
        dl > div:nth-child(2) {
            border-right: 0;
        }
        dl > div:nth-child(-n + 2) {
            border-bottom: 1px solid #e6ebf0;
        }
    }
</style>
