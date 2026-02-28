import type { LayoutServerLoad } from './$types'

type OtherProject = {
    url: string
    slug: string
    shortDescription: string
}

export const load: LayoutServerLoad = async ({ fetch }) => {
    try {
        const response = await fetch('/api/other-projects')
        if (!response.ok) {
            return { otherProjects: [] as OtherProject[] }
        }
        const projects: OtherProject[] = await response.json()
        return { otherProjects: projects }
    } catch {
        return { otherProjects: [] as OtherProject[] }
    }
}
