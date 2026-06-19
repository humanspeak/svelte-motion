import { PUBLIC_POSTHOG_PROJECT_TOKEN } from '$env/static/public'
import type { HandleClientError } from '@sveltejs/kit'
import posthog from 'posthog-js'

export async function init() {
    posthog.init(PUBLIC_POSTHOG_PROJECT_TOKEN, {
        ['api_host']: 'https://t.svelte.page',
        ['ui_host']: 'https://us.posthog.com',
        defaults: '2026-01-30',
        ['capture_exceptions']: true
    })
}

export const handleError: HandleClientError = async ({ error, status, message }) => {
    posthog.captureException(error)

    return {
        message,
        status
    }
}
