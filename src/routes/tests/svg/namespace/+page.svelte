<script lang="ts">
    import { motion, AnimatePresence } from '$lib'

    // Toggle for mounting/unmounting SVG elements
    let showSvg = $state(true)

    // Element references to check namespace
    // Note: Using HTMLElement due to motion component type constraints, but these will
    // actually hold SVG elements at runtime (which have namespaceURI property)
    let svgElement = $state<HTMLElement | null>(null)
    let pathElement = $state<HTMLElement | null>(null)
    let circleElement = $state<HTMLElement | null>(null)
    let lineElement = $state<HTMLElement | null>(null)

    // Computed namespace info (using $derived.by for lazy evaluation)
    const svgInfo = $derived.by(() => {
        if (!svgElement) return { namespace: 'not mounted', type: 'N/A' }
        return {
            namespace: svgElement.namespaceURI ?? 'null',
            type: svgElement.constructor.name
        }
    })

    const pathInfo = $derived.by(() => {
        if (!pathElement) return { namespace: 'not mounted', type: 'N/A' }
        return {
            namespace: pathElement.namespaceURI ?? 'null',
            type: pathElement.constructor.name
        }
    })

    const circleInfo = $derived.by(() => {
        if (!circleElement) return { namespace: 'not mounted', type: 'N/A' }
        return {
            namespace: circleElement.namespaceURI ?? 'null',
            type: circleElement.constructor.name
        }
    })

    const lineInfo = $derived.by(() => {
        if (!lineElement) return { namespace: 'not mounted', type: 'N/A' }
        return {
            namespace: lineElement.namespaceURI ?? 'null',
            type: lineElement.constructor.name
        }
    })

    const expectedNamespace = 'http://www.w3.org/2000/svg'

    function isCorrectNamespace(ns: string): boolean {
        return ns === expectedNamespace
    }
</script>

<div class="svg-namespace-page bg-gray-900 p-8 text-white">
    <div class="mx-auto max-w-4xl pb-8">
        <h1 class="mb-4 text-center text-3xl font-bold">SVG Namespace Test</h1>

        <p class="mb-8 text-center text-gray-400">
            This page tests that <code class="rounded bg-gray-800 px-2 py-1">motion.*</code> SVG
            elements are created in the correct SVG namespace, even inside
            <code class="rounded bg-gray-800 px-2 py-1">AnimatePresence</code>.
        </p>

        <!-- Toggle Button -->
        <div class="mb-8 flex justify-center">
            <button
                onclick={() => (showSvg = !showSvg)}
                data-testid="toggle-svg"
                class="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-700"
            >
                {showSvg ? 'Unmount SVG (Exit Animation)' : 'Mount SVG (Enter Animation)'}
            </button>
        </div>

        <!-- SVG Demo Area -->
        <div class="mb-8 flex min-h-64 items-center justify-center rounded-lg bg-gray-800 p-8">
            <AnimatePresence>
                {#if showSvg}
                    <motion.svg
                        key="test-svg"
                        bind:ref={svgElement}
                        data-testid="motion-svg"
                        width="200"
                        height="200"
                        viewBox="0 0 200 200"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.3 }}
                    >
                        <motion.circle
                            key="test-circle"
                            bind:ref={circleElement}
                            data-testid="motion-circle"
                            cx="100"
                            cy="100"
                            r="80"
                            fill="none"
                            stroke="#3b82f6"
                            stroke-width="4"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1 }}
                        />
                        <motion.path
                            key="test-path"
                            bind:ref={pathElement}
                            data-testid="motion-path"
                            d="M 50 100 Q 100 50 150 100 Q 100 150 50 100"
                            fill="none"
                            stroke="#10b981"
                            stroke-width="3"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1, delay: 0.2 }}
                        />
                        <motion.line
                            key="test-line"
                            bind:ref={lineElement}
                            data-testid="motion-line"
                            x1="40"
                            y1="40"
                            x2="160"
                            y2="160"
                            stroke="#f59e0b"
                            stroke-width="2"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5, delay: 0.5 }}
                        />
                    </motion.svg>
                {/if}
            </AnimatePresence>
        </div>

        <!-- Namespace Info Table -->
        <div class="rounded-lg bg-gray-800 p-6">
            <h2 class="mb-4 text-xl font-semibold">Namespace Information</h2>
            <p class="mb-4 text-sm text-gray-400">
                Expected namespace:
                <code class="rounded bg-gray-700 px-2 py-1 text-green-400">{expectedNamespace}</code
                >
            </p>

            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="border-b border-gray-700">
                        <tr>
                            <th class="px-4 py-3">Element</th>
                            <th class="px-4 py-3">Namespace URI</th>
                            <th class="px-4 py-3">Element Type</th>
                            <th class="px-4 py-3">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr class="border-b border-gray-700">
                            <td class="px-4 py-3 font-mono">motion.svg</td>
                            <td class="px-4 py-3 font-mono text-xs">{svgInfo.namespace}</td>
                            <td class="px-4 py-3 font-mono">{svgInfo.type}</td>
                            <td class="px-4 py-3">
                                {#if svgInfo.namespace === 'not mounted'}
                                    <span class="text-gray-500">Not Mounted</span>
                                {:else if isCorrectNamespace(svgInfo.namespace)}
                                    <span class="text-green-400">Correct</span>
                                {:else}
                                    <span class="text-red-400">Incorrect</span>
                                {/if}
                            </td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="px-4 py-3 font-mono">motion.path</td>
                            <td class="px-4 py-3 font-mono text-xs">{pathInfo.namespace}</td>
                            <td class="px-4 py-3 font-mono">{pathInfo.type}</td>
                            <td class="px-4 py-3">
                                {#if pathInfo.namespace === 'not mounted'}
                                    <span class="text-gray-500">Not Mounted</span>
                                {:else if isCorrectNamespace(pathInfo.namespace)}
                                    <span class="text-green-400">Correct</span>
                                {:else}
                                    <span class="text-red-400">Incorrect</span>
                                {/if}
                            </td>
                        </tr>
                        <tr class="border-b border-gray-700">
                            <td class="px-4 py-3 font-mono">motion.circle</td>
                            <td class="px-4 py-3 font-mono text-xs">{circleInfo.namespace}</td>
                            <td class="px-4 py-3 font-mono">{circleInfo.type}</td>
                            <td class="px-4 py-3">
                                {#if circleInfo.namespace === 'not mounted'}
                                    <span class="text-gray-500">Not Mounted</span>
                                {:else if isCorrectNamespace(circleInfo.namespace)}
                                    <span class="text-green-400">Correct</span>
                                {:else}
                                    <span class="text-red-400">Incorrect</span>
                                {/if}
                            </td>
                        </tr>
                        <tr>
                            <td class="px-4 py-3 font-mono">motion.line</td>
                            <td class="px-4 py-3 font-mono text-xs">{lineInfo.namespace}</td>
                            <td class="px-4 py-3 font-mono">{lineInfo.type}</td>
                            <td class="px-4 py-3">
                                {#if lineInfo.namespace === 'not mounted'}
                                    <span class="text-gray-500">Not Mounted</span>
                                {:else if isCorrectNamespace(lineInfo.namespace)}
                                    <span class="text-green-400">Correct</span>
                                {:else}
                                    <span class="text-red-400">Incorrect</span>
                                {/if}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Expected Behavior -->
        <div class="mt-8 rounded-lg bg-gray-800 p-6">
            <h2 class="mb-4 text-xl font-semibold">Expected Behavior</h2>
            <ul class="list-inside list-disc space-y-2 text-gray-300">
                <li>
                    All SVG elements should have namespace:
                    <code class="rounded bg-gray-700 px-1">http://www.w3.org/2000/svg</code>
                </li>
                <li>
                    Element types should be <code class="rounded bg-gray-700 px-1"
                        >SVGSVGElement</code
                    >,
                    <code class="rounded bg-gray-700 px-1">SVGPathElement</code>,
                    <code class="rounded bg-gray-700 px-1">SVGCircleElement</code>,
                    <code class="rounded bg-gray-700 px-1">SVGLineElement</code>
                </li>
                <li>
                    <strong>Not</strong>
                    <code class="rounded bg-gray-700 px-1">HTMLUnknownElement</code> or HTML namespace
                </li>
                <li>Mount/unmount via AnimatePresence should preserve correct namespace</li>
            </ul>
        </div>
    </div>
</div>

<style>
    :global(html),
    :global(body) {
        overflow: auto !important;
        height: auto !important;
    }

    :global(#sandbox) {
        height: auto !important;
        align-items: flex-start !important;
    }

    :global(.container) {
        height: auto !important;
        align-items: flex-start !important;
    }

    .svg-namespace-page {
        min-height: 100vh;
        width: 100%;
    }
</style>
