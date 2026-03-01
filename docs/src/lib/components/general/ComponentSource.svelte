<script lang="ts">
    import { Dialog } from 'bits-ui'
    import { AnimatePresence, motion } from '@humanspeak/svelte-motion'
    import { registryItems } from '$lib/generated/registry-data'
    import {
        Code,
        ChevronRight,
        ChevronDown,
        X,
        Folder,
        FileCode,
        Copy,
        Check
    } from '@lucide/svelte'

    type Props = {
        slug: string
        defaultFile?: string
    }

    const { slug, defaultFile }: Props = $props()

    // Look up registry item files
    const item = registryItems[slug] as {
        name?: string
        files?: Array<{ content: string; target: string }>
    }
    const files = item?.files ?? []
    const name = item?.name ?? slug

    // Derive folder name from the first file's target path (e.g., "animated-tabs/index.ts" → "ui/animated-tabs")
    const folderName = files.length > 0 ? `ui/${files[0].target.split('/')[0]}` : slug

    // Extract just the filename from the target path
    const getFileName = (target: string) => target.split('/').pop() ?? target

    // Detect language from filename extension
    const getLang = (target: string): string => {
        const ext = target.split('.').pop()
        const map: Record<string, string> = {
            ts: 'typescript',
            js: 'javascript',
            svelte: 'svelte',
            html: 'html',
            css: 'css',
            json: 'json'
        }
        return map[ext ?? ''] ?? 'text'
    }

    // Map file extension to an icon: SVG path or null (fallback to generic file icon)
    const getFileIcon = (target: string): string | null => {
        const ext = target.split('.').pop()
        const map: Record<string, string> = {
            svelte: '/icons/svelte.svg',
            ts: '/icons/typescript.svg',
            js: '/icons/typescript.svg'
        }
        return map[ext ?? ''] ?? null
    }

    // Default to the provided file or the first file
    const defaultIndex = defaultFile
        ? Math.max(
              files.findIndex((f) => getFileName(f.target) === defaultFile),
              0
          )
        : 0

    let open = $state(false)
    let activeFileIndex = $state(defaultIndex)
    let copied = $state(false)
    let highlightedFiles = $state<Array<{ light: string; dark: string }> | null>(null)
    let highlighterLoaded = $state(false)

    // Lazy-load shiki when dialog opens
    $effect(() => {
        if (open && !highlighterLoaded) {
            highlighterLoaded = true
            ;(async () => {
                const [{ createHighlighter }, { createJavaScriptRegexEngine }] = await Promise.all([
                    import('shiki'),
                    import('shiki/engine/javascript')
                ])
                const hl = await createHighlighter({
                    themes: ['github-light', 'one-dark-pro'],
                    langs: ['javascript', 'typescript', 'svelte', 'html', 'css', 'json'],
                    engine: createJavaScriptRegexEngine()
                })
                highlightedFiles = files.map((f) => ({
                    light: hl.codeToHtml(f.content, {
                        lang: getLang(f.target),
                        theme: 'github-light'
                    }),
                    dark: hl.codeToHtml(f.content, {
                        lang: getLang(f.target),
                        theme: 'one-dark-pro'
                    })
                }))
            })()
        }
    })

    function copyToClipboard() {
        const content = files[activeFileIndex]?.content
        if (!content) return
        navigator.clipboard.writeText(content)
        copied = true
        setTimeout(() => (copied = false), 2000)
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger
        class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground shadow-xs transition-colors hover:bg-secondary/80"
    >
        <Code size={12} />
        Component Source
        <ChevronRight size={10} class="text-muted-foreground" />
    </Dialog.Trigger>

    <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content class="component-source-dialog">
            <!-- Header -->
            <div class="flex items-center justify-between border-b border-border px-5 py-3">
                <div>
                    <Dialog.Title class="text-base font-semibold text-foreground">
                        {name} Code
                    </Dialog.Title>
                    <Dialog.Description class="text-xs text-muted-foreground">
                        View the component source
                    </Dialog.Description>
                </div>
                <Dialog.Close
                    class="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <X size={16} />
                </Dialog.Close>
            </div>

            <!-- Body: two-column layout -->
            <div class="flex min-h-0 flex-1">
                <!-- Left: File tree -->
                <div
                    class="hidden w-52 flex-shrink-0 overflow-y-auto border-r border-border sm:block"
                >
                    <div
                        class="px-3 py-2 text-xs font-medium tracking-wider text-muted-foreground uppercase"
                    >
                        Files
                    </div>
                    <div class="pb-2">
                        <!-- Folder node -->
                        <div
                            class="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-foreground"
                        >
                            <ChevronDown size={9} class="text-muted-foreground" />
                            <Folder size={11} class="text-brand-400" />
                            {folderName}
                        </div>
                        <!-- File list -->
                        {#each files as file, i (file.target)}
                            <button
                                onclick={() => (activeFileIndex = i)}
                                class="flex w-full cursor-pointer items-center gap-1.5 py-1 pr-3 pl-7 text-left text-xs transition-colors {activeFileIndex ===
                                i
                                    ? 'bg-accent/10 font-medium text-accent'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                            >
                                {#if getFileIcon(file.target)}
                                    <img
                                        src={getFileIcon(file.target)}
                                        alt=""
                                        class="h-3.5 w-3.5 flex-shrink-0 opacity-60 grayscale"
                                    />
                                {:else}
                                    <FileCode size={10} class="flex-shrink-0" />
                                {/if}
                                <span class="truncate">{getFileName(file.target)}</span>
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- Right: Code viewer -->
                <div class="flex min-w-0 flex-1 flex-col">
                    <!-- File header bar -->
                    <div class="flex items-center justify-between border-b border-border px-4 py-2">
                        <div class="flex items-center gap-2 text-sm text-foreground">
                            {#if getFileIcon(files[activeFileIndex]?.target ?? '')}
                                <img
                                    src={getFileIcon(files[activeFileIndex]?.target ?? '')}
                                    alt=""
                                    class="h-4 w-4 opacity-60 grayscale"
                                />
                            {:else}
                                <FileCode size={12} class="text-muted-foreground" />
                            {/if}
                            <!-- Mobile: file selector dropdown -->
                            <select
                                class="bg-transparent text-sm font-medium text-foreground sm:hidden"
                                onchange={(e) =>
                                    (activeFileIndex = parseInt(
                                        (e.target as HTMLSelectElement).value
                                    ))}
                            >
                                {#each files as file, i (file.target)}
                                    <option value={i} selected={activeFileIndex === i}>
                                        {getFileName(file.target)}
                                    </option>
                                {/each}
                            </select>
                            <!-- Desktop: filename -->
                            <span class="hidden font-medium sm:inline">
                                {getFileName(files[activeFileIndex]?.target ?? '')}
                            </span>
                        </div>
                        <motion.button
                            onclick={copyToClipboard}
                            class="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            whileTap={{ scale: 0.85 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            aria-label="Copy to clipboard"
                        >
                            <AnimatePresence mode="wait">
                                {#if copied}
                                    <motion.span
                                        key="check"
                                        class="absolute text-success"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Check size={14} />
                                    </motion.span>
                                {:else}
                                    <motion.span
                                        key="copy"
                                        class="absolute"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.5 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <Copy size={14} />
                                    </motion.span>
                                {/if}
                            </AnimatePresence>
                        </motion.button>
                    </div>

                    <!-- Code area -->
                    <div class="component-source-code flex-1 overflow-auto">
                        {#if highlightedFiles}
                            <!-- eslint-disable svelte/no-at-html-tags -- content is from our own registry, not user input -->
                            <div class="shiki-light">
                                {@html highlightedFiles[activeFileIndex].light}
                            </div>
                            <div class="shiki-dark">
                                {@html highlightedFiles[activeFileIndex].dark}
                            </div>
                        {:else}
                            <!-- Loading skeleton -->
                            <div class="p-4">
                                <div class="space-y-2">
                                    <div class="h-4 w-3/4 animate-pulse rounded bg-muted"></div>
                                    <div class="h-4 w-full animate-pulse rounded bg-muted"></div>
                                    <div class="h-4 w-5/6 animate-pulse rounded bg-muted"></div>
                                    <div class="h-4 w-2/3 animate-pulse rounded bg-muted"></div>
                                    <div class="h-4 w-4/5 animate-pulse rounded bg-muted"></div>
                                    <div class="h-4 w-1/2 animate-pulse rounded bg-muted"></div>
                                </div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
