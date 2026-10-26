export type Files = Record<string, string>
export type ProjectType = 'website' | 'webapp' | 'pwa'
const ALLOWED = new Set([
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'README.md'
])
export function validateFiles(value: unknown): Files {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('The builder returned an incomplete project. Please retry.')
  const files = value as Files
  if (
    !files['index.html'] ||
    !/<(?:!doctype|html|main|body)/i.test(files['index.html'])
  )
    throw new Error('The project needs an HTML page. Please retry.')
  if (
    Object.keys(files).length > 6 ||
    Object.entries(files).some(
      ([path, text]) =>
        !ALLOWED.has(path) || typeof text !== 'string' || text.length > 120000
    ) ||
    JSON.stringify(files).length > 240000
  )
    throw new Error(
      'The project output is too large or contains unsupported files.'
    )
  if (
    /<script[^>]+src\s*=\s*["']?(?:https?:|\/\/)/i.test(files['index.html']) ||
    /(?:import\s*\(|\beval\s*\(|document\.cookie)/.test(files['app.js'] || '')
  )
    throw new Error(
      'This project requires capabilities that are not supported in the safe preview.'
    )
  return files
}
export function previewHTML(files: Files) {
  let html = files['index.html'] || '<main>No preview available.</main>'
  html = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
  const policy =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  const head = `<meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"><style>${(files['style.css'] || '').replace(/<\/style/gi, '<\\/style')}</style>`
  const script = `<script>${(files['app.js'] || '').replace(/<\/script/gi, '<\\/script')}</script>`
  if (/<head[^>]*>/i.test(html))
    html = html.replace(/<head[^>]*>/i, match => match + head)
  else html = head + html
  return html + script
}
export function projectName(prompt: string) {
  return prompt.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled project'
}
