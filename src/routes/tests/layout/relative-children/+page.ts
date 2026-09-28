/**
 * Reads the fixture knobs from the URL, mirroring the Jest `App` props in
 * upstream `relative-child-measurements.test.tsx`:
 *
 * - `children=N` — number of relative children (default 1).
 * - `childTransition=long|short` — children's layout transition (default
 *   `long`, a 10s linear tween; `short` is 0.05s).
 */
export const load = ({ url }) => {
    const count = Number(url.searchParams.get('children') ?? '1')
    return {
        childCount: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1,
        childTransition: url.searchParams.get('childTransition') === 'short' ? 'short' : 'long'
    } as const
}
