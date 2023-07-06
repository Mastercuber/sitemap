import { describe, expect, it } from 'vitest'
import { createResolver } from '@nuxt/kit'
import { $fetch, setup } from '@nuxt/test-utils'

const { resolve } = createResolver(import.meta.url)

await setup({
  rootDir: resolve('../.playground'),
  build: true,
  server: true,
  nuxtConfig: {
    app: {
      baseURL: '/base',
    },
    sitemap: {
      autoLastmod: false,
      siteUrl: 'https://nuxtseo.com',
    },
  },
})
describe('base', () => {
  it('basic', async () => {
    const sitemapIndex = await $fetch('/base/sitemap_index.xml')

    expect(sitemapIndex).not.match(/\/base\/base\//g)

    const posts = await $fetch('/base/posts-sitemap.xml')

    expect(posts).toMatchInlineSnapshot(`
      "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><?xml-stylesheet type=\\"text/xsl\\" href=\\"/base/__sitemap__/style.xsl\\"?>
      <urlset xmlns:xsi=\\"http://www.w3.org/2001/XMLSchema-instance\\" xmlns:video=\\"http://www.google.com/schemas/sitemap-video/1.1\\" xmlns:xhtml=\\"http://www.w3.org/1999/xhtml\\" xmlns:image=\\"http://www.google.com/schemas/sitemap-image/1.1\\" xsi:schemaLocation=\\"http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd\\" xmlns=\\"http://www.sitemaps.org/schemas/sitemap/0.9\\">
          <url>
              <loc>https://nuxtseo.com/base/blog/post-1</loc>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/blog/post-2</loc>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/blog/post-3</loc>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/blog/post-4</loc>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/blog/post-5</loc>
          </url>
      </urlset>
      <!-- XML Sitemap generated by Nuxt Simple Sitemap -->"
    `)

    expect(await $fetch('/base/pages-sitemap.xml')).toMatchInlineSnapshot(`
      "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?><?xml-stylesheet type=\\"text/xsl\\" href=\\"/base/__sitemap__/style.xsl\\"?>
      <urlset xmlns:xsi=\\"http://www.w3.org/2001/XMLSchema-instance\\" xmlns:video=\\"http://www.google.com/schemas/sitemap-video/1.1\\" xmlns:xhtml=\\"http://www.w3.org/1999/xhtml\\" xmlns:image=\\"http://www.google.com/schemas/sitemap-image/1.1\\" xsi:schemaLocation=\\"http://www.sitemaps.org/schemas/sitemap/0.9 http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd http://www.google.com/schemas/sitemap-image/1.1 http://www.google.com/schemas/sitemap-image/1.1/sitemap-image.xsd\\" xmlns=\\"http://www.sitemaps.org/schemas/sitemap/0.9\\">
          <url>
              <loc>https://nuxtseo.com/base/about</loc>
              <lastmod>2023-02-20T21:50:52+00:00</lastmod>
              <xhtml:link rel=\\"alternate\\" hreflang=\\"fr\\" href=\\"https://nuxtseo.com/base/fr/a-propos\\" />
              <xhtml:link rel=\\"alternate\\" href=\\"https://nuxtseo.com/base/fr/about\\" hreflang=\\"fr\\" />
              <image:image>
                  <image:loc>https://nuxtseo.com/base/image.jpg</image:loc>
              </image:image>
              <image:image>
                  <image:loc>https://nuxtseo.com/base/image2.jpg</image:loc>
              </image:image>
              <image:image>
                  <image:loc>https://nuxtseo.com/base/image-3.jpg</image:loc>
              </image:image>
              <changefreq>daily</changefreq>
              <priority>0.3</priority>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/services</loc>
              <xhtml:link rel=\\"alternate\\" hreflang=\\"fr\\" href=\\"https://nuxtseo.com/base/fr/offres\\" />
          </url>
          <url>
              <loc>https://nuxtseo.com/base/users-lazy/1</loc>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/users-lazy/2</loc>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/users-lazy/3</loc>
          </url>
          <url>
              <loc>https://nuxtseo.com/base/services/coaching</loc>
              <xhtml:link rel=\\"alternate\\" hreflang=\\"fr\\" href=\\"https://nuxtseo.com/base/fr/offres/formation\\" />
          </url>
          <url>
              <loc>https://nuxtseo.com/base/services/development</loc>
              <xhtml:link rel=\\"alternate\\" hreflang=\\"fr\\" href=\\"https://nuxtseo.com/base/fr/offres/developement\\" />
          </url>
          <url>
              <loc>https://nuxtseo.com/base/services/development/app</loc>
              <xhtml:link rel=\\"alternate\\" hreflang=\\"fr\\" href=\\"https://nuxtseo.com/base/fr/offres/developement/app\\" />
          </url>
          <url>
              <loc>https://nuxtseo.com/base/services/development/website</loc>
              <xhtml:link rel=\\"alternate\\" hreflang=\\"fr\\" href=\\"https://nuxtseo.com/base/fr/offres/developement/site-web\\" />
          </url>
      </urlset>
      <!-- XML Sitemap generated by Nuxt Simple Sitemap -->"
    `)
  }, 60000)
})
