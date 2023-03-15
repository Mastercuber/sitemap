import { withBase } from 'ufo'
import type { ModuleOptions } from '../../module'
import { generateRoutes } from './generateRoutes'

export async function buildSitemapIndex(sitemapConfig: ModuleOptions, baseURL: string, getRouteRulesForPath: (path: string) => Record<string, any>) {
  const entries = []
  for (const sitemap in sitemapConfig.sitemaps) {
    const urls = await generateRoutes({ ...sitemapConfig, ...sitemapConfig.sitemaps[sitemap] }, baseURL, getRouteRulesForPath)
    entries.push({
      lastmod: urls.filter(a => !!a?.lastmod).sort((a, b) => b.lastmod - a.lastmod)?.[0]?.lastmod || new Date(),
      sitemap: withBase(`${sitemap}-sitemap.xml`, withBase(baseURL, sitemapConfig.hostname)),
    })
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="${sitemapConfig.hostname}_sitemap/style.xml"?>`,
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...(entries?.map(e => `<sitemap><loc>${e.sitemap}</loc><lastmod>${e.lastmod}</lastmod></sitemap>`) ?? []),
    '</sitemapindex>',
    '<!-- XML Sitemap generated by Nuxt Simple Sitemap -->',
  ].join('\n')
}
