import { mkdir, rm, copyFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const publicDir = path.join(rootDir, 'public', 'tesseract')
const coreSourceDir = path.join(rootDir, 'node_modules', 'tesseract.js-core')
const coreTargetDir = path.join(publicDir, 'core')
const workerSourceFile = path.join(rootDir, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js')
const workerTargetFile = path.join(publicDir, 'worker.min.js')
const langSourceFile = path.join(
  rootDir,
  'node_modules',
  '@tesseract.js-data',
  'eng',
  '4.0.0_best_int',
  'eng.traineddata.gz',
)
const langTargetDir = path.join(publicDir, 'lang')
const langTargetFile = path.join(langTargetDir, 'eng.traineddata.gz')

await mkdir(coreTargetDir, { recursive: true })
await mkdir(langTargetDir, { recursive: true })

await rm(coreTargetDir, { recursive: true, force: true })
await rm(langTargetDir, { recursive: true, force: true })
await mkdir(coreTargetDir, { recursive: true })
await mkdir(langTargetDir, { recursive: true })

const coreFiles = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-lstm.wasm',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm',
]

for (const fileName of coreFiles) {
  await copyFile(
    path.join(coreSourceDir, fileName),
    path.join(coreTargetDir, fileName),
  )
}

await copyFile(workerSourceFile, workerTargetFile)
await copyFile(langSourceFile, langTargetFile)
