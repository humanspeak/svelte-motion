/** @desc Maps short language identifiers to human-readable display names. */
const LANG_NAMES: Record<string, string> = {
    svelte: 'Svelte',
    ts: 'TypeScript',
    typescript: 'TypeScript',
    js: 'JavaScript',
    javascript: 'JavaScript',
    bash: 'Terminal',
    shell: 'Terminal',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    text: 'Text'
}

/** @desc FontAwesome copy + check icons rendered inside every copy button. */
const COPY_ICON =
    '<i class="fa-solid fa-copy icon-copy" style="font-size:14px"></i>' +
    '<i class="fa-solid fa-check icon-check" style="font-size:14px"></i>'

/**
 * Scans a container for un-enhanced Shiki code blocks and injects a header bar
 * with a language label and copy-to-clipboard button into each one.
 *
 * @param {HTMLElement} container - The DOM element to scan for
 *     `.shiki-container[data-code]` children.
 */
const enhance = (container: HTMLElement) => {
    const blocks = container.querySelectorAll<HTMLElement>(
        '.shiki-container[data-code]:not(.code-enhanced)'
    )

    for (const block of blocks) {
        block.classList.add('code-enhanced')

        const lang = block.dataset.lang ?? 'text'
        const title = block.dataset.title
        const label = title ?? LANG_NAMES[lang] ?? lang

        const header = document.createElement('div')
        header.className = 'code-block-header'

        const langSpan = document.createElement('span')
        langSpan.className = 'code-block-lang'
        langSpan.textContent = label

        const copyBtn = document.createElement('button')
        copyBtn.className = 'code-block-copy'
        copyBtn.setAttribute('aria-label', 'Copy code')
        copyBtn.innerHTML = COPY_ICON

        copyBtn.addEventListener('click', () => {
            const encoded = block.dataset.code
            if (!encoded) return
            const code = atob(encoded)
            navigator.clipboard.writeText(code)

            copyBtn.classList.add('copied')
            setTimeout(() => copyBtn.classList.remove('copied'), 2000)
        })

        header.appendChild(langSpan)
        header.appendChild(copyBtn)
        block.prepend(header)
    }
}

/**
 * Svelte action that enhances every Shiki code block inside a node with a
 * header bar (language label + copy button). A {@link MutationObserver} watches
 * for new code blocks added by SvelteKit client-side navigations.
 *
 * @param {HTMLElement} node - The element to bind the action to (typically the
 *     content `<article>`).
 * @returns {{ destroy: () => void }} Cleanup handle that disconnects the
 *     observer.
 */
export const enhanceCodeBlocks = (node: HTMLElement) => {
    enhance(node)

    const observer = new MutationObserver(() => {
        enhance(node)
    })

    observer.observe(node, { childList: true, subtree: true })

    return {
        destroy: () => {
            observer.disconnect()
        }
    }
}
