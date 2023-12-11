import type { NuxtModule, NuxtPage } from 'nuxt/schema'
import type { Nuxt } from '@nuxt/schema'
import { addTemplate, createResolver, extendPages, loadNuxtModuleInstance, useNuxt } from '@nuxt/kit'
import { relative } from 'pathe'
import type { Nitro } from 'nitropack'
import { env, provider } from 'std-env'
import type { NitroConfig } from 'nitropack/types'
import type { MaybePromise } from '../runtime/types'

/**
 * Get the user provided options for a Nuxt module.
 *
 * These options may not be the resolved options that the module actually uses.
 * @param module
 * @param nuxt
 */
export async function getNuxtModuleOptions(module: string | NuxtModule, nuxt: Nuxt = useNuxt()) {
  const moduleMeta = (typeof module === 'string' ? { name: module } : await module.getMeta?.()) || {}
  const { nuxtModule } = (await loadNuxtModuleInstance(module, nuxt))

  let moduleEntry: [string | NuxtModule, Record<string, any>] | undefined
  for (const m of nuxt.options.modules) {
    if (Array.isArray(m) && m.length >= 2) {
      const _module = m[0]
      const _moduleEntryName = typeof _module === 'string'
        ? _module
        : (await (_module as any as NuxtModule).getMeta?.())?.name || ''
      if (_moduleEntryName === moduleMeta.name)
        moduleEntry = m as [string | NuxtModule, Record<string, any>]
    }
  }

  let inlineOptions = {}
  if (moduleEntry)
    inlineOptions = moduleEntry[1]
  if (nuxtModule.getOptions)
    return nuxtModule.getOptions(inlineOptions, nuxt)
  return inlineOptions
}

export function extendTypes(module: string, template: (options: { typesPath: string }) => MaybePromise<string>) {
  const nuxt = useNuxt()
  const { resolve } = createResolver(import.meta.url)
  // paths.d.ts
  addTemplate({
    filename: `module/${module}.d.ts`,
    getContents: async () => {
      const typesPath = relative(resolve(nuxt!.options.rootDir, nuxt!.options.buildDir, 'module'), resolve('runtime/types'))
      const s = await template({ typesPath })
      return `// Generated by ${module}
${s}
export {}
`
    },
  })

  nuxt.hooks.hook('prepare:types', ({ references }) => {
    references.push({ path: resolve(nuxt.options.buildDir, `module/${module}.d.ts`) })
  })
}

export function createPagesPromise(nuxt: Nuxt = useNuxt()) {
  return new Promise<NuxtPage[]>((resolve) => {
    nuxt.hooks.hook('modules:done', () => {
      extendPages(resolve)
    })
  })
}

export function createNitroPromise(nuxt: Nuxt = useNuxt()) {
  return new Promise<Nitro>((resolve) => {
    nuxt.hooks.hook('nitro:init', (nitro) => {
      resolve(nitro)
    })
  })
}

const autodetectableProviders = {
  azure_static: 'azure',
  cloudflare_pages: 'cloudflare-pages',
  netlify: 'netlify',
  stormkit: 'stormkit',
  vercel: 'vercel',
  cleavr: 'cleavr',
  stackblitz: 'stackblitz',
}

const autodetectableStaticProviders = {
  netlify: 'netlify-static',
  vercel: 'vercel-static',
}

export function detectTarget(options: { static?: boolean } = {}) {
  // @ts-expect-error untyped
  return options?.static ? autodetectableStaticProviders[provider] : autodetectableProviders[provider]
}

export function resolveNitroPreset(nitroConfig?: NitroConfig): string {
  if (provider === 'stackblitz')
    return 'stackblitz'
  let preset
  if (nitroConfig && nitroConfig?.preset)
    preset = nitroConfig.preset
  if (!preset)
    preset = env.NITRO_PRESET || detectTarget() || 'node-server'
  return preset.replace('_', '-') // sometimes they are different
}
