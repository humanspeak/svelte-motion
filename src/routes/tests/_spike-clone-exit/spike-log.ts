/**
 * THROWAWAY SPIKE CODE — clone-exit-migration plan 001.
 * Nothing under `src/routes/tests/_spike-clone-exit/` ships; it exists only to
 * answer the mechanism questions in `.agents/.plans/clone-exit-migration/001-exit-mechanism-spike.md`.
 */

export type SpikeEvent = {
    t: number
    name: string
    detail?: Record<string, unknown>
}

type SpikeWindow = Window & {
    __spike?: {
        events: SpikeEvent[]
        reset: () => void
        dump: () => SpikeEvent[]
    }
}

const t0 = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export function spikeLog(name: string, detail?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return
    const w = window as SpikeWindow
    if (!w.__spike) {
        const events: SpikeEvent[] = []
        w.__spike = {
            events,
            reset: () => {
                events.length = 0
            },
            dump: () => events.slice()
        }
    }
    w.__spike.events.push({ t: Math.round(t0()), name, detail })
}
