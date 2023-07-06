import { defineEventHandler, setHeader } from 'h3'
import { parseURL } from 'ufo'
import { prefixStorage } from 'unstorage'
import type { ModuleRuntimeConfig, SitemapRenderCtx } from '../types'
import { buildSitemap } from '../sitemap/builder'
import { createSitePathResolver, useNitroApp, useRuntimeConfig, useStorage } from '#imports'
import { getRouteRulesForPath } from '#internal/nitro/route-rules'
import pages from '#nuxt-simple-sitemap/pages.mjs'

export default defineEventHandler(async (e) => {
  const path = parseURL(e.path).pathname
  if (!path.endsWith('-sitemap.xml'))
    return

  const { moduleConfig, buildTimeMeta, version } = useRuntimeConfig()['nuxt-simple-sitemap'] as any as ModuleRuntimeConfig
  if (!moduleConfig.sitemaps) {
    /// maybe the user is handling their own sitemap?
    return
  }

  const sitemapName = path.replace('-sitemap.xml', '').replace('/', '')
  if (moduleConfig.sitemaps !== true && !moduleConfig.sitemaps[sitemapName])
    return

  const useCache = moduleConfig.runtimeCacheStorage && !process.dev && moduleConfig.cacheTtl && moduleConfig.cacheTtl > 0
  const baseCacheKey = moduleConfig.runtimeCacheStorage === 'default' ? `/cache/nuxt-simple-sitemap${version}` : `/nuxt-simple-sitemap/${version}`
  const cache = prefixStorage(useStorage(), `${baseCacheKey}/sitemaps`)
  // cache will invalidate if the options change
  const key = sitemapName
  let sitemap: string
  if (useCache && await cache.hasItem(key)) {
    const { value, expiresAt } = await cache.getItem(key) as any
    if (expiresAt > Date.now())
      sitemap = value as string
    else
      await cache.removeItem(key)
  }

  if (!sitemap) {
    const nitro = useNitroApp()
    const callHook = async (ctx: SitemapRenderCtx) => {
      await nitro.hooks.callHook('sitemap:sitemap-xml', ctx)
    }
    // merge urls
    sitemap = await buildSitemap({
      sitemap: {
        name: sitemapName,
        ...moduleConfig.sitemaps[sitemapName],
      },
      nitroUrlResolver: createSitePathResolver(e, { canonical: false, absolute: true, withBase: true }),
      canonicalUrlResolver: createSitePathResolver(e, { canonical: !process.dev, absolute: true, withBase: true }),
      relativeBaseUrlResolver: createSitePathResolver(e, { absolute: false, withBase: true }),
      moduleConfig,
      buildTimeMeta,
      getRouteRulesForPath,
      callHook,
      pages,
    })

    const ctx = { sitemap, sitemapName }
    await nitro.hooks.callHook('sitemap:sitemap:output', ctx)
    sitemap = ctx.sitemap

    if (useCache)
      await cache.setItem(key, { value: sitemap, expiresAt: Date.now() + (moduleConfig.cacheTtl || 0) })
  }

  // need to clone the config object to make it writable
  setHeader(e, 'Content-Type', 'text/xml; charset=UTF-8')
  if (!process.dev)
    setHeader(e, 'Cache-Control', 'max-age=600, must-revalidate')
  return sitemap
})
