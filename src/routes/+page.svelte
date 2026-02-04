<script lang="ts">
    import { resolve } from '$app/paths'
    import { PersistedState } from 'runed'

    let debug = new PersistedState('debug', false)

    let searchParams = $derived(debug.current ? '?@isPlaywright=true' : '')
</script>

<div class="mx-auto max-w-5xl px-4 py-8">
    <h1 class="mb-6 text-2xl font-semibold">@humanspeak/svelte-motion — Demos</h1>
    <button
        class="btn inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:bg-blue-700"
        onclick={() => {
            debug.current = !debug.current
        }}
    >
        {debug.current ? 'Debug Mode: On' : 'Debug Mode: Off'}
    </button>
    <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
            <h2 class="mb-3 text-xl font-medium">Motion</h2>
            <ul class="list-disc space-y-2 pl-5">
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/enter-animation') + searchParams}
                    >
                        Enter Animation
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/html-content') + searchParams}
                    >
                        HTML Content (0→100)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/aspect-ratio') + searchParams}
                    >
                        Aspect Ratio
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/hover-and-tap') + searchParams}
                    >
                        Hover + Tap
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/while-focus') + searchParams}
                    >
                        While Focus
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/while-in-view') + searchParams}
                    >
                        While In View
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/keyframes') + searchParams}
                    >
                        Keyframes (shape + scale)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/initial-false') + searchParams}
                    >
                        initial={'{false}'}
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/svg-path-length') + searchParams}
                    >
                        SVG Path Length
                    </a>
                </li>
            </ul>
        </div>
        <div>
            <h2 class="mb-3 text-xl font-medium">Drag</h2>
            <ul class="list-disc space-y-2 pl-5">
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/basic') + searchParams}
                    >
                        Basic Drag
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/axis-x') + searchParams}
                    >
                        Drag Axis X
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/axis-y') + searchParams}
                    >
                        Drag Axis Y
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/constraints-ref') + searchParams}
                    >
                        Drag Constraints (ref)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/elastic') + searchParams}
                    >
                        Drag Elastic
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/momentum') + searchParams}
                    >
                        Drag Momentum
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/controls') + searchParams}
                    >
                        Drag Controls
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/lock-direction') + searchParams}
                    >
                        Drag: Lock Direction
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/snap-to-origin') + searchParams}
                    >
                        Drag: Snap To Origin
                    </a>
                </li>
            </ul>
        </div>
        <div>
            <h2 class="mb-3 text-xl font-medium">AnimatePresence</h2>
            <ul class="list-disc space-y-2 pl-5">
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/animate-presence/basic') + searchParams}
                    >
                        Basic (enter + exit)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/animate-presence/nested-keys') + searchParams}
                    >
                        Nested Keys (no key required)
                    </a>
                </li>
            </ul>
        </div>
        <div>
            <h2 class="mb-3 text-xl font-medium">Utilities</h2>
            <ul class="list-disc space-y-2 pl-5">
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/animation-frame') + searchParams}
                    >
                        useAnimationFrame
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/reactive-style') + searchParams}
                    >
                        styleString (Reactive Styles)
                    </a>
                </li>
            </ul>
        </div>
        <div>
            <h2 class="mb-3 text-xl font-medium">Random</h2>
            <ul class="list-disc space-y-2 pl-5">
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/shiny-button') + searchParams}
                    >
                        Shiny Button
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/fancy-like-button') + searchParams}
                    >
                        Fancy Like Button
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/hover-opacity') + searchParams}
                    >
                        Hover Opacity
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/animated-border-gradient') + searchParams}
                    >
                        Animated Border Gradient
                    </a>
                </li>
            </ul>
        </div>
    </div>
</div>
