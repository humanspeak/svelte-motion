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
                        href={resolve('/tests/motion/enter-animation')}
                    >
                        Enter Animation
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/animate-presence')}
                    >
                        Animate Presence
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/html-content')}
                    >
                        HTML Content (0→100)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/aspect-ratio')}
                    >
                        Aspect Ratio
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/hover-and-tap')}
                    >
                        Hover + Tap
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/while-focus')}
                    >
                        While Focus
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/keyframes')}
                    >
                        Keyframes (shape + scale)
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion/initial-false')}
                    >
                        initial={'{false}'}
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
                        href={resolve('/tests/animation-frame')}
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
                        href={resolve('/tests/random/shiny-button')}
                    >
                        Shiny Button
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/fancy-like-button')}
                    >
                        Fancy Like Button
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/hover-opacity')}
                    >
                        Hover Opacity
                    </a>
                </li>
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/random/animated-border-gradient')}
                    >
                        Animated Border Gradient
                    </a>
                </li>
            </ul>
        </div>
    </div>
</div>
