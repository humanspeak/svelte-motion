import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'MotionConfig',
    description:
        'Component that supplies default transition and reduced-motion behavior to every descendant motion component.'
})
