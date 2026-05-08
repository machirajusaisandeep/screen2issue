// Generates all icon sizes for web (PWA) and Tauri desktop from favicon.svg
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')
const svg = readFileSync(resolve(root, 'public/favicon.svg'))

async function png(size, dest) {
  await sharp(svg).resize(size, size).png().toFile(resolve(root, dest))
  console.log(`  ${size}x${size} → ${dest}`)
}

console.log('Generating web / PWA icons…')
mkdirSync(resolve(root, 'public/icons'), { recursive: true })
await png(192,  'public/icons/icon-192.png')
await png(512,  'public/icons/icon-512.png')
await png(512,  'public/icons/icon-512-maskable.png')

console.log('Generating Tauri icons…')
mkdirSync(resolve(root, 'src-tauri/icons'), { recursive: true })
await png(32,   'src-tauri/icons/32x32.png')
await png(128,  'src-tauri/icons/128x128.png')
await png(256,  'src-tauri/icons/128x128@2x.png')
await png(512,  'src-tauri/icons/icon.png')

console.log('Generating iconset for macOS .icns…')
const iconset = resolve(root, 'src-tauri/icons/icon.iconset')
mkdirSync(iconset, { recursive: true })
await png(16,   'src-tauri/icons/icon.iconset/icon_16x16.png')
await png(32,   'src-tauri/icons/icon.iconset/icon_16x16@2x.png')
await png(32,   'src-tauri/icons/icon.iconset/icon_32x32.png')
await png(64,   'src-tauri/icons/icon.iconset/icon_32x32@2x.png')
await png(128,  'src-tauri/icons/icon.iconset/icon_128x128.png')
await png(256,  'src-tauri/icons/icon.iconset/icon_128x128@2x.png')
await png(256,  'src-tauri/icons/icon.iconset/icon_256x256.png')
await png(512,  'src-tauri/icons/icon.iconset/icon_256x256@2x.png')
await png(512,  'src-tauri/icons/icon.iconset/icon_512x512.png')
await png(1024, 'src-tauri/icons/icon.iconset/icon_512x512@2x.png')

// Build .icns from iconset if iconutil is available (macOS)
const { execSync } = await import('child_process')
try {
  execSync(`iconutil -c icns ${iconset} -o ${resolve(root, 'src-tauri/icons/icon.icns')}`)
  console.log('  .icns generated via iconutil')
} catch {
  console.log('  iconutil not available — skipping .icns (Linux/Windows build)')
}

console.log('Done.')
