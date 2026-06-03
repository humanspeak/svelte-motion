import type { PageLoad } from './$types'

export const load: PageLoad = () => ({
    title: 'MotionValue children',
    description: 'Render MotionValue<number | string> values as live text children.'
})
