import { describe, expect, it } from 'vitest'

const routeSources = import.meta.glob('/src/routes/**/+page.svelte', {
    eager: true,
    import: 'default',
    query: '?raw'
}) as Record<string, string>

const expectedStandalonePaths = [
    '/src/routes/+page.svelte',
    '/src/routes/svelte-animations/+page.svelte',
    '/src/routes/examples/+page.svelte'
]

const detailPaths = Object.keys(routeSources)
    .filter((path) => /^\/src\/routes\/examples\/[^/]+\/\+page\.svelte$/.test(path))
    .sort()

const expectedPaths = [...expectedStandalonePaths, ...detailPaths]

function routeFromPath(path: string): string {
    const route = path.replace(/^\/src\/routes/, '').replace(/\/\+page\.svelte$/, '')
    return route || '/'
}

function extractLiteralTitle(source: string): string | undefined {
    const assignment = source.match(
        /\bseo\.title\s*=\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")/
    )
    return assignment?.[1] ?? assignment?.[2]
}

const titlesByRoute = new Map(
    expectedPaths.flatMap((path) => {
        const title = extractLiteralTitle(routeSources[path])
        return title === undefined ? [] : [[routeFromPath(path), title] as const]
    })
)

const detailRoutes = detailPaths.map(routeFromPath)

describe('SEO title policy', () => {
    it('finds literal titles for every policy route', () => {
        const missingRoutes = expectedPaths
            .filter((path) => extractLiteralTitle(routeSources[path]) === undefined)
            .map(routeFromPath)

        expect(
            detailPaths,
            `Expected 60 example detail pages, found ${detailPaths.length}`
        ).toHaveLength(60)
        expect(
            missingRoutes,
            `Missing literal seo.title assignments for: ${missingRoutes.join(', ') || '(none)'}`
        ).toEqual([])
    })

    it('keeps every literal title at or below 60 characters', () => {
        const overBudget = [...titlesByRoute]
            .filter(([, title]) => title.length > 60)
            .map(([route, title]) => `${route} (${title.length}): ${title}`)

        expect(
            overBudget,
            `${overBudget.length} title(s) exceed 60 characters:\n${overBudget.join('\n')}`
        ).toEqual([])
    })

    it('uses the brand-only suffix on every example detail title', () => {
        const violations = detailRoutes.flatMap((route) => {
            const title = titlesByRoute.get(route)
            if (title?.endsWith(' | Svelte Motion') && !title.includes('| Examples |')) return []
            return [`${route}: ${title ?? '(missing literal title)'}`]
        })

        expect(
            violations,
            `${violations.length} example detail title(s) violate the suffix policy:\n${violations.join('\n')}`
        ).toEqual([])
    })

    it('keeps the examples index title exact', () => {
        expect(titlesByRoute.get('/examples')).toBe('Examples | Svelte Motion')
    })

    it('keeps complete titles unique across policy routes', () => {
        const routesByTitle = new Map<string, string[]>()
        for (const [route, title] of titlesByRoute) {
            routesByTitle.set(title, [...(routesByTitle.get(title) ?? []), route])
        }

        const duplicates = [...routesByTitle]
            .filter(([, routes]) => routes.length > 1)
            .map(([title, routes]) => `${title}: ${routes.join(', ')}`)

        expect(
            duplicates,
            `Duplicate complete titles found:\n${duplicates.join('\n') || '(none)'}`
        ).toEqual([])
    })
})
