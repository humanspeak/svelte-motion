import { demoCodeSample, type DemoCodeLoaderKey, type DemoCodeSample } from '$lib/demo-loaders'

const demoCodeDependencies: Partial<Record<DemoCodeLoaderKey, DemoCodeLoaderKey[]>> = {
    'armed-buttons/demos/Archive.svelte': ['armed-buttons/ArchiveArmedButton.svelte'],
    'armed-buttons/demos/Default.svelte': ['armed-buttons/RecordingInsightRow.svelte'],
    'armed-buttons/demos/DeleteWait.svelte': ['armed-buttons/DeleteArmedWaitButton.svelte'],
    'multi-state-badge/demos/Default.svelte': [
        'multi-state-badge/Badge.svelte',
        'multi-state-badge/Icon.svelte',
        'multi-state-badge/Check.svelte',
        'multi-state-badge/Loader.svelte',
        'multi-state-badge/XIcon.svelte',
        'multi-state-badge/Label.svelte'
    ],
    'pan/demos/SwipeCards.svelte': ['pan/demos/CardItem.svelte'],
    'use-presence-data/demos/Default.svelte': ['use-presence-data/demos/PresenceDataSlide.svelte'],
    'use-presence/demos/Default.svelte': ['use-presence/demos/UsePresenceCard.svelte']
}

function demoCodeLabelForKey(key: DemoCodeLoaderKey): string {
    return key.split('/').pop() ?? key
}

function demoCodeIdForKey(baseId: string, key: DemoCodeLoaderKey, index: number): string {
    if (index === 0) return baseId

    const fileName = demoCodeLabelForKey(key).replace(/\.svelte$/, '')
    const slug = fileName
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()

    return `${baseId}-${slug || index}`
}

/**
 * Builds lazy `CodeReferenceV2` samples for a demo entrypoint and every
 * co-located `.svelte` component imported by that demo.
 *
 * @param key - Demo path emitted by `demoManifestPlugin({ split: true })`.
 * @param id - Stable sample identifier for the demo entrypoint.
 * @param label - Human-readable file label for the demo entrypoint.
 * @param preload - Optional override for docs-kit's idle preload behavior.
 * @returns Lazy code samples for the demo followed by local component dependencies.
 */
export function demoCodeSamples(
    key: DemoCodeLoaderKey,
    id: string,
    label: string,
    preload?: 'idle' | false
): DemoCodeSample[] {
    const keys = [key, ...(demoCodeDependencies[key] ?? [])]
    return keys.map((sampleKey, index) =>
        demoCodeSample(
            sampleKey,
            demoCodeIdForKey(id, sampleKey, index),
            index === 0 ? label : demoCodeLabelForKey(sampleKey),
            preload
        )
    )
}
