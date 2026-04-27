<script lang="ts">
    import { useReducedMotion } from '$lib'

    const reduced = useReducedMotion()
    let forceReduced = $state(false)
    const effective = $derived($reduced || forceReduced)
</script>

<div class="flex min-h-screen w-full flex-col items-center justify-center gap-8 p-8">
    <div class="space-y-2 text-center">
        <h1 class="text-3xl font-bold">useReducedMotion</h1>
        <p class="text-gray-600">
            Toggles a continuous CSS rotation based on the user's <code
                class="rounded bg-gray-100 px-2 py-1">prefers-reduced-motion</code
            > setting.
        </p>
    </div>

    <div
        class="box"
        class:spin={!effective}
        data-testid="reduced-motion-box"
        data-reduced-motion={effective}
        data-os-reduced-motion={$reduced}
        aria-label={effective ? 'Animation disabled' : 'Animation enabled'}
    ></div>

    <div class="flex flex-col items-center gap-2">
        <p class="text-sm text-gray-600">
            OS preference (`prefers-reduced-motion`):
            <strong data-testid="os-preference">{$reduced ? 'reduce' : 'no-preference'}</strong>
        </p>
        <label class="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" data-testid="force-reduced-toggle" bind:checked={forceReduced} />
            Force reduced motion (in-page override)
        </label>
    </div>

    <div class="max-w-xl space-y-2 text-sm text-gray-600">
        <p>To simulate the OS preference without changing system settings:</p>
        <ul class="list-disc space-y-1 pl-5">
            <li>
                <strong>Chrome / Edge DevTools:</strong> open DevTools → ⋯ menu → More tools →
                Rendering → "Emulate CSS media feature
                <code class="rounded bg-gray-100 px-1">prefers-reduced-motion</code>" → reduce.
            </li>
            <li>
                <strong>Firefox:</strong> set
                <code class="rounded bg-gray-100 px-1">ui.prefersReducedMotion</code> to
                <code class="rounded bg-gray-100 px-1">1</code> in <code>about:config</code>.
            </li>
            <li>
                <strong>macOS:</strong> System Settings → Accessibility → Display → "Reduce motion" (location
                varies by macOS version; on recent versions it may sit under a separate Motion section).
            </li>
        </ul>
    </div>
</div>

<style>
    .box {
        width: 120px;
        height: 120px;
        border-radius: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .box.spin {
        animation: spin 4s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
</style>
