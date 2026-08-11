import { env } from '$env/dynamic/public'
import { docsConfig } from '$lib/docs-config'
import manifest from '$lib/sitemap-manifest.json'
import { createSitemapResponse } from '@humanspeak/docs-kit/server'
import type { RequestHandler } from '@sveltejs/kit'

export const GET: RequestHandler = () =>
    createSitemapResponse({
        manifest,
        siteUrl: env.PUBLIC_SITE_URL || docsConfig.url
    })
