<script lang="ts">
    import { page } from '$app/state'
    import {
        MotionConfig,
        cancelFrame,
        frame,
        motion,
        type DragInfo,
        type MotionTransformPoint
    } from '$lib'
    import { onMount } from 'svelte'

    const caseId = $derived(page.url.searchParams.get('case') ?? 'pan-config-inherit')
    const configKind = $derived(
        caseId === 'pan-no-config-end'
            ? 'none'
            : caseId === 'pan-config-inherit'
              ? 'inherit'
              : caseId === 'pan-config-identity'
                ? 'identity'
                : caseId === 'pan-config-explicit-undefined'
                  ? 'undefined'
                  : caseId === 'pan-nonuniform-affine'
                    ? 'nonuniform'
                    : caseId === 'pan-stable-closure-scale'
                      ? 'stable'
                      : 'double'
    )
    const usesAncestor = $derived(caseId === 'pan-ancestor-scroll-held')

    let mounted = $state(true)
    let ready = $state(false)
    type MappingKind = 'none' | 'double' | 'triple' | 'nonuniform-affine'
    let mappingKind = $state<MappingKind>('double')
    let stableScale = 2
    let visualScale = $state({ x: 0.5, y: 0.5 })
    let panOffset = $state({ x: 0, y: 0 })
    let callbackInfo = $state<DragInfo | null>(null)
    let ends = $state(0)
    let stage: HTMLElement | null = $state(null)
    let shell: HTMLElement | null = $state(null)
    let target: HTMLElement | null = $state(null)
    let follower: HTMLElement | null = $state(null)

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

    const double = traced('double', ({ x, y }) => ({ x: x * 2, y: y * 2 }))
    const triple = traced('triple', ({ x, y }) => ({ x: x * 3, y: y * 3 }))
    const nonuniform = traced('nonuniform-affine', ({ x, y }) => ({
        x: x * 2 + 37,
        y: y * 0.5 - 23
    }))
    const stable = traced('stable-closure', ({ x, y }) => ({
        x: x * stableScale,
        y: y * stableScale
    }))
    const identity: MotionTransformPoint = traced('identity', ({ x, y }) => ({ x, y }))
    const activeTransform = $derived(
        configKind === 'stable'
            ? stable
            : mappingKind === 'triple'
              ? triple
              : configKind === 'nonuniform'
                ? nonuniform
                : double
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
                board: null,
                slot: null,
                target: rect(target),
                handle: null,
                follower: rect(follower)
            },
            boundValues: { x: 0, y: 0, panOffset: point(panOffset) }
        }
        parity.snapshots.push(snapshot)
        return snapshot
    }

    const record = (name: string, event: PointerEvent, info: DragInfo) => {
        trace(name, {
            event: eventRecord(event),
            info: infoRecord(info),
            callbackRenderState: { mappingKind, stableScale },
            rendered: { target: rect(target), follower: rect(follower) },
            boundValues: { x: 0, y: 0 }
        })
        if (name === 'onPanStart' || name === 'onPan' || name === 'onPanEnd') {
            panOffset = point(info.offset)
            callbackInfo = info
        }
        if (name === 'onPanEnd') ends += 1
    }

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
            }) as (...args: never[]) => unknown,
            setStableScale: ((value: number) => {
                stableScale = value
                visualScale = { x: 1 / value, y: 1 / value }
            }) as (...args: never[]) => unknown,
            resizeBoard: (() => {}) as (...args: never[]) => unknown,
            shiftLayout: (() => {}) as (...args: never[]) => unknown,
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

{#snippet panTarget()}
    {#if mounted}
        <motion.div
            bind:ref={target}
            data-testid="target"
            class="panTarget"
            onPanSessionStart={(event, info) => record('onPanSessionStart', event, info)}
            onPanStart={(event, info) => record('onPanStart', event, info)}
            onPan={(event, info) => record('onPan', event, info)}
            onPanEnd={(event, info) => record('onPanEnd', event, info)}
        >
            <div
                bind:this={follower}
                data-testid="follower"
                class="follower"
                style:transform={`translate(${panOffset.x}px, ${panOffset.y}px)`}
            ></div>
            pan surface
        </motion.div>
    {/if}
{/snippet}

{#snippet configuredTarget()}
    {#if configKind === 'none'}
        {@render panTarget()}
    {:else if configKind === 'inherit'}
        <MotionConfig transformPagePoint={double}>
            <MotionConfig>{@render panTarget()}</MotionConfig>
        </MotionConfig>
    {:else if configKind === 'identity'}
        <MotionConfig transformPagePoint={double}>
            <MotionConfig transformPagePoint={identity}>{@render panTarget()}</MotionConfig>
        </MotionConfig>
    {:else if configKind === 'undefined'}
        <MotionConfig transformPagePoint={double}>
            <MotionConfig transformPagePoint={undefined}>{@render panTarget()}</MotionConfig>
        </MotionConfig>
    {:else}
        <MotionConfig transformPagePoint={activeTransform}>{@render panTarget()}</MotionConfig>
    {/if}
{/snippet}

<svelte:head><title>transformPagePoint pan reference</title></svelte:head>

<main data-testid="fixture" data-case={caseId} data-ready={ready}>
    <div class="caseLabel">{caseId}</div>
    {#if usesAncestor}
        <div bind:this={shell} data-testid="shell" class="shell">
            <div class="shellContent">
                <div bind:this={stage} data-testid="stage" class="stage stageInShell">
                    <div class="panPlacement">{@render configuredTarget()}</div>
                </div>
            </div>
        </div>
    {:else}
        <div
            bind:this={stage}
            data-testid="stage"
            class="stage"
            style:transform={configKind === 'none'
                ? 'none'
                : configKind === 'nonuniform'
                  ? 'translate(40px, -30px) scale(0.5, 2)'
                  : `scale(${visualScale.x}, ${visualScale.y})`}
        >
            <div class="panPlacement">{@render configuredTarget()}</div>
        </div>
    {/if}

    <aside class="controls">
        <button onclick={() => (mappingKind = mappingKind === 'double' ? 'triple' : 'double')}
            >replace mapping</button
        >
        <button onclick={() => parity.actions.setStableScale?.(4 as never)}>stable scale ×4</button>
        <button onclick={() => (mounted = !mounted)}>toggle target</button>
        <output
            data-testid="pan-output"
            data-offset-x={callbackInfo?.offset.x ?? 0}
            data-offset-y={callbackInfo?.offset.y ?? 0}
            data-delta-x={callbackInfo?.delta.x ?? 0}
            data-delta-y={callbackInfo?.delta.y ?? 0}
            data-velocity-x={callbackInfo?.velocity.x ?? 0}
            data-velocity-y={callbackInfo?.velocity.y ?? 0}
            data-ends={ends}>offset {panOffset.x}, {panOffset.y}</output
        >
    </aside>
</main>

<style>
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
        transform: scale(0.5);
    }
    .panPlacement {
        position: relative;
        width: 440px;
        height: 280px;
    }
    :global(.panTarget) {
        position: absolute;
        left: 60px;
        top: 50px;
        width: 320px;
        height: 180px;
        display: grid;
        place-items: center;
        overflow: hidden;
        box-sizing: border-box;
        border: 4px solid #60a5fa;
        background: #172554;
        color: white;
        touch-action: none;
        user-select: none;
    }
    .follower {
        position: absolute;
        left: 132px;
        top: 62px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #fb7185;
        pointer-events: none;
    }
    .shell {
        position: absolute;
        left: 80px;
        top: 90px;
        width: 560px;
        height: 380px;
        overflow: scroll;
        box-sizing: border-box;
        border: 3px solid #94a3b8;
        background: #111827;
    }
    .shellContent {
        position: relative;
        width: 1300px;
        height: 1000px;
    }
</style>
