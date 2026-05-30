export interface ProjectionDelta {
    dx: number
    dy: number
    changed: boolean
}

export const parseProjectionDelta = (text: string | null): ProjectionDelta | null => {
    const m = text?.match(/Δx=(-?[\d.]+)\s+Δy=(-?[\d.]+)\s+changed=(true|false)/)
    if (!m) return null
    return { dx: Number(m[1]), dy: Number(m[2]), changed: m[3] === 'true' }
}

export const isIdleDelta = (text: string | null): boolean => {
    const delta = parseProjectionDelta(text)
    return (
        !!text?.includes('(no event yet)') ||
        !!(delta && !delta.changed && Math.abs(delta.dx) < 0.5 && Math.abs(delta.dy) < 0.5)
    )
}
