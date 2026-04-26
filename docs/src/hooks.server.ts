import { paraglideMiddleware } from '$lib/paraglide/server'
import { createSecurityHeadersHandle } from '@humanspeak/docs-kit/hooks'
import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'

const handleParaglide: Handle = ({ event, resolve }) =>
    paraglideMiddleware(event.request, ({ request, locale }) => {
        event.request = request

        return resolve(event, {
            transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale)
        })
    })

export const handle: Handle = sequence(handleParaglide, createSecurityHeadersHandle())
