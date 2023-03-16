import { mkdir, writeFile } from 'node:fs/promises'
import {
  addServerHandler,
  addTemplate,
  createResolver,
  defineNuxtModule,
  findPath,
  useLogger,
} from '@nuxt/kit'
import { defu } from 'defu'
import { createRouter as createRadixRouter, toRouteMatcher } from 'radix3'
import chalk from 'chalk'
import { withBase, withoutBase, withoutTrailingSlash } from 'ufo'
import type { CreateFilterOptions } from './urlFilter'
import { exposeModuleConfig } from './nuxt-utils'
import { buildSitemap, buildSitemapIndex, generateXslStylesheet } from './runtime/util/builder'
import type { NuxtSimpleSitemapRuntime, ResolvedSitemapEntry, SitemapEntry, SitemapRenderCtx, SitemapRoot } from './types'

export * from './types'

export interface ModuleOptions extends CreateFilterOptions, SitemapRoot {
  /**
   * Whether the sitemap.xml should be generated.
   *
   * @default true
   */
  enabled: boolean
  /**
   * Should the URLs be inserted with a trailing slash.
   *
   * @default false
   */
  trailingSlash: boolean

  siteUrl: string

  autoLastmod: boolean
  inferStaticPagesAsRoutes: boolean
  sitemaps?: boolean | Record<string, Partial<SitemapRoot>>
  /**
   * @deprecated use `siteUrl`
   */
  hostname?: string
}

export interface ModuleHooks {
  'sitemap:prerender': (ctx: { urls: ResolvedSitemapEntry[] }) => Promise<void> | void
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-simple-sitemap',
    compatibility: {
      nuxt: '^3.3.1',
      bridge: false,
    },
    configKey: 'sitemap',
  },
  defaults(nuxt) {
    const trailingSlash = process.env.NUXT_PUBLIC_TRAILING_SLASH || nuxt.options.runtimeConfig.public.trailingSlash
    return {
      enabled: true,
      autoLastmod: true,
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || nuxt.options.runtimeConfig.public?.siteUrl,
      trailingSlash: String(trailingSlash) === 'true',
      inferStaticPagesAsRoutes: true,
      // index sitemap options filtering
      include: ['/**'],
      exclude: [],
      urls: [],
      sitemaps: false,
      defaults: {},
    }
  },
  async setup(config, nuxt) {
    const { resolve } = createResolver(import.meta.url)
    // support v1 config fallbacks
    config.siteUrl = config.siteUrl || config.hostname!

    // nuxt-simple-robots integration
    nuxt.hooks.hook('robots:config', (robotsConfig) => {
      robotsConfig.sitemap.push(config.sitemaps
        ? [
            withBase('/sitemap_index.xml', config.siteUrl),
          ]
        : ['/sitemap.xml'],
      )
    })

    // paths.d.ts
    addTemplate({
      filename: 'nuxt-simple-sitemap.d.ts',
      getContents: () => {
        return `// Generated by nuxt-simple-sitemap
import type { SitemapItemDefaults } from 'nuxt-simple-sitemap'

interface NuxtSimpleSitemapNitroRules {
  index?: boolean
  sitemap?: SitemapItemDefaults
}
declare module 'nitropack' {
  interface NitroRouteRules extends NuxtSimpleSitemapNitroRules {}
  interface NitroRouteConfig extends NuxtSimpleSitemapNitroRules {}
}

declare module '' {

}

export {}
`
      },
    })

    nuxt.hooks.hook('prepare:types', ({ references }) => {
      references.push({ path: resolve(nuxt.options.buildDir, 'nuxt-simple-sitemap.d.ts') })
    })

    const pagesDirs = nuxt.options._layers.map(
      layer => resolve(layer.config.srcDir, layer.config.dir?.pages || 'pages'),
    )
    let urls: SitemapEntry[] = []
    if (typeof config.urls === 'function')
      urls = [...await config.urls()]

    else if (Array.isArray(config.urls))
      urls = [...await config.urls]

    // check if the user provided route /api/_sitemap-urls exists
    const hasApiRoutesUrl = !!(await findPath(resolve(nuxt.options.serverDir, 'api/_sitemap-urls')))
    const exposeConfig: NuxtSimpleSitemapRuntime = {
      ...config,
      hasApiRoutesUrl,
      urls,
      pagesDirs,
      extensions: nuxt.options.extensions,
    }

    exposeModuleConfig('nuxt-simple-sitemap', exposeConfig)

    // always add the styles
    addServerHandler({
      route: '/__sitemap__/style.xsl',
      handler: resolve('./runtime/routes/sitemap.xsl'),
    })

    // multi sitemap support
    if (config.sitemaps) {
      addServerHandler({
        route: '/sitemap_index.xml',
        handler: resolve('./runtime/routes/sitemap_index.xml'),
      })
      addServerHandler({
        handler: resolve('./runtime/middleware/[sitemap]-sitemap.xml'),
      })
    }
    // either this will redirect to sitemap_index or will render the main sitemap.xml
    addServerHandler({
      route: '/sitemap.xml',
      handler: resolve('./runtime/routes/sitemap.xml'),
    })

    nuxt.hooks.hook('nitro:init', async (nitro) => {
      // tell the user if the sitemap isn't being generated
      const logger = useLogger('nuxt-simple-sitemap')
      if (!config.enabled) {
        logger.debug('Sitemap generation is disabled.')
        return
      }

      const sitemapImages: Record<string, { url: string }[]> = {}
      // setup a hook for the prerender so we can inspect the image sources
      nitro.hooks.hook('prerender:route', async (ctx) => {
        const html = ctx.contents
        if (ctx.fileName?.endsWith('.html') && html) {
          // only scan within the <main> tag
          const mainRegex = /<main[^>]*>([\s\S]*?)<\/main>/
          const mainMatch = mainRegex.exec(html)
          if (!mainMatch)
            return
          // extract image src using regex on the html
          const imgRegex = /<img[^>]+src="([^">]+)"/g
          let match
          // eslint-disable-next-line no-cond-assign
          while ((match = imgRegex.exec(mainMatch[1])) !== null) {
            const url = new URL(match[1], config.siteUrl)
            sitemapImages[ctx.route] = sitemapImages[ctx.route] || []
            sitemapImages[ctx.route].push({
              url: url.href,
            })
          }
        }
      })

      let sitemapGenerate = false
      const outputSitemap = async () => {
        if (!nuxt.options._build && !nuxt.options._generate)
          return

        if (sitemapGenerate)
          return

        // we need a siteUrl set for pre-rendering
        if (!config.siteUrl) {
          logger.error('Please set a `siteUrl` on the `sitemap` config to use `nuxt-simple-sitemap`.')
          return
        }
        const prerenderRoutes = nitro._prerenderedRoutes?.filter(r => !r.route.includes('.'))
          .map(r => ({ url: r.route })) || []
        const configUrls = [...prerenderRoutes, ...urls]

        let start = Date.now()

        const _routeRulesMatcher = toRouteMatcher(
          createRadixRouter({ routes: nitro.options.routeRules }),
        )

        const routeMatcher = (path: string) => {
          const matchedRoutes = _routeRulesMatcher.matchAll(withoutBase(withoutTrailingSlash(path), nuxt.options.app.baseURL)).reverse()
          // inject our discovered images
          if (sitemapImages[path]) {
            matchedRoutes.push({
              sitemap: {
                images: sitemapImages[path],
              },
            })
          }
          return defu({}, ...matchedRoutes) as Record<string, any>
        }

        await mkdir(resolve(nitro.options.output.publicDir, '__sitemap__'), { recursive: true })
        await writeFile(resolve(nitro.options.output.publicDir, '__sitemap__/style.xsl'), generateXslStylesheet())
        nitro.logger.log(chalk.gray(
          '  ├─ /__sitemap__/style.xsl (0ms)',
        ))

        const callHook = async (ctx: SitemapRenderCtx) => {
          // @ts-expect-error runtime type
          await nuxt.hooks.callHook('sitemap:prerender', ctx)
        }
        if (config.sitemaps) {
          start = Date.now()

          // rendering a sitemap_index
          const { xml, sitemaps } = await buildSitemapIndex({
            sitemapConfig: { ...exposeConfig, urls: configUrls },
            baseURL: nuxt.options.app.baseURL,
            getRouteRulesForPath: routeMatcher,
            callHook,
          })
          await writeFile(resolve(nitro.options.output.publicDir, 'sitemap_index.xml'), xml)
          const generateTimeMS = Date.now() - start
          nitro.logger.log(chalk.gray(
            `  ├─ /sitemap_index.xml (${generateTimeMS}ms)`,
          ))
          let sitemapNames = Object.keys(config.sitemaps)
          if (config.sitemaps === true)
            sitemapNames = sitemaps.map(s => s.sitemap.split('/').pop()?.replace('-sitemap.xml', '')).filter(Boolean) as string[]

          // now generate all sub sitemaps
          for (const sitemap of sitemapNames) {
            const sitemapXml = await buildSitemap({
              sitemapName: sitemap,
              // @ts-expect-error untyped
              sitemapConfig: { ...exposeConfig, ...(config.sitemaps[sitemap]), urls: configUrls },
              baseURL: nuxt.options.app.baseURL,
              getRouteRulesForPath: routeMatcher,
              callHook,
            })
            await writeFile(resolve(nitro.options.output.publicDir, `${sitemap}-sitemap.xml`), sitemapXml)
            const generateTimeMS = Date.now() - start
            const isLastEntry = Object.keys(config.sitemaps).indexOf(sitemap) === Object.keys(config.sitemaps).length - 1
            nitro.logger.log(chalk.gray(
              `  ${isLastEntry ? '└─' : '├─'} /${sitemap}-sitemap.xml (${generateTimeMS}ms)`,
            ))
          }
        }
        else {
          const sitemapXml = await buildSitemap({
            sitemapName: 'sitemap',
            sitemapConfig: exposeConfig,
            baseURL: nuxt.options.app.baseURL,
            getRouteRulesForPath: routeMatcher,
            callHook,
          })
          await writeFile(resolve(nitro.options.output.publicDir, 'sitemap.xml'), sitemapXml)
          const generateTimeMS = Date.now() - start
          nitro.logger.log(chalk.gray(
            `  └─ /sitemap.xml (${generateTimeMS}ms)`,
          ))
        }
        sitemapGenerate = true
      }

      // SSR mode
      nitro.hooks.hook('rollup:before', async () => {
        await outputSitemap()
      })

      // SSG mode
      nitro.hooks.hook('close', async () => {
        await outputSitemap()
      })
    })
  },
})
