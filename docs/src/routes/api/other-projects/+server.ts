import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
    try {
        const response = await fetch('https://svelte.page/api/v1/others')
        const projects = await response.json()

        // Filter out the motion project (this project)
        const otherProjects = projects.filter(
            (project: { slug: string }) => project.slug !== 'motion'
        )

        return json(otherProjects)
    } catch (error) {
        console.error('Failed to fetch other projects:', error)
        // Return empty array on error
        return json([])
    }
}
