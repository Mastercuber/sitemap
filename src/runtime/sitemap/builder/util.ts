export function wrapSitemapXml(input: string[], { xsl, credits }: { xsl: string | false; credits: boolean }) {
  input.unshift(`<?xml version="1.0" encoding="UTF-8"?>${xsl ? `<?xml-stylesheet type="text/xsl" href="${xsl}"?>` : ''}`)
  if (credits)
    input.push('<!-- XML Sitemap generated by Nuxt Simple Sitemap -->')
  return input.join('\n')
}

export function escapeValueForXml(value: boolean | string | number) {
  if (value === true || value === false)
    return value ? 'yes' : 'no'
  return String(value).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}