<script lang="ts">
    import { resolve } from '$app/paths'
</script>

<div class="mx-auto max-w-5xl px-4 py-8">
    <h1 class="mb-6 text-2xl font-semibold">@humanspeak/svelte-motion — Demos</h1>
    <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
            <h2 class="mb-3 text-xl font-medium">Motion</h2>
            <ul class="list-disc space-y-2 pl-5">
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/enter-animation?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Enter Animation
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/animate-presence?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Animate Presence
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/html-content?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        HTML Content (0→100)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/aspect-ratio?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Aspect Ratio
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/hover-and-tap?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Hover + Tap
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/while-focus?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        While Focus
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/keyframes?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Keyframes (shape + scale)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/initial-false?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        initial={'{false}'}
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/svg-path-length?@humanspeak-svelte-motion-isPlaywright=true')}
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
                    <a class="text-blue-300 hover:underline" href={resolve('/tests/drag/basic?@humanspeak-svelte-motion-isPlaywright=true')}>
                        Basic Drag
                    </a>
                </li>
                <li>
                    <a class="text-blue-300 hover:underline" href={resolve('/tests/drag/axis-x?@humanspeak-svelte-motion-isPlaywright=true')}>
                        Drag Axis X
                    </a>
                </li>
                <li>
                    <a class="text-blue-300 hover:underline" href={resolve('/tests/drag/axis-y?@humanspeak-svelte-motion-isPlaywright=true')}>
                        Drag Axis Y
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/drag/constraints-ref?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Drag Constraints (ref)
                    </a>
                </li>
                <li>
                    <a class="text-blue-300 hover:underline" href={resolve('/tests/drag/elastic?@humanspeak-svelte-motion-isPlaywright=true')}>
                        Drag Elastic
                    </a>
                </li>
                <li>
                    <a class="text-blue-300 hover:underline" href={resolve('/tests/drag/momentum?@humanspeak-svelte-motion-isPlaywright=true')}>
                        Drag Momentum
                    </a>
                </li>
                <li>
                    <a class="text-blue-300 hover:underline" href={resolve('/tests/drag/controls?@humanspeak-svelte-motion-isPlaywright=true')}>
                        Drag Controls
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
                        href={resolve('/tests/animation-frame?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        useAnimationFrame
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
                        href={resolve('/tests/random/shiny-button?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Shiny Button
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/fancy-like-button?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Fancy Like Button
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/hover-opacity?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Hover Opacity
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/animated-border-gradient?@humanspeak-svelte-motion-isPlaywright=true')}
                    >
                        Animated Border Gradient
                    </a>
                </li>
            </ul>
        </div>
    </div>
</div>
