/**
 * Reads visual-test knobs from the URL so the resize page can expose a slower,
 * human-eye-test-friendly spring mode without changing the default fixture.
 */
export const load = ({ url }) => ({
    slow: url.searchParams.has('slow') || url.searchParams.has('slowmode')
})
