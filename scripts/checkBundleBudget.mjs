import { readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const entry = manifest['index.html']
if (!entry?.file) throw new Error('Vite entry manifest was not generated.')

const bytes = await readFile(`dist/${entry.file}`)
const gzipBytes = gzipSync(bytes).byteLength
const budget = 250 * 1024
if (gzipBytes > budget) {
  throw new Error(`Initial JavaScript is ${(gzipBytes / 1024).toFixed(1)} KB gzip; budget is 250 KB.`)
}
const raw = await stat(`dist/${entry.file}`)
console.log(`Initial JavaScript: ${(gzipBytes / 1024).toFixed(1)} KB gzip (${(raw.size / 1024).toFixed(1)} KB raw)`)
