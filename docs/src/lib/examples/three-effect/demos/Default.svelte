<script module lang="ts">
    import { animate, cancelFrame, frame, motionValue } from '@humanspeak/svelte-motion'
    import { threeEffect } from '@humanspeak/svelte-motion/three'

    /**
     * Registered once at module scope, never per component. The effect
     * registry is process-global and does not reference-count, so removing
     * `threeEffect` on one component's teardown would unregister it for
     * every other component still animating a mesh.
     */
    animate.addEffect(threeEffect)
</script>

<script lang="ts">
    import { onMount } from 'svelte'

    const progress = motionValue(0)

    let canvas = $state<HTMLCanvasElement | null>(null)
    let ready = $state(false)
    let rendererAvailable = $state(true)
    let displayedRotation = $state(0)
    let displayedProgress = $state(0)
    let targetProgress = $state(0)

    let mesh: import('three').Mesh | undefined
    let moveAnimation: { stop: () => void } | undefined
    let progressAnimation: { stop: () => void } | undefined

    const updateReadouts = () => {
        if (!mesh) return

        displayedRotation = mesh.rotation.y
        displayedProgress = progress.get()
    }

    const move = () => {
        if (!mesh) return

        moveAnimation?.stop()
        moveAnimation = animate(
            mesh,
            { x: 1.5, rotateY: 360 },
            { type: 'spring', stiffness: 80, damping: 12 }
        )
    }

    const setProgress = (event: Event) => {
        targetProgress = Number((event.currentTarget as HTMLInputElement).value)
        progressAnimation?.stop()
        progressAnimation = animate(progress, targetProgress, { duration: 0.25 })
    }

    onMount(() => {
        let disposed = false
        let renderer: import('three').WebGLRenderer | undefined
        let geometry: import('three').TorusKnotGeometry | undefined
        let material: import('three').ShaderMaterial | undefined
        let unbindUniforms: (() => void) | undefined
        let render: (() => void) | undefined

        const setup = async () => {
            const THREE = await import('three')
            if (disposed || !canvas) return

            const scene = new THREE.Scene()
            const camera = new THREE.PerspectiveCamera(42, 360 / 300, 0.1, 100)
            camera.position.z = 6

            const uniforms = { progress: { value: 0 } }
            material = new THREE.ShaderMaterial({
                uniforms,
                vertexShader: `
                    uniform float progress;
                    varying vec3 vNormal;

                    void main() {
                        vNormal = normal;
                        float wave = sin((position.y + progress) * 8.0) * progress * 0.12;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normal * wave, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform float progress;
                    varying vec3 vNormal;

                    void main() {
                        vec3 purple = vec3(0.49, 0.23, 0.93);
                        vec3 cyan = vec3(0.13, 0.83, 0.93);
                        float light = dot(normalize(vNormal), normalize(vec3(0.4, 0.8, 1.0)));
                        gl_FragColor = vec4(mix(purple, cyan, progress) * (0.7 + light * 0.4), 1.0);
                    }
                `
            })
            geometry = new THREE.TorusKnotGeometry(0.9, 0.28, 160, 24)
            mesh = new THREE.Mesh(geometry, material)
            scene.add(mesh)

            unbindUniforms = threeEffect(uniforms, { progress })
            frame.update(updateReadouts, true)

            try {
                renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
                renderer.setSize(360, 300, false)
                render = () => renderer?.render(scene, camera)
                frame.render(render, true)
            } catch {
                rendererAvailable = false
            }

            ready = true
        }

        void setup()

        return () => {
            disposed = true
            moveAnimation?.stop()
            progressAnimation?.stop()
            cancelFrame(updateReadouts)
            if (render) cancelFrame(render)
            unbindUniforms?.()
            renderer?.dispose()
            geometry?.dispose()
            material?.dispose()
            mesh = undefined
        }
    })

    $effect(() => () => progress.destroy())
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// three-effect</span>
            <span class="micro readout">
                rotateY <output>{displayedRotation.toFixed(2)}</output> rad · progress
                <output>{displayedProgress.toFixed(2)}</output>
            </span>
        </div>

        <div class="stage">
            <canvas bind:this={canvas} width="360" height="300"></canvas>
        </div>

        {#if !rendererAvailable}
            <p class="micro unavailable">WebGL unavailable — motion values remain active.</p>
        {/if}

        <div class="controls">
            <button onclick={move} disabled={!ready}>Move</button>
            <label class="micro" for="three-progress">progress {targetProgress.toFixed(2)}</label>
            <input
                id="three-progress"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={targetProgress}
                oninput={setProgress}
                disabled={!ready}
            />
        </div>

        <div class="strip-foot">
            <span class="micro">mesh + shader uniform</span>
            <span class="micro">frame.preRender</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 480px;
        padding: 1.5rem;
    }

    .strip {
        display: flex;
        width: 100%;
        max-width: 460px;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        color: var(--brut-ink-3, #9a9a9a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
        text-align: right;
        text-transform: none;
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding-bottom: 0.5rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
    }

    .strip-foot {
        padding-top: 0.75rem;
        padding-bottom: 0;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        border-bottom: none;
    }

    .stage {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        border: 1px solid var(--brut-rule, #d6dedb);
        background: #111827;
    }

    canvas {
        display: block;
        width: 360px;
        max-width: 100%;
        height: auto;
    }

    .unavailable {
        margin: 0;
    }

    .controls {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.5rem 1rem;
        align-items: center;
    }

    .controls input {
        grid-column: 1 / -1;
        width: 100%;
        accent-color: var(--brut-accent, #247768);
    }

    button {
        padding: 0.5rem 0.75rem;
        border: 1px solid var(--brut-ink, #1a2421);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #1a2421);
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        cursor: pointer;
    }

    button:disabled {
        cursor: wait;
        opacity: 0.5;
    }
</style>
