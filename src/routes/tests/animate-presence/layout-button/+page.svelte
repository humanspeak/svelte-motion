<script lang="ts">
    import ModeButton from './ModeButton.svelte'
</script>

<svelte:head>
    <title>AnimatePresence + layout button · regression test</title>
</svelte:head>

<main class="page" data-testid="layout-button-page">
    <section class="panel">
        <div class="intro">
            <p class="eyebrow">AnimatePresence / layout</p>
            <h1>Button content swap</h1>
            <p class="lede">
                The button should spring between <code>copy</code> and <code>copied</code> without clipping
                or visually scaling the label. Each row exercises a different presence mode against layout
                projection attributes.
            </p>
        </div>

        <div class="demos">
            <ModeButton mode="wait" title="Wait" testIdPrefix="wait" />
            <ModeButton mode="sync" title="Sync" testIdPrefix="sync" />
            <ModeButton mode="popLayout" title="Pop layout" testIdPrefix="pop-layout" />
        </div>
    </section>
</main>

<style>
    :global(body) {
        margin: 0;
        background: #0b0d10;
        color: #ecfdf5;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        min-height: 100%;
        height: auto;
        overflow-y: auto;
    }
    :global(html) {
        min-height: 100%;
        height: auto;
        overflow-y: auto;
    }
    :global(body > .h-full),
    :global(body > .h-full > .h-full),
    :global(.container),
    :global(#sandbox) {
        min-height: 100vh;
        height: auto;
    }
    :global(.container),
    :global(#sandbox) {
        align-items: flex-start;
        justify-content: center;
    }
    .page {
        min-height: 100vh;
        display: grid;
        align-items: start;
        justify-items: center;
        padding: 32px;
    }
    .panel {
        width: min(980px, 100%);
        display: grid;
        gap: 28px;
        padding: 28px;
        border: 1px solid #263238;
        background: #101418;
    }
    .intro {
        max-width: 680px;
    }
    .eyebrow {
        margin: 0 0 8px;
        color: #7dd3fc;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
    }
    h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
    }
    .lede {
        max-width: 560px;
        margin: 12px 0 0;
        color: #a7b5bd;
        line-height: 1.55;
    }
    code {
        color: #c4b5fd;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .demos {
        display: grid;
        gap: 18px;
        border-top: 1px solid #263238;
        padding-top: 28px;
    }
    :global(.demo) {
        display: grid;
        gap: 14px;
        padding: 16px;
        border: 1px solid #263238;
        background: #0d1216;
    }
    :global(.demo-head) {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        min-height: 86px;
    }
    :global(.demo h2) {
        margin: 0;
        font-size: 16px;
        line-height: 1.2;
    }
    :global(.demo p) {
        margin: 6px 0 0;
        color: #7dd3fc;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 12px;
        line-height: 1.2;
    }
    :global(.copy-button) {
        appearance: none;
        -webkit-appearance: none;
        display: inline-grid;
        place-items: center;
        align-content: center;
        justify-content: center;
        padding: 7px 12px;
        border: 1px solid #43515a;
        background: #11171c;
        color: #cbd5e1;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        line-height: 16px;
        cursor: pointer;
    }
    :global(.copy-button:has(.copied-state:not([data-presence-wait-hidden='true']))) {
        border-color: #7dd3fc;
        background: #10232b;
        color: #7dd3fc;
    }
    :global(.copy-button:focus) {
        outline: none;
    }
    :global(.copy-button:focus-visible) {
        outline: 2px solid #7dd3fc;
        outline-offset: 3px;
    }
    :global(.state-stack) {
        display: inline-grid;
        align-items: center;
        justify-items: center;
    }
    :global(.state) {
        grid-area: 1 / 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        white-space: nowrap;
        line-height: 16px;
    }
    :global(.state svg) {
        width: 14px;
        height: 14px;
        flex: none;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
    }
    :global(.copy-state) {
        color: #cbd5e1;
    }
    :global(.copied-state) {
        color: #7dd3fc;
    }
    :global(.debug-log) {
        display: grid;
        gap: 4px;
        height: 150px;
        overflow: auto;
        border-top: 1px solid #263238;
        padding-top: 12px;
        color: #a7f3d0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        line-height: 1.45;
    }
    :global(.debug-head) {
        color: #7dd3fc;
        text-transform: uppercase;
        letter-spacing: 0.12em;
    }
    :global(.debug-log code) {
        display: block;
        overflow-wrap: anywhere;
        color: inherit;
        background: transparent;
    }
    @media (max-width: 640px) {
        :global(.demo-head) {
            align-items: flex-start;
            flex-direction: column;
        }
    }
</style>
