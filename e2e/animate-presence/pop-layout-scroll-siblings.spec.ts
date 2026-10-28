import { expect, test, type Page } from '@playwright/test'

/**
 * Plan 015a: layout siblings around an exit in a scrolled container (#2348).
 * Page: `src/routes/tests/animate-presence/pop-layout-scroll-siblings/+page.svelte`.
 *
 * svelte-motion diffs observed layout changes against cached page-space
 * rects; upstream measures live in `willUpdate()` (`create-projection-node.ts`
 * @ v14.7.1, `measurePageBox` / `removeElementScroll`, 1105-1156). These cases
 * check that a cached rect survives a scroll of a container that isn't
 * `layoutScroll`, a page scroll under a fixed list, a sticky header and a
 * window resize (upstream re-measures after its resize block, 511-532), and
 * that a `layout` item's exit clone follows the move a clamp gives the
 * content.
 *
 * Every painted frame is checked, from a CDP screencast: a colour band's top
 * is the first row with at least 20 pixels within ±24 per channel of its
 * colour, its bottom the last such row, and its left edge the first column
 * with at least 20 such pixels. A colour counts as found when at least 10
 * rows match, pink (the exit clone, drawn above the others) only as its
 * whole 60px box, and green (which the clone can cover) only when at least
 * 20 rows show. Green is tracked by its bottom edge: the pink exit clone
 * sits above it in the stacking order and slides over its top.
 *
 * The screencast drops frames for about 200ms when an exit completes (the
 * clone and placeholder leave the DOM), with `?nolayout` too, while the page
 * itself keeps rendering every frame (no long task, no rAF gap). A move
 * across such a capture gap can't be judged from the screencast, so every
 * frame is also hit-tested: in each `requestAnimationFrame`, blue's top and
 * green's bottom are found with `elementFromPoint` down a column through
 * them (the clone has `pointer-events: none`, so it never hides green).
 */

const BASE = '/tests/animate-presence/pop-layout-scroll-siblings?@isPlaywright=true'

const COLOURS = {
    blue: [0x00, 0x77, 0xff],
    pink: [0xff, 0x00, 0x88],
    green: [0x00, 0xaa, 0x44]
} as const
type Colour = keyof typeof COLOURS

interface Band {
    top: number
    bottom: number
    left: number
}
interface Frame {
    t: number
    bands: Partial<Record<Colour, Band>>
}
/** One hit-tested frame: blue's top and green's bottom, in viewport px. */
interface Hit {
    t: number
    blue?: number
    green?: number
    /** Green's left edge, along the row through its centre (clear of the corner radius). */
    greenLeft?: number
}
interface Recording {
    frames: Frame[]
    hits: Hit[]
}

/** Screencast frames further apart than this are a capture gap. */
const CAPTURE_GAP_MS = 50

type ScreencastFrame = { data: string; metadata: { deviceWidth: number; timestamp?: number } }

test.use({ viewport: { width: 1920, height: 1080 } })

async function open(page: Page, query = '') {
    await page.goto(`${BASE}${query}`)
    await page.waitForFunction(() => window.MotionIsMounted === true)
    await expect(page.locator('#sib-2')).toBeVisible()
    // Let mount-time work settle.
    await page.waitForTimeout(300)
}

const scrollBottom = (page: Page) =>
    page.evaluate(() => {
        const scroller = document.getElementById('scroller')
        if (scroller) scroller.scrollTop = scroller.scrollHeight
        else window.scrollTo(0, 300)
    })

const remove = (page: Page) =>
    page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="remove"]')!.click())

/**
 * Runs `action` under a CDP screencast and returns every captured frame's
 * colour bands, in CSS px, in capture order, plus every rendered frame's
 * hit-tested blue top and green bottom.
 */
async function record(page: Page, action: () => Promise<unknown>, ms: number): Promise<Recording> {
    const cdp = await page.context().newCDPSession(page)
    const shots: ScreencastFrame[] = []
    cdp.on('Page.screencastFrame', (event) => {
        shots.push({ data: event.data, metadata: event.metadata })
        void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
    })
    const clip = await page.evaluate(() => {
        const target = document.getElementById('scroller') ?? document.getElementById('list')!
        const rect = target.getBoundingClientRect()
        return {
            left: Math.max(0, rect.left - 40),
            top: Math.max(0, rect.top - 40),
            right: rect.right + 40,
            bottom: rect.bottom + 40
        }
    })
    await cdp.send('Page.startScreencast', {
        format: 'png',
        everyNthFrame: 1,
        maxWidth: 1920,
        maxHeight: 1080
    })
    await page.evaluate((clip) => {
        const w = window as unknown as { hits: Hit[]; hitting: boolean }
        w.hits = []
        w.hitting = true
        const column = (id: string) => {
            const rect = document.getElementById(id)?.getBoundingClientRect()
            return rect ? rect.left + rect.width / 2 : undefined
        }
        const blueX = column('sib-1')
        const greenX = column('sib-3')
        const greenRect = document.getElementById('sib-3')?.getBoundingClientRect()
        const greenY = greenRect ? greenRect.top + greenRect.height / 2 : undefined
        const scanRow = (y: number | undefined, id: string) => {
            if (y === undefined) return undefined
            for (let x = Math.ceil(clip.left); x <= clip.right; x++) {
                if (document.elementFromPoint(x, y)?.closest(`#${id}`)) return x
            }
            return undefined
        }
        const scan = (x: number | undefined, id: string, last: boolean) => {
            if (x === undefined) return undefined
            let found: number | undefined
            for (let y = Math.ceil(clip.top); y <= clip.bottom; y++) {
                if (document.elementFromPoint(x, y)?.closest(`#${id}`)) {
                    found = y
                    if (!last) break
                }
            }
            return found === undefined ? undefined : last ? found + 1 : found
        }
        const sample = () => {
            if (!w.hitting) return
            w.hits.push({
                t: performance.now(),
                blue: scan(blueX, 'sib-1', false),
                green: scan(greenX, 'sib-3', true),
                greenLeft: scanRow(greenY, 'sib-3')
            })
            requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
    }, clip)
    await page.waitForTimeout(250)
    await action()
    await page.waitForTimeout(ms)
    const hits = await page.evaluate(() => {
        const w = window as unknown as { hits: Hit[]; hitting: boolean }
        w.hitting = false
        return w.hits
    })
    await cdp.send('Page.stopScreencast')
    await cdp.detach()
    shots.sort((a, b) => (a.metadata.timestamp ?? 0) - (b.metadata.timestamp ?? 0))

    const frames = await page.evaluate(
        async ({ shots, clip, colours }) => {
            const frames: Frame[] = []
            for (const { data, metadata } of shots) {
                const blob = await (await fetch('data:image/png;base64,' + data)).blob()
                const bitmap = await createImageBitmap(blob)
                const canvas = document.createElement('canvas')
                canvas.width = bitmap.width
                canvas.height = bitmap.height
                const context = canvas.getContext('2d')!
                context.drawImage(bitmap, 0, 0)
                const scale = bitmap.width / metadata.deviceWidth
                const x0 = Math.floor(clip.left * scale)
                const y0 = Math.floor(clip.top * scale)
                const w = Math.min(bitmap.width, Math.ceil(clip.right * scale)) - x0
                const h = Math.min(bitmap.height, Math.ceil(clip.bottom * scale)) - y0
                const pixels = context.getImageData(x0, y0, w, h).data
                const bands: Frame['bands'] = {}
                for (const [name, target] of Object.entries(colours)) {
                    const rows = new Array<number>(h).fill(0)
                    const columns = new Array<number>(w).fill(0)
                    for (let y = 0; y < h; y++) {
                        for (let x = 0; x < w; x++) {
                            const i = (y * w + x) * 4
                            if (
                                Math.abs(pixels[i] - target[0]) <= 24 &&
                                Math.abs(pixels[i + 1] - target[1]) <= 24 &&
                                Math.abs(pixels[i + 2] - target[2]) <= 24
                            ) {
                                rows[y]++
                                columns[x]++
                            }
                        }
                    }
                    const top = rows.findIndex((count) => count >= 20)
                    // A band, not a few rows of a fading blend that happen
                    // to sit within the tolerance.
                    if (top < 0 || rows.filter((count) => count >= 20).length < 10) continue
                    const bottom = rows.length - 1 - [...rows].reverse().findIndex((c) => c >= 20)
                    // Pink is the exit clone, on top of everything: anything
                    // but its whole 60px box is its fade crossing the
                    // tolerance over different backgrounds.
                    if (name === 'pink' && Math.abs((bottom + 1 - top) / scale - 60) > 3) continue
                    // Green sits under the clone: a sliver left showing above
                    // the clone isn't its band (the hit test tracks it there).
                    if (
                        name === 'green' &&
                        rows.filter((count) => count >= 20).length < 20 * scale
                    ) {
                        continue
                    }
                    const left = columns.findIndex((count) => count >= 20)
                    bands[name as Colour] = {
                        top: (y0 + top) / scale,
                        bottom: (y0 + bottom + 1) / scale,
                        left: (x0 + left) / scale
                    }
                }
                frames.push({ t: metadata.timestamp ?? 0, bands })
            }
            return frames
        },
        { shots, clip, colours: COLOURS }
    )
    return { frames, hits }
}

/** The edge a colour is tracked by (see the file comment). */
const edge = (colour: Colour, band: Band) => (colour === 'green' ? band.bottom : band.top)

/** Frames in which every colour in `colours` was found. */
const framesWith = (frames: Frame[], colours: Colour[]) =>
    frames.filter((frame) => colours.every((colour) => frame.bands[colour]))

/**
 * The largest move of `colour`'s tracked edge between two consecutive
 * captured frames it was found in, leaving out capture gaps (see the file
 * comment; the hit test covers those).
 */
function maxStep(frames: Frame[], colour: Colour): number {
    let step = 0
    let previous: { t: number; value: number } | undefined
    for (const frame of frames) {
        const band = frame.bands[colour]
        if (!band) continue
        const value = edge(colour, band)
        if (previous && (frame.t - previous.t) * 1000 <= CAPTURE_GAP_MS) {
            step = Math.max(step, Math.abs(value - previous.value))
        }
        previous = { t: frame.t, value }
    }
    return step
}

/** The largest move of blue's top or green's bottom between two rendered frames. */
function maxHitStep(hits: Hit[], colour: 'blue' | 'green'): number {
    let step = 0
    for (let i = 1; i < hits.length; i++) {
        const a = hits[i - 1][colour]
        const b = hits[i][colour]
        if (a !== undefined && b !== undefined) step = Math.max(step, Math.abs(b - a))
    }
    return step
}

/** Every frame-to-frame move of `colour`'s tracked edge, with its frame index. */
function steps(frames: Frame[], colour: Colour): Array<{ index: number; step: number }> {
    const out: Array<{ index: number; step: number }> = []
    for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1].bands[colour]
        const b = frames[i].bands[colour]
        if (a && b) out.push({ index: i, step: edge(colour, b) - edge(colour, a) })
    }
    return out
}

function expectNoJump({ frames, hits }: Recording, colours: Array<'blue' | 'green'>) {
    expect(framesWith(frames, colours).length).toBeGreaterThanOrEqual(10)
    for (const colour of colours) {
        expect(maxStep(frames, colour), `${colour} step`).toBeLessThanOrEqual(35)
        expect(hits.filter((hit) => hit[colour] !== undefined).length).toBeGreaterThanOrEqual(10)
        expect(maxHitStep(hits, colour), `${colour} hit-tested step`).toBeLessThanOrEqual(35)
    }
}

const annotate = ({ frames, hits }: Recording) => {
    test.info().annotations.push({
        type: 'hit-tested frames (ms: blue top/green bottom)',
        description: hits
            .map(
                ({ t, blue, green }) =>
                    `${(t - hits[0].t).toFixed(0)}: ${blue?.toFixed(0) ?? '-'}/${green?.toFixed(0) ?? '-'}`
            )
            .join(' ')
    })
    test.info().annotations.push({
        type: 'frames (ms: blue top/pink top/green bottom)',
        description: frames
            .map(
                ({ t, bands }) =>
                    `${((t - frames[0].t) * 1000).toFixed(0)}: ${bands.blue?.top.toFixed(0) ?? '-'}/${bands.pink?.top.toFixed(0) ?? '-'}/${bands.green?.bottom.toFixed(0) ?? '-'}`
            )
            .join(' ')
    })
}

test.describe('layout siblings around exits in scroll containers (clone path)', () => {
    test('clamp, popLayout: blue, the pink clone and green move together, no jump', async ({
        page
    }) => {
        await open(page)
        await scrollBottom(page)
        await page.waitForTimeout(200)
        let hit = ''
        const recording = await record(
            page,
            async () => {
                await remove(page)
                await page.waitForTimeout(150)
                hit = await page.evaluate(() => {
                    const rect = document.getElementById('sib-1')!.getBoundingClientRect()
                    return (
                        document.elementFromPoint(
                            rect.left + rect.width / 2,
                            rect.top + rect.height / 2
                        )?.id ?? ''
                    )
                })
            },
            900
        )
        annotate(recording)
        const { frames } = recording
        // The clone slides over green, so each check takes the frames that
        // show the colours it compares; the first frame shows all three.
        const start = framesWith(frames, ['blue', 'pink', 'green'])[0].bands
        const all = framesWith(frames, ['blue', 'pink'])
        expect(all.length).toBeGreaterThanOrEqual(10)
        expect(framesWith(frames, ['green']).length).toBeGreaterThanOrEqual(10)
        const gap = start.pink!.top - start.blue!.top
        for (const { bands } of all) {
            expect(Math.abs(bands.pink!.top - bands.blue!.top - gap)).toBeLessThanOrEqual(2)
        }
        for (const { bands } of frames) {
            if (bands.green) {
                expect(Math.abs(bands.green.bottom - start.green!.bottom)).toBeLessThanOrEqual(2)
            }
        }
        for (const colour of ['blue', 'pink', 'green'] as const) {
            expect(maxStep(frames, colour), `${colour} step`).toBeLessThanOrEqual(35)
        }
        const { hits } = recording
        for (const colour of ['blue', 'green'] as const) {
            expect(maxHitStep(hits, colour), `${colour} hit-tested step`).toBeLessThanOrEqual(35)
        }
        const greenHits = hits.flatMap(({ green }) => (green === undefined ? [] : [green]))
        expect(greenHits.length).toBeGreaterThanOrEqual(10)
        expect(Math.max(...greenHits) - Math.min(...greenHits)).toBeLessThanOrEqual(2)
        expect(hit).toBe('sib-1')
    })

    test('?layoutScroll, popLayout: the clamp is a one-frame content jump', async ({ page }) => {
        await open(page, '&layoutScroll')
        await scrollBottom(page)
        await page.waitForTimeout(200)
        const recording = await record(page, () => remove(page), 600)
        annotate(recording)
        const { frames } = recording
        const blueSteps = steps(frames, 'blue').filter(({ step }) => Math.abs(step) > 2)
        const pinkSteps = steps(frames, 'pink').filter(({ step }) => Math.abs(step) > 2)
        expect(blueSteps).toHaveLength(1)
        expect(Math.abs(blueSteps[0].step - 70)).toBeLessThanOrEqual(2)
        expect(pinkSteps).toHaveLength(1)
        expect(Math.abs(pinkSteps[0].step - 70)).toBeLessThanOrEqual(2)
        expect(pinkSteps[0].index).toBe(blueSteps[0].index)
        const all = framesWith(frames, ['blue', 'pink'])
        expect(all.length).toBeGreaterThanOrEqual(10)
        const gap = all[0].bands.pink!.top - all[0].bands.blue!.top
        for (const { bands } of all) {
            expect(Math.abs(bands.pink!.top - bands.blue!.top - gap)).toBeLessThanOrEqual(2)
        }
        const transform = await page.evaluate(
            () => getComputedStyle(document.getElementById('sib-1')!).transform
        )
        expect(transform).toBe('none')
    })

    test('sync completion in the scrolled container: no jump', async ({ page }) => {
        await open(page, '&mode=sync')
        await scrollBottom(page)
        await page.waitForTimeout(200)
        // The exit fades over 1.2s; the clamp comes when it completes.
        const recording = await record(page, () => remove(page), 2200)
        annotate(recording)
        expectNoJump(recording, ['blue', 'green'])
    })

    test('?fixed, window scrolled by 300, remove: no 300px phantom', async ({ page }) => {
        await open(page, '&fixed')
        await page.evaluate(() => window.scrollTo(0, 300))
        await page.waitForTimeout(200)
        expect(await page.evaluate(() => window.scrollY)).toBe(300)
        const recording = await record(page, () => remove(page), 900)
        annotate(recording)
        expectNoJump(recording, ['blue', 'green'])
    })

    test('?fixed, height-only resize, remove: no phantom move', async ({ page }) => {
        await open(page, '&fixed')
        await page.setViewportSize({ width: 1920, height: 900 })
        await page.waitForTimeout(400)
        const recording = await record(page, () => remove(page), 900)
        annotate(recording)
        const { frames } = recording
        expectNoJump(recording, ['blue', 'green'])
        const all = framesWith(frames, ['green'])
        for (const { bands } of all) {
            expect(Math.abs(bands.green!.bottom - all[0].bands.green!.bottom)).toBeLessThanOrEqual(
                2
            )
        }
    })

    test('resize, then remove: nothing slides on x', async ({ page }) => {
        await open(page)
        await scrollBottom(page)
        await page.setViewportSize({ width: 1600, height: 1080 })
        // Longer than upstream's 250ms resize block.
        await page.waitForTimeout(400)
        const recording = await record(page, () => remove(page), 900)
        annotate(recording)
        const { frames } = recording
        // The clone slides over green: each colour needs its own 10 frames.
        // Green's left edge comes from the hit test: the screencast only sees
        // a sliver of it beside the clone, where its corner radius moves the
        // first full column.
        const lefts = {
            blue: frames.flatMap(({ bands }) => (bands.blue ? [bands.blue.left] : [])),
            pink: frames.flatMap(({ bands }) => (bands.pink ? [bands.pink.left] : [])),
            green: recording.hits.flatMap(({ greenLeft }) =>
                greenLeft === undefined ? [] : [greenLeft]
            )
        }
        for (const [colour, values] of Object.entries(lefts)) {
            expect(values.length, `${colour} frames`).toBeGreaterThanOrEqual(10)
            expect(Math.max(...values) - Math.min(...values), `${colour} x`).toBeLessThanOrEqual(2)
        }
    })

    test('?sticky, scroll, remove: no jump', async ({ page }) => {
        await open(page, '&sticky')
        await scrollBottom(page)
        await page.waitForTimeout(200)
        const recording = await record(page, () => remove(page), 900)
        annotate(recording)
        expectNoJump(recording, ['blue', 'green'])
    })

    test('?nolayout, clamp: the pink clone steps with the content in one frame', async ({
        page
    }) => {
        await open(page, '&nolayout')
        await scrollBottom(page)
        await page.waitForTimeout(200)
        const recording = await record(page, () => remove(page), 600)
        annotate(recording)
        const { frames } = recording
        const pinkSteps = steps(frames, 'pink').filter(({ step }) => Math.abs(step) > 2)
        expect(pinkSteps).toHaveLength(1)
        expect(Math.abs(pinkSteps[0].step - 70)).toBeLessThanOrEqual(2)
    })
})

test.describe('layout siblings around exits in scroll containers (owned path)', () => {
    test('sync completion in the scrolled container, ?layoutGroup: no jump', async ({ page }) => {
        await open(page, '&path=owned&mode=sync&layoutGroup')
        await scrollBottom(page)
        await page.waitForTimeout(200)
        const recording = await record(page, () => remove(page), 2200)
        annotate(recording)
        expectNoJump(recording, ['blue', 'green'])
    })

    test('?fixed, window scrolled by 300, remove: no 300px phantom', async ({ page }) => {
        await open(page, '&path=owned&fixed')
        await page.evaluate(() => window.scrollTo(0, 300))
        await page.waitForTimeout(200)
        const recording = await record(page, () => remove(page), 900)
        annotate(recording)
        const { frames } = recording
        // Blue moves into the popped pink item's slot, under it, so only
        // green (which stays put) must be seen throughout.
        expect(framesWith(frames, ['green']).length).toBeGreaterThanOrEqual(10)
        for (const colour of ['blue', 'green'] as const) {
            const found = frames.flatMap(({ bands }) =>
                bands[colour] ? [edge(colour, bands[colour])] : []
            )
            expect(Math.max(...found) - Math.min(...found), `${colour} range`).toBeLessThan(250)
        }
    })
})

type ReadsWindow = Window & {
    reads: Record<string, number[]>
    lastResize: number
}

/**
 * Read budgets: `getBoundingClientRect` calls counted per element `id`, with
 * the time of each, as `e2e/layout-id/read-budget.spec.ts` does.
 */
test.describe('layout siblings in scroll containers: read budgets', () => {
    const ids = [0, 1, 2, 3, 4].map((i) => `sib-${i}`)

    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            const w = window as unknown as ReadsWindow
            w.reads = {}
            w.lastResize = 0
            window.addEventListener('resize', () => (w.lastResize = performance.now()), true)
            const getBoundingClientRect = Object.getOwnPropertyDescriptor(
                Element.prototype,
                'getBoundingClientRect'
            )!.value as (this: Element) => DOMRect
            Element.prototype.getBoundingClientRect = function (this: Element) {
                if (this.id) (w.reads[this.id] ||= []).push(performance.now())
                return getBoundingClientRect.call(this)
            }
        })
    })

    const resetReads = (page: Page) =>
        page.evaluate(() => {
            ;(window as unknown as ReadsWindow).reads = {}
        })
    const reads = (page: Page) => page.evaluate(() => (window as unknown as ReadsWindow).reads)

    test('scrolling the scroller in 30 frames reads no item', async ({ page }) => {
        await open(page)
        await resetReads(page)
        await page.evaluate(async () => {
            const scroller = document.getElementById('scroller')!
            for (let i = 0; i < 30; i++) {
                scroller.scrollTop += 20
                await new Promise(requestAnimationFrame)
            }
        })
        await page.waitForTimeout(300)
        const counts = await reads(page)
        for (const id of ids) expect(counts[id]?.length ?? 0, id).toBe(0)
    })

    test('a resize reads each item once, 250ms after the last resize event', async ({ page }) => {
        await open(page, '&mode=sync')
        await resetReads(page)
        for (const width of [1800, 1700, 1600]) {
            await page.setViewportSize({ width, height: 1080 })
            await page.waitForTimeout(50)
        }
        const during = await reads(page)
        for (const id of ids) expect(during[id]?.length ?? 0, `${id} during`).toBe(0)
        await page.waitForTimeout(400)
        const { counts, lastResize } = await page.evaluate(() => {
            const w = window as unknown as ReadsWindow
            return { counts: w.reads, lastResize: w.lastResize }
        })
        for (const id of ids) {
            expect(counts[id]?.length ?? 0, id).toBe(1)
            expect(counts[id][0] - lastResize, `${id} delay`).toBeGreaterThanOrEqual(240)
        }
    })
})
