/**
 * Port of Motion's rule for mapping a scroll `offset` onto a native CSS
 * `ViewTimeline` range. Upstream does not export any of this, so it is copied
 * here 1:1 from motion v13.4.7 (motion#3842):
 *
 * - `packages/framer-motion/src/render/dom/scroll/offsets/edge.ts`
 * - `packages/framer-motion/src/render/dom/scroll/offsets/offset.ts`
 * - `packages/framer-motion/src/render/dom/scroll/offsets/presets.ts`
 * - `packages/framer-motion/src/render/dom/scroll/utils/offset-to-range.ts`
 *
 * On every Motion bump, diff those files between tags and re-sync this module.
 *
 * @module
 */

/**
 * A single edge of a target or container: a named edge (`"start"`, `"center"`,
 * `"end"`), a progress number (as number or string), or a length such as
 * `"100px"`, `"50%"`, `"10vw"`, `"10vh"`.
 */
type Edge = string | number

/**
 * One offset entry: a single edge (applied to both target and container when
 * named/numeric), a `"target container"` string, or a `[target, container]` pair.
 */
type OffsetEntry = Edge | readonly [Edge, Edge]

/**
 * Named edges and their progress values.
 * Mirrors upstream `offsets/edge.ts`.
 */
export const namedEdges: Record<string, number> = {
    start: 0,
    center: 0.5,
    end: 1
}

/**
 * Scroll offset presets. Only `All` is needed here, as the default offset.
 * Mirrors upstream `offsets/presets.ts`.
 */
const presets = {
    All: [
        [0, 0],
        [1, 1]
    ] as ReadonlyArray<OffsetEntry>
}

/**
 * Resolves a single edge to pixels along an axis.
 * Mirrors upstream `offsets/edge.ts` `resolveEdge`.
 *
 * @param edge - Named edge, progress number/string, or px/%/vw/vh length.
 * @param length - Length of the element the edge belongs to, in px.
 * @param inset - Distance of the element's start from the origin, in px.
 * @returns The resolved position in px.
 */
export const resolveEdge = (edge: Edge, length: number, inset = 0): number => {
    let delta = 0

    // If the edge is a named preset, replace it with its numerical value.
    if (edge in namedEdges) {
        edge = namedEdges[edge]
    }

    // Handle unit values.
    if (typeof edge === 'string') {
        const asNumber = parseFloat(edge)

        if (edge.endsWith('px')) {
            delta = asNumber
        } else if (edge.endsWith('%')) {
            edge = asNumber / 100
        } else if (edge.endsWith('vw')) {
            delta = (asNumber / 100) * document.documentElement.clientWidth
        } else if (edge.endsWith('vh')) {
            delta = (asNumber / 100) * document.documentElement.clientHeight
        } else {
            edge = asNumber
        }
    }

    // If the edge is a number, handle it as a progress value.
    if (typeof edge === 'number') {
        delta = length * edge
    }

    return inset + delta
}

const defaultOffset: [number, number] = [0, 0]

/**
 * Resolves one offset entry to the scroll distance at which it applies.
 * Mirrors upstream `offsets/offset.ts` `resolveOffset`.
 *
 * @param offset - A single edge, a `"target container"` string, or a `[target, container]` pair.
 * @param containerLength - Length of the scroll container, in px.
 * @param targetLength - Length of the target element, in px.
 * @param targetInset - Distance of the target's start from the container's origin, in px.
 * @returns The resolved offset in px.
 */
export const resolveOffset = (
    offset: OffsetEntry,
    containerLength: number,
    targetLength: number,
    targetInset: number
): number => {
    let offsetDefinition: readonly [Edge, Edge] = Array.isArray(offset)
        ? (offset as readonly [Edge, Edge])
        : defaultOffset

    if (typeof offset === 'number') {
        // `offset: [0, 0.5, 1]` means each number x becomes [x, x].
        offsetDefinition = [offset, offset]
    } else if (typeof offset === 'string') {
        offset = offset.trim()

        if (offset.includes(' ')) {
            offsetDefinition = offset.split(' ') as [string, string]
        } else {
            // A bare "100px" applies to the target only (container stays 0),
            // whereas a named edge like "end" applies to both.
            offsetDefinition = [offset, namedEdges[offset] ? offset : '0']
        }
    }

    const targetPoint = resolveEdge(offsetDefinition[0], targetLength, targetInset)
    const containerPoint = resolveEdge(offsetDefinition[1], containerLength)

    return targetPoint - containerPoint
}

/**
 * Native ViewTimeline description of a scroll offset.
 * Mirrors upstream `ViewTimelineRange`.
 */
export interface ViewTimelineRange {
    /** Named range offsets of the offset's two points. */
    points: string[]

    /**
     * The offset runs forwards when `a` x target length + `b` x container
     * length is >= 0. Otherwise its range runs from the second point to the
     * first, with progress reversed.
     */
    a: number
    b: number

    /** Whether this is the ViewTimeline's default range, run forwards. */
    cover: boolean
}

/**
 * Resolved offsets are linear in the target and container lengths, so probing
 * them gives `[target progress, container progress, pixels]`. vw/vh can
 * resolve to 0px, so they are rejected up front.
 */
const toIntersection = (o: OffsetEntry): number[] => {
    if (/v/u.test(o as string)) return []
    const px = resolveOffset(o, 0, 0, 0)
    return [resolveOffset(o, 0, 1, 0) - px, px - resolveOffset(o, 1, 0, 0), px]
}

const toRange = ([t, c, px]: number[]): string | false =>
    !px && (c === 0 || c === 1) && `${c ? 'entry' : 'exit'}-crossing ${t * 100}%`

/**
 * Maps an offset to an equivalent ViewTimeline range. Returns `undefined` when
 * there is none, which signals the caller to fall back to JS-based scroll
 * tracking. Mirrors upstream `utils/offset-to-range.ts`.
 *
 * @param offset - The scroll offset. Defaults to the `All` preset.
 * @returns The equivalent range, or `undefined` if the offset cannot run natively.
 */
export const offsetToViewTimelineRange = (
    offset: ReadonlyArray<OffsetEntry> = presets.All
): ViewTimelineRange | undefined => {
    if (offset.length !== 2) return undefined

    const [start, end] = offset.map(toIntersection)
    const points = [toRange(start), toRange(end)]
    const a = end[0] - start[0]
    const b = start[1] - end[1]

    if (points[0] && points[1] && (a || b)) {
        return {
            points: points as string[],
            a,
            b,
            cover: !start[0] && a === 1 && b === 1
        }
    }
    return undefined
}
