<script lang="ts">
    import { animate, motion } from '$lib'
    import { onMount } from 'svelte'
    import TesterPanel, { type TesterStep } from '../../layout/_parity/TesterPanel.svelte'

    // Svelte port of upstream motion
    // `dev/html/public/playwright/animate/animate-mixer.html` @ v14.9.1
    // (`transition.mixer`, Motion 14.8). Upstream calls `animate()` on each
    // element; here the single/filter/opacity/oklch cases go through
    // `motion.*` `animate` + `transition` props, and the sequence case keeps
    // `animate()` with a segment array, as upstream does.
    //
    // `#unset` covers Motion 14.9.1 writing path data to the `d` attribute
    // (upstream 0757359b3) and removing it when unset (upstream f84dcecf6).
    //
    // e2e/motion/transition-mixer.spec.ts.

    // Long, linear animations so the mid-point can be sampled
    const options = { duration: 10, ease: 'linear' } as const

    /**
     * The default mixer can't blend a triangle into a square, as they have
     * different numbers of points. This mixer slides the square's last
     * corner out of the triangle's.
     */
    const triangle = 'M10 10L90 10L90 90Z'
    const square = 'M10 10L90 10L90 90L10 90Z'
    const corner = () => (p: number) => (p >= 1 ? square : `M10 10L90 10L90 90L${90 - 80 * p} 90Z`)

    // Numbers blend as usual, so the opacity mixer is never called
    let opacityMixed = $state(false)
    const opacityMixer = () => {
        opacityMixed = true
        ;(window as unknown as { opacityMixed: boolean }).opacityMixed = true
        return undefined
    }

    let unsetD = $state<string | undefined>(triangle)

    // Tester readouts, sampled at 5 s (the mid-point)
    let corners = $state<number | null>(null)
    let filterValue = $state<string | null>(null)

    onMount(() => {
        ;(window as unknown as { opacityMixed: boolean }).opacityMixed = false

        const sequence = document.getElementById('sequence')
        if (sequence) animate([[sequence, { d: square }, { ...options, mixer: corner }]])

        const timer = setTimeout(() => {
            const d = document.getElementById('single')?.getAttribute('d') ?? ''
            corners = d.split(/[ML Z]+/).filter(Boolean).length / 2
            const filter = document.getElementById('filter')
            if (filter) filterValue = getComputedStyle(filter).filter
        }, 5000)
        return () => clearTimeout(timer)
    })

    const steps: TesterStep[] = [
        {
            text: 'Watch the first blue triangle for 10 seconds',
            expected:
                'The triangle grows a fourth corner that slides from the bottom-right to the bottom-left, ending as a square. The second shape does the same through a sequence. The chip reads 4 CORNERS at 5 s.',
            action: { label: 'Reload', run: () => location.reload() }
        },
        {
            text: 'Look at the first box',
            expected:
                'The box stays blurred at 5px the whole time (the mixer holds it there), so the filter chip reads blur(5px).'
        },
        {
            text: 'Look at the second box',
            expected:
                'Opacity fades in normally from 0 to 1 over 10 s; the mixer is never called, so the chip reads MIXER NOT CALLED.'
        },
        {
            text: 'Look at the third box',
            expected:
                'Its colour blends from red to a teal oklch colour as usual: a mixer that returns undefined leaves it to the browser.'
        },
        {
            text: 'Click "Unset d"',
            expected:
                'The last triangle disappears: its d attribute is removed, not written as "undefined".',
            action: {
                label: 'Unset d',
                run: () => document.getElementById('unset-button')?.click()
            }
        }
    ]
</script>

<svelte:head>
    <title>motion · transition.mixer</title>
</svelte:head>

<div class="fixture">
    <svg width="100" height="100" viewBox="0 0 100 100">
        <motion.path
            id="single"
            d={triangle}
            fill="#0077ff"
            animate={{ d: square }}
            transition={{ ...options, mixer: corner }}
        />
    </svg>
    <svg width="100" height="100" viewBox="0 0 100 100">
        <path id="sequence" d={triangle} fill="#0077ff" />
    </svg>

    <!-- Holds filter at one value, so the page can tell the mixer drives it -->
    <motion.div
        id="filter"
        class="box"
        animate={{ filter: ['blur(0px)', 'blur(10px)'] }}
        transition={{ ...options, mixer: () => () => 'blur(5px)' }}
    />
    <motion.div
        id="opacity"
        class="box"
        animate={{ opacity: [0, 1] }}
        transition={{ ...options, mixer: opacityMixer }}
    />
    <!-- Only the browser can blend oklch, so a mixer that declines it leaves it to WAAPI -->
    <motion.div
        id="oklch"
        class="box"
        animate={{ backgroundColor: ['#ff0000', 'oklch(0.7 0.1 200)'] }}
        transition={{ ...options, mixer: () => undefined }}
    />

    <svg width="100" height="100" viewBox="0 0 100 100">
        <motion.path id="unset" d={unsetD} fill="#0077ff" />
    </svg>
    <button id="unset-button" type="button" onclick={() => (unsetD = undefined)}>Unset d</button>
</div>

<TesterPanel
    eyebrow="Motion 14.8 · animate-mixer.html"
    title="transition.mixer"
    status="A mixer blends values Motion can't, such as SVG paths with different point counts."
    {steps}
>
    {#snippet summary()}
        <span class="verdict {corners === null ? 'na' : corners === 4 ? 'ok' : 'bad'}">
            {corners === null ? 'WAITING' : `${corners} CORNERS`}
        </span>
        <span
            class="verdict {filterValue === null
                ? 'na'
                : filterValue === 'blur(5px)'
                  ? 'ok'
                  : 'bad'}"
        >
            {filterValue ?? 'FILTER…'}
        </span>
        <span class="verdict {opacityMixed ? 'bad' : 'ok'}">
            {opacityMixed ? 'MIXER CALLED' : 'MIXER NOT CALLED'}
        </span>
    {/snippet}
    {#snippet checks()}
        <p>
            Upstream animate-mixer.html: a corner mixer morphs a triangle into a square (different
            point counts) through the d attribute, both on motion.path and inside an animate()
            sequence. A mixer holds filter at blur(5px). Numeric opacity ignores the mixer, and an
            oklch colour whose mixer returns undefined blends as usual.
        </p>
    {/snippet}
</TesterPanel>

<style>
    .fixture {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
        padding: 50px;
        max-width: calc(100vw - 420px);
    }
    .fixture :global(.box) {
        width: 100px;
        height: 100px;
        background-color: #0077ff;
    }
    .verdict {
        display: inline-block;
        margin-right: 0.25rem;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: 0.75rem;
        font-weight: 700;
    }
    .verdict.ok {
        background: #dcfce7;
        color: #166534;
    }
    .verdict.bad {
        background: #fee2e2;
        color: #991b1b;
    }
    .verdict.na {
        background: #f1f5f9;
        color: #475569;
    }
</style>
