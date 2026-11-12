<script lang="ts">
    import { page } from '$app/state'
    import { domMax, LazyMotion, m, motion, pinchFeatures, type PinchInfo } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    /**
     * Motion 14.11's `pinch` prop, `whilePinch` and the opt-in `pinchFeatures`
     * bundle on motion components.
     *
     * A port of upstream's fixture `dev/react/src/tests/pinch-while.tsx`
     * (Motion v14.12.0), driven by `e2e/pinch/prop.spec.ts`: whilePinch on the
     * box and, by variant label, on its child, a tap counter, and drag with its
     * release velocity. The 100x100 box sits at viewport (100, 100); nothing
     * else may cover (0, 0)-(450, 450) under `?@isPlaywright=true`, because the
     * spec's touch coordinates assume it.
     *
     * Query params, as upstream:
     * - `drag`: make the box draggable.
     * - `limits`: limit its scale to 1.5.
     *
     * Below it, for human testers only: upstream's `Pinch-photo.tsx` card and a
     * `motion.div pinch` outside any `LazyMotion`, which must not pinch.
     */
    const isDraggable = $derived(page.url.searchParams.has('drag'))
    const pinch = $derived(page.url.searchParams.has('limits') ? { scale: { max: 1.5 } } : true)

    let taps = $state(0)
    let velocity = $state<number | null>(null)
    let hydrated = $state(false)
    let isTester = $state(false)

    let box = $state<HTMLElement | null>(null)
    let child = $state<HTMLElement | null>(null)
    let photo = $state<HTMLElement | null>(null)
    let outside = $state<HTMLElement | null>(null)

    // Live readouts for the tester panel's verdicts.
    let boxOpacity = $state(1)
    let childOpacity = $state(1)
    let sawWhilePinch = $state(false)
    let restoredAfterPinch = $state(false)

    type Pose = { scale: number; rotate: number }
    let photoPose = $state<Pose>({ scale: 1, rotate: 0 })
    let photoPinching = $state(false)
    let photoMaxScale = $state(1)
    let photoMaxTwist = $state(0)
    let photoReleased = $state(false)
    let photoRest = $state<Pose | null>(null)
    let outsidePose = $state<Pose>({ scale: 1, rotate: 0 })
    let outsideMaxScale = $state(1)

    /** Reads scale and rotation (degrees) from an element's computed transform. */
    const readPose = (element: HTMLElement): Pose => {
        const transform = getComputedStyle(element).transform
        if (!transform || transform === 'none') return { scale: 1, rotate: 0 }
        const matrix = new DOMMatrixReadOnly(transform)
        return {
            scale: Math.hypot(matrix.a, matrix.b),
            rotate: (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
        }
    }

    const photoPinch = {
        scale: { min: 1, max: 4 },
        rotate: { snap: 90 },
        onStart: () => {
            photoPinching = true
            photoReleased = false
            photoRest = null
            photoMaxScale = 1
            photoMaxTwist = 0
        },
        onMove: (_: Event, info: PinchInfo) => {
            photoMaxScale = Math.max(photoMaxScale, info.scale)
            photoMaxTwist = Math.max(photoMaxTwist, Math.abs(info.rotate))
        },
        onEnd: () => {
            photoPinching = false
            photoReleased = true
        }
    }

    onMount(() => {
        hydrated = true
        isTester = !window.location.search.includes('@isPlaywright=true')
        if (!isTester) return

        let raf = 0
        let still = 0
        let last: Pose | null = null
        const tick = () => {
            if (box && child) {
                boxOpacity = Number(getComputedStyle(box).opacity)
                childOpacity = Number(getComputedStyle(child).opacity)
                if (boxOpacity === 0.5 && childOpacity === 0.25) {
                    sawWhilePinch = true
                    restoredAfterPinch = false
                } else if (sawWhilePinch && boxOpacity === 1 && childOpacity === 1) {
                    restoredAfterPinch = true
                }
            }
            if (photo) {
                const pose = readPose(photo)
                photoPose = pose
                // The resting pose: no change for 20 frames after a release.
                const moved =
                    !last ||
                    Math.abs(pose.scale - last.scale) > 1e-4 ||
                    Math.abs(pose.rotate - last.rotate) > 1e-3
                still = moved ? 0 : still + 1
                last = pose
                if (photoReleased && !photoPinching && still >= 20 && !photoRest) {
                    photoRest = pose
                }
            }
            if (outside) {
                outsidePose = readPose(outside)
                outsideMaxScale = Math.max(outsideMaxScale, outsidePose.scale)
            }
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    })

    const near = (value: number, target: number, tolerance: number) =>
        Math.abs(value - target) <= tolerance
    /** Distance from the nearest multiple of 90°. */
    const offSnap = (rotate: number) => Math.abs(rotate - Math.round(rotate / 90) * 90)

    const steps: TesterStep[] = [
        {
            text: 'On a trackpad, put the cursor over the red box and pinch outward, then stop.',
            expected:
                'The box grows around the cursor (the page does not zoom), fades to 50% and its white child to 25%. Both return to full opacity about 150 ms after you stop.'
        },
        {
            text: 'Click (or tap) the red box once.',
            expected:
                'taps goes up by 1 and the box flashes blue while pressed. A pinch never counts as a tap.'
        },
        {
            text: 'Pinch the gradient photo card out past 4× and let go.',
            expected: 'It resists past 4× and springs back to exactly 4× on release.'
        },
        {
            text: 'On a touch screen (an iOS Simulator: option-drag), twist the photo card with two fingers and let go. A Mac trackpad in Chrome reports no rotation; rotation needs touches or Safari.',
            expected: 'It rotates with the fingers, then snaps to the nearest 90° on release.'
        },
        {
            text: 'Drag the photo card with one finger, then put a second finger down and pinch.',
            expected:
                'No jump when the second finger lands or lifts: the card stays under your fingers.'
        },
        {
            text: 'Pinch the grey card on the right, which is a motion.div with pinch outside any LazyMotion.',
            expected:
                'The card does nothing. With a trackpad the whole page zooms instead (press ⌘0 to reset the zoom).'
        }
    ]
</script>

<svelte:head>
    <title>pinch prop, whilePinch and pinchFeatures</title>
</svelte:head>

<div class="below">
    <LazyMotion features={{ ...domMax, ...pinchFeatures }}>
        <m.div
            id="box"
            bind:ref={box}
            drag={isDraggable}
            dragMomentum={false}
            {pinch}
            whilePinch="pinching"
            whileTap={{ backgroundColor: 'rgb(0, 0, 255)' }}
            onTap={() => taps++}
            onDragEnd={(_, info) => (velocity = info.velocity.x)}
            transition={{ duration: 0 }}
            variants={{ pinching: { opacity: 0.5 } }}
            style="position: fixed; left: 100px; top: 100px; width: 100px; height: 100px; background-color: rgb(255, 0, 0)"
        >
            <m.div
                id="child"
                bind:ref={child}
                transition={{ duration: 0 }}
                variants={{ pinching: { opacity: 0.25 } }}
                style="width: 20px; height: 20px; background: white"
            />
        </m.div>

        <p class="outputs">
            taps: <output id="taps" data-hydrated={hydrated || undefined}>{taps}</output>
            · drag velocity x: <output id="velocity">{velocity ?? ''}</output>
        </p>

        {#if isTester}
            <div class="slot">
                <p class="label">Photo card: motion.div, pinch scale 1–4×, rotate snap 90°</p>
                <motion.div
                    class="card photo"
                    data-testid="photo"
                    bind:ref={photo}
                    drag
                    dragMomentum={false}
                    pinch={photoPinch}
                />
            </div>
        {/if}
    </LazyMotion>

    {#if isTester}
        <div class="slot">
            <p class="label">Outside LazyMotion: motion.div pinch (must not pinch)</p>
            <motion.div class="card outside" data-testid="outside" bind:ref={outside} pinch />
        </div>
    {/if}
</div>

<TesterPanel
    eyebrow="tests/react/pinch.spec.ts"
    title="pinch prop, whilePinch and pinchFeatures"
    status="Expected to pass on this build: every verdict turns ✓ once you have done its step. The Reset page button reloads the page, which puts every card back and clears taps and the verdicts."
    {steps}
>
    {#snippet checks()}
        <p>
            <code>pinch</code> scales, rotates and moves a motion component with two touches, a
            trackpad pinch (ctrl + wheel) or Safari's gesture events, and
            <code>whilePinch</code> animates while the pinch lasts (here by variant label, so the
            child follows). It is opt-in: only components under a
            <code
                >&lt;LazyMotion features=&#123;&#123; ...domMax, ...pinchFeatures &#125;&#125;&gt;</code
            >
            pinch. The red box is a port of upstream's <code>pinch-while.tsx</code> fixture; open
            <code>?drag</code> or <code>?limits</code> by editing the URL, as upstream.
        </p>
    {/snippet}

    <dl class="verdicts" data-testid="verdicts">
        <dt>Red box opacity (box / child)</dt>
        <dd>{boxOpacity} / {childOpacity}</dd>
        <dt>whilePinch seen, then restored</dt>
        <dd>
            {#if sawWhilePinch && restoredAfterPinch}
                <span class="verdict ok">✓</span>
            {:else if sawWhilePinch}
                <span class="verdict wait">pinching…</span>
            {:else}
                <span class="verdict wait">not yet</span>
            {/if}
        </dd>
        <dt>Taps</dt>
        <dd>
            {taps}
            {#if taps > 0}<span class="verdict ok">✓</span>{:else}<span class="verdict wait"
                    >not yet</span
                >{/if}
        </dd>
        <dt>Photo card now</dt>
        <dd>{photoPose.scale.toFixed(2)}× · {photoPose.rotate.toFixed(1)}°</dd>
        <dt>Past 4×, springs back to 4×</dt>
        <dd>
            {#if photoRest && photoMaxScale > 4}
                {#if near(photoRest.scale, 4, 0.02)}
                    <span class="verdict ok">✓ rest {photoRest.scale.toFixed(2)}×</span>
                {:else}
                    <span class="verdict bad">✗ rest {photoRest.scale.toFixed(2)}×</span>
                {/if}
            {:else}
                <span class="verdict wait">not yet (peak {photoMaxScale.toFixed(2)}×)</span>
            {/if}
        </dd>
        <dt>Twist snaps to 90°</dt>
        <dd>
            {#if photoRest && photoMaxTwist > 10}
                {#if offSnap(photoRest.rotate) < 0.5}
                    <span class="verdict ok">✓ rest {photoRest.rotate.toFixed(1)}°</span>
                {:else}
                    <span class="verdict bad">✗ rest {photoRest.rotate.toFixed(1)}°</span>
                {/if}
            {:else}
                <span class="verdict wait">not yet (touch only)</span>
            {/if}
        </dd>
        <dt>Outside LazyMotion stays 1×</dt>
        <dd>
            {#if outsideMaxScale > 1.001}
                <span class="verdict bad">✗ reached {outsideMaxScale.toFixed(2)}×</span>
            {:else}
                <span class="verdict ok">✓ {outsidePose.scale.toFixed(2)}×</span>
            {/if}
        </dd>
        <dt>Drag, then pinch: no jump</dt>
        <dd><span class="verdict wait">judge by eye</span></dd>
    </dl>
</TesterPanel>

<style>
    /* Everything but the fixed box flows below (0, 0)-(450, 450), and wraps
       to one column on a phone-width screen (an iOS Simulator). */
    .below {
        display: flex;
        flex-wrap: wrap;
        gap: 32px 120px;
        padding: 460px 16px 32px 100px;
    }

    .outputs {
        flex-basis: 100%;
        margin: 0;
        font-family: system-ui, sans-serif;
        font-size: 13px;
    }

    @media (max-width: 640px) {
        .below {
            padding-left: 16px;
        }
    }

    .label {
        margin: 0 0 12px;
        width: 300px;
        font-family: system-ui, sans-serif;
        font-size: 13px;
    }

    :global(.card) {
        width: 300px;
        height: 200px;
        border-radius: 20px;
    }

    :global(.card.photo) {
        background: linear-gradient(135deg, #ff0088 0%, #8800ff 100%);
    }

    :global(.card.outside) {
        background: #94a3b8;
    }

    .verdicts {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 4px 12px;
        margin: 0;
        font-size: 12px;
    }

    .verdicts dd {
        margin: 0;
        text-align: right;
        font-family: monospace;
    }

    .verdict {
        display: inline-block;
        margin-left: 0.25rem;
        padding: 0.05rem 0.45rem;
        border-radius: 999px;
        font-weight: 600;
    }

    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }

    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }

    .verdict.wait {
        background: #e2e8f0;
        color: #334155;
    }
</style>
