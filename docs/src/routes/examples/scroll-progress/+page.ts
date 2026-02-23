import type { PageLoad } from './$types'

export const load: PageLoad = () => {
    return {
        title: 'Scroll Progress',
        description: 'Scroll progress animation using useScroll and useSpring',
        sourceUrl: 'https://motion.dev/docs/react-use-scroll'
    }
}
