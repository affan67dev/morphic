import { describe, expect, it } from 'vitest'

import { previewHTML, validateFiles } from './files'
import { templateFiles, templates } from './templates'
describe('builder project boundaries', () => {
  it('creates complete usable files from every template', () => {
    for (const t of templates) {
      const files = validateFiles(templateFiles(t.id))
      expect(files['index.html']).toContain('<!doctype html>')
      expect(files['style.css']).toBeTruthy()
      expect(files['README.md']).toContain('NOVA')
    }
  })
  it('rejects traversal, external scripts and invalid output', () => {
    expect(() =>
      validateFiles({ 'index.html': '<main>Hi</main>', '../server.js': 'bad' })
    ).toThrow()
    expect(() =>
      validateFiles({
        'index.html':
          '<main><script src="https://evil.test/x.js"></script></main>'
      })
    ).toThrow()
    expect(() => validateFiles({})).toThrow()
  })
  it('isolates generated scripts and inlines only owned assets', () => {
    const html = previewHTML({
      'index.html':
        '<html><head><script src="evil.js"></script></head><body>Hello</body></html>',
      'style.css': 'body{color:red}',
      'app.js': 'document.title="demo"'
    })
    expect(html).not.toContain('evil.js')
    expect(html).toContain("connect-src 'none'")
    expect(html).toContain('document.title')
    expect(html).toContain('color:red')
  })
  it('provides PWA source honestly, without claiming a native bundle', () => {
    const files = templateFiles('personal', 'pwa')
    expect(files['manifest.json']).toBeTruthy()
    expect(files['README.md']).toContain('not install a native app')
  })
})
