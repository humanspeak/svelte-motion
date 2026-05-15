<script lang="ts">
    /**
     * Card-style brut hero for doc landing pages. Lives inside the docs
     * prose container, so it carries `not-prose` to escape Tailwind
     * Typography rules and renders against the article width (no full-bleed).
     *
     * Used at the top of /docs/+page.svx today; can be reused on any
     * future top-level doc section that wants the brut treatment.
     */
    interface Props {
        figNo?: string
        figLabel?: string
        slug?: string
        title: string
        accent?: string
        tagline: string
        ctas?: { href: string; label: string; primary?: boolean }[]
        sheet?: string
    }

    const {
        figNo = 'FIG-DOC-001',
        figLabel = 'MASTHEAD',
        slug = 'docs',
        title,
        accent,
        tagline,
        ctas = [],
        sheet
    }: Props = $props()
</script>

<section class="brut-card not-prose">
    <div class="corner tr">{figNo} · {figLabel}</div>
    <div class="hero-body">
        <div class="k">// docs / {slug}</div>
        <h1>
            {#if accent}
                <span>{title}</span><span class="hilite">&nbsp;{accent}</span><span class="end"
                    >.</span
                >
            {:else}
                <span>{title}</span><span class="end">.</span>
            {/if}
        </h1>
        <p class="sub">{tagline}</p>
        {#if ctas.length}
            <div class="cta-row">
                {#each ctas as cta (cta.href)}
                    <a class={cta.primary ? 'pri' : ''} href={cta.href}>{cta.label}</a>
                {/each}
            </div>
        {/if}
    </div>
    <div class="corner bl">{figNo}</div>
    {#if sheet}
        <div class="corner br">{sheet}</div>
    {/if}
</section>

<style>
    /* not-prose escapes Tailwind Typography; everything below is the
       brut palette transplanted from the marketing pages. */
    .brut-card {
        position: relative;
        margin: 0 0 36px;
        padding: 32px 28px 32px;
        border: 1px solid #d6dedb;
        background: #f8fcfb;
        color: #0a0a0a;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 13px;
        letter-spacing: 0;
    }
    :global(html.dark) .brut-card {
        border-color: #1c2422;
        background: #0d1110;
        color: #ededed;
    }

    .brut-card .corner {
        position: absolute;
        font-size: 10px;
        color: #9a9a9a;
        letter-spacing: 0.14em;
        text-transform: uppercase;
    }
    :global(html.dark) .brut-card .corner {
        color: #5a5a5a;
    }
    .brut-card .corner.tr {
        top: 10px;
        right: 14px;
    }
    .brut-card .corner.bl {
        bottom: 10px;
        left: 14px;
    }
    .brut-card .corner.br {
        bottom: 10px;
        right: 14px;
    }

    .brut-card .hero-body .k {
        font-size: 10.5px;
        color: #9a9a9a;
        letter-spacing: 0.14em;
    }
    :global(html.dark) .brut-card .hero-body .k {
        color: #5a5a5a;
    }
    .brut-card h1 {
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: clamp(40px, 6vw, 88px);
        line-height: 0.9;
        font-weight: 500;
        letter-spacing: -0.05em;
        text-transform: lowercase;
        color: #0a0a0a;
        margin: 8px 0 0;
    }
    :global(html.dark) .brut-card h1 {
        color: #ededed;
    }
    .brut-card h1 .hilite {
        color: #247768;
    }
    :global(html.dark) .brut-card h1 .hilite {
        color: #54dbbc;
    }
    .brut-card h1 .end {
        color: #9a9a9a;
    }
    :global(html.dark) .brut-card h1 .end {
        color: #5a5a5a;
    }

    .brut-card .sub {
        margin: 22px 0 0;
        max-width: 640px;
        font-family: 'Inter Variable', 'Inter', system-ui, sans-serif;
        font-size: 16px;
        line-height: 1.55;
        color: #525252;
        letter-spacing: -0.005em;
    }
    :global(html.dark) .brut-card .sub {
        color: #9a9a9a;
    }

    .brut-card .cta-row {
        margin-top: 22px;
        display: flex;
        flex-wrap: wrap;
        gap: 0;
        width: fit-content;
        max-width: 100%;
    }
    .brut-card .cta-row > * {
        padding: 9px 14px;
        border: 1px solid #d6dedb;
        background: #f8fcfb;
        color: #0a0a0a;
        font-family: 'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace;
        font-size: 13px;
        text-decoration: none;
        position: relative;
        z-index: 1;
        transition:
            background 0.15s,
            border-color 0.15s;
    }
    .brut-card .cta-row > * + * {
        margin-left: -1px;
    }
    .brut-card .cta-row .pri {
        background: #247768;
        color: #f8fcfb;
        font-weight: 600;
        border-color: #247768;
    }
    .brut-card .cta-row .pri:hover {
        background: #1b5a4e;
        border-color: #1b5a4e;
    }
    .brut-card .cta-row a:not(.pri):hover {
        background: #eef4f1;
        border-color: #bbc4c0;
    }
    :global(html.dark) .brut-card .cta-row > * {
        background: #0d1110;
        border-color: #1c2422;
        color: #ededed;
    }
    :global(html.dark) .brut-card .cta-row .pri {
        background: #54dbbc;
        color: #06090a;
        border-color: #54dbbc;
    }
    :global(html.dark) .brut-card .cta-row .pri:hover {
        background: #7fe9d1;
        border-color: #7fe9d1;
    }
    :global(html.dark) .brut-card .cta-row a:not(.pri):hover {
        background: #1c2422;
        border-color: #2a332f;
    }

    @media (max-width: 720px) {
        .brut-card {
            padding: 28px 18px;
        }
        .brut-card h1 {
            font-size: clamp(36px, 11vw, 64px);
        }
    }
</style>
