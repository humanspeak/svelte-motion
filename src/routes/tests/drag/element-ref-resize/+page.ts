export const load = ({ url }) => ({
    slow: url.searchParams.has('slow') || url.searchParams.has('slowmode')
})
