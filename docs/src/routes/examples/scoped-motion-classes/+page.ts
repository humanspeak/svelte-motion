import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'Scoped Motion Classes',
    description:
        'Keep component-scoped CSS selectors alive when they are passed to motion components.'
})
