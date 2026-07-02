<script lang="ts">
    import { animateView } from '$lib'

    let dark = $state(false)
    let transitions = $state(0)
    let settled = $state(0)

    const toggle = async () => {
        transitions += 1
        // `.layout()` on the implicit root subject opts the page into the
        // root crossfade — without any registered target, animateView
        // swaps instantly by design (motion-dom suppresses root capture).
        await animateView(
            () => {
                dark = !dark
            },
            { duration: 0.5 }
        ).layout()
        settled += 1
    }
</script>

<div class="page" class:dark data-testid="page">
    <h1>animateView — basic root crossfade</h1>
    <p>
        Clicking the button swaps the theme inside <code>animateView</code>. Browsers with the View
        Transitions API crossfade between the two states; others swap instantly.
    </p>

    <button data-testid="toggle" onclick={toggle}>
        Switch to {dark ? 'light' : 'dark'}
    </button>

    <div class="card" data-testid="card">
        {dark ? '🌙 Night mode' : '☀️ Day mode'}
    </div>

    <div data-testid="stats">transitions:{transitions} settled:{settled}</div>
    <div data-testid="mode">{dark ? 'dark' : 'light'}</div>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #f8fafc;
        color: #0f1115;
        font-family: system-ui, sans-serif;
    }

    .page.dark {
        background: #0f1115;
        color: #e5e7eb;
    }

    h1 {
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        max-width: 480px;
        margin-bottom: 24px;
        opacity: 0.7;
    }

    button {
        padding: 10px 18px;
        border: none;
        border-radius: 10px;
        background: #6366f1;
        color: white;
        font-weight: 600;
        cursor: pointer;
    }

    .card {
        margin-top: 24px;
        width: 260px;
        padding: 32px;
        border-radius: 16px;
        background: white;
        color: #0f1115;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        font-size: 20px;
        font-weight: 600;
    }

    .page.dark .card {
        background: #1f2937;
        color: #e5e7eb;
    }

    [data-testid='stats'],
    [data-testid='mode'] {
        margin-top: 16px;
        font-family: monospace;
        opacity: 0.6;
    }
</style>
