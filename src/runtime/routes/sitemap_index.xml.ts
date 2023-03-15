import { defineEventHandler, setHeader } from 'h3'
import { buildSitemapIndex } from '../util/builder'
import * as sitemapConfig from '#nuxt-simple-sitemap/config'
import { useRuntimeConfig } from '#internal/nitro'
import { getRouteRulesForPath } from '#internal/nitro/route-rules'

export default defineEventHandler(async (e) => {
  setHeader(e, 'Content-Type', 'text/xml; charset=UTF-8')
  setHeader(e, 'Cache-Control', 'max-age=600, must-revalidate')
  return await buildSitemapIndex(sitemapConfig, useRuntimeConfig().app.baseURL, getRouteRulesForPath)
})
