// V2 HOUR 5 — 앱 아이콘 1장 (DALL-E 3 standard 1024×1024).
// Output: /tmp/icon.png. 별도 step (Pillow) 으로 512 resize + adaptive icon foreground.

import { writeFile } from 'node:fs/promises'

const API = 'https://api.openai.com/v1/images/generations'
const KEY = process.env.OPENAI_API_KEY
if (!KEY) {
  console.error('OPENAI_API_KEY not set')
  process.exit(1)
}

const PROMPT = `Mobile game app icon for a Korean indie text RPG titled "이 세계는 끝날 거야" (This World Will End). Centered symmetric composition. Dark fantasy seal or sigil motif — a circular emblem evoking endings, mist, and a single stranger figure. Hand-painted digital illustration, painterly brushstrokes, Studio Ghibli meets Dark Souls aesthetic. Rich deep black-purple background with subtle warm gold accents. Korean indie game art style, weighty and literary. No text, no logo, no watermark, no signature.`

async function main() {
  console.log('→ generating app icon (DALL-E 3 standard 1024×1024)...')
  const start = Date.now()
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: PROMPT,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
      response_format: 'b64_json',
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`DALL-E 3 ${res.status}: ${txt}`)
  }
  const data = (await res.json()) as { data: { b64_json: string }[] }
  const b64 = data.data[0]?.b64_json
  if (!b64) throw new Error('no b64_json in response')
  const buf = Buffer.from(b64, 'base64')
  const out = '/tmp/icon.png'
  await writeFile(out, buf)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`✓ ${out}  (${(buf.length / 1024).toFixed(0)} KB · ${elapsed}s)`)
  console.log(`\nNext steps:`)
  console.log(`  1. python3 scripts/icon-prepare.py  # resize 512 + adaptive foreground`)
  console.log(`  2. notes/store-assets/icon-512.png  # Play Console upload 용`)
}

main().catch((e: Error) => {
  console.error(`ERROR: ${e.message}`)
  process.exit(1)
})
