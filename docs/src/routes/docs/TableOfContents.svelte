<!--
  Right sidebar table of contents component (Svelte 5 + TypeScript)
  Auto-generated from page headings with smooth scroll
-->
<script lang="ts">
    import { onMount } from 'svelte'

    export type TocHeading = {
        id: string
        text: string
        level: number
        element: HTMLElement
    }

    const { headings = [] } = $props<{ headings: TocHeading[] }>()

    let activeHeading = $state<string>('')

    function scrollToHeading(id: string) {
        const element = document.getElementById(id)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    function updateActiveHeading() {
        for (let i = headings.length - 1; i >= 0; i--) {
            const heading = headings[i]
            if (heading?.element) {
                const rect = heading.element.getBoundingClientRect()
                if (rect.top <= 100) {
                    activeHeading = heading.id
                    break
                }
            }
        }
    }

    onMount(() => {
        window.addEventListener('scroll', updateActiveHeading)
        updateActiveHeading()
        return () => window.removeEventListener('scroll', updateActiveHeading)
    })
</script>

{#if headings.length > 0}
    <nav class="p-6">
        <h3 class="mb-4 text-sm font-semibold tracking-wide text-text-primary uppercase">
            On this page
        </h3>
        <ul class="space-y-2 text-sm">
            {#each headings as heading (heading.id)}
                <li style="margin-left: {(heading.level - 1) * 12}px">
                    <button
                        type="button"
                        onclick={() => scrollToHeading(heading.id)}
                        class="block text-left transition-colors duration-150 hover:text-accent
						{activeHeading === heading.id ? 'font-medium text-accent' : 'text-text-secondary'}"
                    >
                        {heading.text}
                    </button>
                </li>
            {/each}
        </ul>
    </nav>
{/if}
