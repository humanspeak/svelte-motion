<script lang="ts">
    import { page } from '$app/state'
    import {
        MotionConfig,
        cancelFrame,
        createDragControls,
        frame,
        motion,
        motionValue,
        type DragInfo,
        type MotionTransformPoint
    } from '$lib'
    import { onMount } from 'svelte'

    const controls = createDragControls()
    const caseId = $derived(page.url.searchParams.get('case') ?? 'drag-uniform-scale')
    const configKind = $derived(
        caseId === 'drag-no-config-end'
            ? 'none'
            : caseId === 'drag-nonuniform-affine'
              ? 'nonuniform'
              : caseId === 'drag-stable-closure-scale'
                ? 'stable'
                : 'double'
    )
    const usesAncestor = $derived(caseId === 'drag-ancestor-scroll-held')
    const usesControls = $derived(caseId === 'drag-controls-snap-scrolled')
    const usesLayout = $derived(caseId === 'drag-real-layout-shift-held')
    const boundsKind = $derived(
        caseId === 'drag-numeric-bounds'
            ? 'numeric'
            : caseId === 'drag-ref-bounds' || caseId === 'drag-ref-resize-regrab'
              ? 'ref'
              : 'none'
    )

    let mounted = $state(true)
    let ready = $state(false)
    type MappingKind = 'none' | 'double' | 'triple' | 'nonuniform-affine'
    let mappingKind = $state<MappingKind>('double')
    let stableScale = 2
    let visualScale = $state({ x: 0.5, y: 0.5 })
    let boardWidth = $state(500)
    let layoutShift = $state(0)
    let board: HTMLElement | null = $state(null)
    let stage: HTMLElement | null = $state(null)
    let shell: HTMLElement | null = $state(null)
    let slot: HTMLElement | null = $state(null)
    let target: HTMLElement | null = $state(null)
    let handle: HTMLElement | null = $state(null)
    let callbackInfo = $state<DragInfo | null>(null)
    // React's public reference fixture creates fresh onDrag* closures whenever
    // one of these parent action states causes a render. Svelte event-handler
    // closures are compiler-stable, so explicitly replace the public callback
    // references on the corresponding fixture actions. These references still
    // enter through normal motion props; there is no fixture-only engine hook.
    let callbackCommit = $state(0)
    const x = motionValue(0)
    const y = motionValue(0)

    const round = (value: number) =>
        Number.isFinite(value) ? Math.round(value * 1_000_000) / 1_000_000 : value
    const point = (value: { x: number; y: number }) => ({ x: round(value.x), y: round(value.y) })
    const rect = (element: HTMLElement | null) => {
        if (!element) return null
        const value = element.getBoundingClientRect()
        return {
            x: round(value.x),
            y: round(value.y),
            top: round(value.top),
            right: round(value.right),
            bottom: round(value.bottom),
            left: round(value.left),
            width: round(value.width),
            height: round(value.height)
        }
    }
    const eventRecord = (event: PointerEvent) => ({
        type: event.type,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        button: event.button,
        buttons: event.buttons,
        client: { x: round(event.clientX), y: round(event.clientY) },
        page: { x: round(event.pageX), y: round(event.pageY) }
    })
    const infoRecord = (info: DragInfo) => ({
        point: point(info.point),
        delta: point(info.delta),
        offset: point(info.offset),
        velocity: point(info.velocity)
    })

    const parity: {
        library: string
        case: string
        ready: boolean
        trace: Array<Record<string, unknown>>
        snapshots: Array<Record<string, unknown>>
        actions: Record<string, (...args: never[]) => unknown>
    } = {
        library: 'Svelte Motion public fixture',
        case: '',
        ready: false,
        trace: [],
        snapshots: [],
        actions: {}
    }
    const trace = (type: string, data: Record<string, unknown> = {}) => {
        parity.trace.push({
            sequence: parity.trace.length,
            at: round(performance.now()),
            type,
            ...data
        })
    }
    const traced =
        (identityName: string, transform: MotionTransformPoint): MotionTransformPoint =>
        (input) => {
            const output = transform(input)
            trace('transformPagePoint', {
                identity: identityName,
                input: point(input),
                output: point(output),
                stableScale
            })
            return output
        }

    const double = traced('double', ({ x: px, y: py }) => ({ x: px * 2, y: py * 2 }))
    const triple = traced('triple', ({ x: px, y: py }) => ({ x: px * 3, y: py * 3 }))
    const nonuniform = traced('nonuniform-affine', ({ x: px, y: py }) => ({
        x: px * 2 + 37,
        y: py * 0.5 - 23
    }))
    const stable = traced('stable-closure', ({ x: px, y: py }) => ({
        x: px * stableScale,
        y: py * stableScale
    }))
    const activeTransform = $derived(
        configKind === 'stable'
            ? stable
            : mappingKind === 'triple'
              ? triple
              : configKind === 'nonuniform'
                ? nonuniform
                : double
    )
    const constraints = $derived(
        boundsKind === 'numeric'
            ? { left: -90, right: 110, top: -60, bottom: 70 }
            : boundsKind === 'ref'
              ? (board ?? undefined)
              : undefined
    )

    const captureSnapshot = (label: string) => {
        const snapshot = {
            sequence: parity.snapshots.length,
            at: round(performance.now()),
            label,
            mappingKind,
            stableScale,
            visualScale: { ...visualScale },
            mounted,
            scroll: { x: round(window.scrollX), y: round(window.scrollY) },
            shellScroll: shell ? { x: shell.scrollLeft, y: shell.scrollTop } : null,
            rects: {
                shell: rect(shell),
                stage: rect(stage),
                board: rect(board),
                slot: rect(slot),
                target: rect(target),
                handle: rect(handle),
                follower: null
            },
            layout: {
                boardOffsetWidth: board?.offsetWidth ?? null,
                boardOffsetHeight: board?.offsetHeight ?? null,
                slotOffsetLeft: slot?.offsetLeft ?? null,
                slotOffsetTop: slot?.offsetTop ?? null,
                targetContainedByBoard: Boolean(target) && Boolean(board?.contains(target))
            },
            boundValues: { x: round(x.get()), y: round(y.get()), panOffset: { x: 0, y: 0 } }
        }
        parity.snapshots.push(snapshot)
        return snapshot
    }

    const record = (name: string, event: PointerEvent, info: DragInfo) => {
        callbackInfo = info
        trace(name, {
            event: eventRecord(event),
            info: infoRecord(info),
            callbackRenderState: { mappingKind, stableScale },
            rendered: { target: rect(target), follower: null },
            boundValues: { x: round(x.get()), y: round(y.get()) }
        })
    }
    const dragCallbacks = $derived.by(() => {
        void callbackCommit
        return {
            onStart: (event: PointerEvent, info: DragInfo) => record('onDragStart', event, info),
            onMove: (event: PointerEvent, info: DragInfo) => record('onDrag', event, info),
            onEnd: (event: PointerEvent, info: DragInfo) => record('onDragEnd', event, info)
        }
    })

    onMount(() => {
        const root = globalThis as typeof globalThis & { __PARITY__?: typeof parity }
        root.__PARITY__ = parity
        parity.case = caseId
        mappingKind =
            configKind === 'none'
                ? 'none'
                : configKind === 'nonuniform'
                  ? 'nonuniform-affine'
                  : 'double'
        visualScale =
            configKind === 'none'
                ? { x: 1, y: 1 }
                : configKind === 'nonuniform'
                  ? { x: 0.5, y: 2 }
                  : { x: 0.5, y: 0.5 }
        parity.actions = {
            captureSnapshot: captureSnapshot as (...args: never[]) => unknown,
            setMapping: ((value: MappingKind) => {
                mappingKind = value
                callbackCommit += 1
            }) as (...args: never[]) => unknown,
            setStableScale: ((value: number) => {
                stableScale = value
                visualScale = { x: 1 / value, y: 1 / value }
                callbackCommit += 1
            }) as (...args: never[]) => unknown,
            resizeBoard: ((width: number) => {
                boardWidth = width
                callbackCommit += 1
            }) as (...args: never[]) => unknown,
            shiftLayout: ((px: number) => {
                layoutShift = px
                callbackCommit += 1
            }) as (...args: never[]) => unknown,
            unmount: (() => {
                mounted = false
            }) as (...args: never[]) => unknown
        }
        let frameProbeRecorded = false
        const recordMotionFrame = (frameData: { delta: number; timestamp: number }) => {
            if (frameProbeRecorded) return
            frameProbeRecorded = true
            trace('motionFrameProbe', {
                delta: round(frameData.delta),
                timestamp: round(frameData.timestamp),
                performanceNow: round(performance.now())
            })
        }
        frame.update(recordMotionFrame, true)
        parity.ready = true
        ready = true
        return () => cancelFrame(recordMotionFrame)
    })
</script>

{#snippet dragTarget()}
    {#if mounted}
        <motion.div
            bind:ref={target}
            data-testid="target"
            class="dragTarget"
            drag
            dragListener={!usesControls}
            dragControls={controls}
            dragConstraints={constraints}
            dragElastic={0}
            dragMomentum={false}
            layout={usesLayout}
            style={{ x, y }}
            onDragStart={dragCallbacks.onStart}
            onDrag={dragCallbacks.onMove}
            onDragEnd={dragCallbacks.onEnd}>drag card</motion.div
        >
    {/if}
{/snippet}

{#snippet configuredTarget()}
    {#if configKind === 'none'}
        {@render dragTarget()}
    {:else}
        <MotionConfig transformPagePoint={activeTransform}>{@render dragTarget()}</MotionConfig>
    {/if}
{/snippet}

<svelte:head><title>transformPagePoint drag reference</title></svelte:head>

<main data-testid="fixture" data-case={caseId} data-ready={ready}>
    <div class="caseLabel">{caseId}</div>
    {#snippet stageContent()}
        <div
            bind:this={stage}
            data-testid="stage"
            class:stageInShell={usesAncestor}
            class="stage"
            style:transform={configKind === 'none'
                ? 'none'
                : configKind === 'nonuniform'
                  ? 'translate(40px, -30px) scale(0.5, 2)'
                  : `scale(${visualScale.x}, ${visualScale.y})`}
        >
            <div
                bind:this={board}
                data-testid="board"
                class="board"
                style:width={`${boardWidth}px`}
            >
                <div class="layoutRow">
                    <div data-testid="layout-spacer" style:width={`${layoutShift}px`}></div>
                    <div bind:this={slot} data-testid="slot" class="slot">
                        {@render configuredTarget()}
                    </div>
                </div>
            </div>
        </div>
    {/snippet}

    {#if usesAncestor}
        <div bind:this={shell} data-testid="shell" class="shell">
            <div class="shellContent">{@render stageContent()}</div>
        </div>
    {:else}
        {@render stageContent()}
    {/if}

    {#if usesControls}
        <button
            bind:this={handle}
            data-testid="handle"
            class="controlHandle"
            onpointerdown={(event) => controls.start(event, { snapToCursor: true })}
            >snap handle</button
        >
    {/if}

    <aside class="controls">
        <button onclick={() => (mappingKind = mappingKind === 'double' ? 'triple' : 'double')}
            >replace mapping</button
        >
        <button onclick={() => (boardWidth = boardWidth === 500 ? 620 : 500)}>resize board</button>
        <button onclick={() => (layoutShift = layoutShift === 0 ? 60 : 0)}>shift layout</button>
        <output
            data-testid="drag-output"
            data-local-x={callbackInfo?.offset.x ?? 0}
            data-local-y={callbackInfo?.offset.y ?? 0}
            data-delta-x={callbackInfo?.delta.x ?? 0}
            data-delta-y={callbackInfo?.delta.y ?? 0}
            data-velocity-x={callbackInfo?.velocity.x ?? 0}
            data-velocity-y={callbackInfo?.velocity.y ?? 0}
            data-bound-x={x.get()}
            data-bound-y={y.get()}
            >offset {callbackInfo?.offset.x ?? 0}, {callbackInfo?.offset.y ?? 0}</output
        >
    </aside>
</main>

<style>
    :global(html),
    :global(body),
    :global(*) {
        box-sizing: border-box;
    }
    :global(html),
    :global(body) {
        margin: 0;
        min-width: 2600px;
        min-height: 2200px;
    }
    :global(body) {
        overflow: scroll;
    }
    .caseLabel,
    .controls {
        position: fixed;
        z-index: 20;
        top: 8px;
        left: 8px;
        padding: 5px 8px;
        background: rgb(2 6 23 / 85%);
        color: white;
    }
    .controls {
        top: 42px;
        display: grid;
        gap: 4px;
    }
    .stage {
        position: absolute;
        left: 300px;
        top: 260px;
        width: max-content;
        transform-origin: top left;
    }
    .stageInShell {
        left: 280px;
        top: 220px;
    }
    .board {
        position: relative;
        height: 300px;
        border: 4px solid #38bdf8;
        background: #0f172a;
    }
    .layoutRow {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        padding-left: 170px;
    }
    .layoutRow > [data-testid='layout-spacer'],
    .slot {
        flex: 0 0 auto;
    }
    .slot {
        position: relative;
    }
    :global(.dragTarget) {
        width: 80px;
        height: 80px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        background: #fbbf24;
        color: #111827;
        font-weight: 800;
        touch-action: none;
        user-select: none;
    }
    .shell {
        position: absolute;
        left: 80px;
        top: 90px;
        width: 560px;
        height: 380px;
        overflow: scroll;
        border: 3px solid #94a3b8;
        background: #111827;
    }
    .shellContent {
        position: relative;
        width: 1300px;
        height: 1000px;
    }
    .controlHandle {
        position: absolute;
        left: 700px;
        top: 210px;
        width: 130px;
        height: 48px;
        border: 2px solid #f8fafc;
        background: #be123c;
        color: white;
        touch-action: none;
    }
</style>
