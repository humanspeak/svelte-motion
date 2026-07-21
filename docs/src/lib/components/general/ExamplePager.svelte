<script lang="ts">
    import { listExamples } from '$lib/examplesIndex'
    import { page } from '$app/state'

    /**
     * Brutalist prev/next pager for example detail pages. Resolves the
     * current example from the URL against the canonical examples order
     * (shared with the index grid, so the `№` numbering agrees) and links
     * to the neighbors, wrapping at both ends. Renders nothing on routes
     * that aren't a known example page.
     */
    const examples = listExamples()

    const pad2 = (n: number) => String(n).padStart(2, '0')

    const current = $derived.by(() => {
        const index = examples.findIndex((example) => example.route === page.url.pathname)
        if (index === -1) return null
        const previous = examples[(index - 1 + examples.length) % examples.length]
        const next = examples[(index + 1) % examples.length]
        return { index, previous, next }
    })
</script>

{#if current}
    <!-- margin-top:auto pins the pager to the bottom of the layout's flex
         column, so it sits flush above the footer even on short pages. -->
    <div class="push">
        <nav class="pager" aria-label="Example pagination">
            <a class="cell prev" href={current.previous.route}>
                <span class="micro"
                    >↤ prev / № {pad2(
                        ((current.index - 1 + examples.length) % examples.length) + 1
                    )}</span
                >
                <span class="name">{current.previous.slug}.</span>
            </a>
            <div class="cell counter" aria-hidden="true">
                <span class="micro">sheet</span>
                <span class="name accent"
                    >№ {pad2(current.index + 1)} / {pad2(examples.length)}</span
                >
            </div>
            <a class="cell next" href={current.next.route}>
                <span class="micro"
                    >next / № {pad2(((current.index + 1) % examples.length) + 1)} ↦</span
                >
                <span class="name">{current.next.slug}.</span>
            </a>
        </nav>
    </div>
{/if}

<style>
    .push {
        margin-top: auto;
        padding-top: 2rem;
    }

    .pager {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        border-top: 1px solid var(--brut-rule-2, #bbc4c0);
    }

    .cell {
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
        padding: 1rem 1.25rem;
        text-decoration: none;
    }

    .cell + .cell {
        border-left: 1px dashed var(--brut-rule-2, #bbc4c0);
    }

    .prev {
        align-items: flex-start;
    }

    .counter {
        align-items: center;
        justify-content: center;
    }

    .next {
        align-items: flex-end;
        text-align: right;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .name {
        font-family: var(--brut-mono, monospace);
        font-size: 0.9375rem;
        font-weight: 700;
        color: var(--brut-ink, #0a0a0a);
    }

    .accent {
        color: var(--brut-accent, #247768);
    }

    a.cell:hover {
        background: var(--brut-accent-soft, rgba(36, 119, 104, 0.1));
    }

    a.cell:hover .name {
        color: var(--brut-accent, #247768);
    }

    @media (max-width: 640px) {
        .pager {
            grid-template-columns: 1fr 1fr;
        }

        .counter {
            display: none;
        }
    }
</style>
