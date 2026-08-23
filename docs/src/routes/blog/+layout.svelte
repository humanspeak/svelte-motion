<script lang="ts">
    import favicon from '$lib/assets/logo.svg'
    import { docsConfig } from '$lib/docs-config'
    import { buildBlogBreadcrumbs, headerNav } from '$lib/docsNav'
    import { enhanceCodeBlocks } from '@humanspeak/docs-kit'
    import { BlogLayoutV2 } from '@humanspeak/docs-kit/blog'
    import '@fontsource-variable/inter/index.css'
    import '@fontsource-variable/jetbrains-mono/index.css'
    import rootPkg from '../../../../package.json'

    const { children } = $props()
    const PKG_VERSION = rootPkg.version
</script>

<BlogLayoutV2
    config={docsConfig}
    {favicon}
    version={PKG_VERSION}
    nav={headerNav}
    breadcrumbResolver={buildBlogBreadcrumbs}
>
    <div class="flex flex-1 flex-col" use:enhanceCodeBlocks>
        {@render children?.()}
    </div>
</BlogLayoutV2>
