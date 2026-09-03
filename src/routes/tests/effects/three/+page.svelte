<script lang="ts">
    import { onMount } from 'svelte'
    import { animate, cancelFrame, frame, motionValue } from '$lib'
    import { threeEffect } from '$lib/three'

    const progress = motionValue(0)

    let canvas = $state<HTMLCanvasElement | null>(null)
    let ready = $state(false)
    let rendererAvailable = $state(true)
    let displayedRotation = $state(0)
    let displayedProgress = $state(0)

    let mesh: import('three').Mesh | undefined
    let moveAnimation: { stop: () => void } | undefined
    let rippleAnimation: { stop: () => void } | undefined

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

    const ripple = () => {
        rippleAnimation?.stop()
        rippleAnimation = animate(progress, 1, { duration: 1 })
    }

    onMount(() => {
        let disposed = false
        let renderer: import('three').WebGLRenderer | undefined
        let geometry: import('three').TorusKnotGeometry | undefined
        let material: import('three').ShaderMaterial | undefined
        let unbindUniforms: (() => void) | undefined
        let render: (() => void) | undefined
        let effectRegistered = false

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

            animate.addEffect(threeEffect)
            effectRegistered = true
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
            rippleAnimation?.stop()
            cancelFrame(updateReadouts)
            if (render) cancelFrame(render)
            if (effectRegistered) animate.removeEffect(threeEffect)
            unbindUniforms?.()
            renderer?.dispose()
            geometry?.dispose()
            material?.dispose()
            mesh = undefined
        }
    })

    $effect(() => () => progress.destroy())
</script>

<div class="page">
    <h1>Three.js effect</h1>
    <p>
        Motion's effect registry springs a Three.js mesh while <code>threeEffect</code> drives the shader's
        ripple uniform.
    </p>

    <section class="card">
        <canvas bind:this={canvas} data-testid="three-canvas" width="360" height="300"></canvas>

        {#if !rendererAvailable}
            <p class="notice">WebGL unavailable — motion readouts remain active.</p>
        {/if}

        <div class="controls">
            <button data-testid="move" onclick={move} disabled={!ready}>Move</button>
            <button data-testid="ripple" onclick={ripple} disabled={!ready}>Ripple</button>
        </div>

        <div class="readout">
            rotateY: <output data-testid="rotate-y">{displayedRotation.toFixed(2)}</output>
            progress: <output data-testid="progress">{displayedProgress.toFixed(2)}</output>
        </div>
    </section>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    h1 {
        margin-bottom: 8px;
        font-size: 20px;
    }

    p {
        max-width: 560px;
        margin-bottom: 24px;
        color: #9ca3af;
    }

    .card {
        width: fit-content;
        padding: 20px;
        border: 1px solid #374151;
        border-radius: 16px;
        background: #171a21;
    }

    canvas {
        display: block;
        max-width: 100%;
        background: #111827;
    }

    .notice {
        margin: 12px 0 0;
        font-size: 13px;
    }

    .controls {
        display: flex;
        gap: 8px;
        margin-top: 16px;
    }

    button {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: #374151;
        color: #e5e7eb;
        cursor: pointer;
    }

    button:disabled {
        cursor: wait;
        opacity: 0.5;
    }

    .readout {
        display: flex;
        gap: 16px;
        margin-top: 16px;
        color: #9ca3af;
        font-family: monospace;
    }
</style>
