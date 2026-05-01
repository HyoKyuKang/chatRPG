import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const API = 'https://api.openai.com/v1/images/generations'
const KEY = process.env.OPENAI_API_KEY
if (!KEY) {
  console.error('OPENAI_API_KEY is not set')
  process.exit(1)
}

type Size = '1024x1024' | '1792x1024' | '1024x1792'
type Quality = 'standard' | 'hd'

interface GenArgs {
  prompt: string
  out: string
  size?: Size
  quality?: Quality
  style?: 'vivid' | 'natural'
}

async function generate({
  prompt,
  out,
  size = '1792x1024',
  quality = 'standard',
  style = 'vivid',
}: GenArgs) {
  console.log(`→ ${out}`)
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size,
      quality,
      style,
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
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, Buffer.from(b64, 'base64'))
  console.log(`  saved (${(Buffer.from(b64, 'base64').length / 1024).toFixed(0)} KB)`)
}

const STYLES = {
  A: {
    label: 'hand-painted-moody-fantasy',
    suffix:
      ', hand-painted digital illustration, dark fantasy aesthetic, moody atmospheric lighting, painterly brushstrokes, muted earth tones with warm highlights, cinematic composition, Studio Ghibli meets Dark Souls mood, painterly mist, soft volumetric light, no text, no watermark, no signature',
  },
  B: {
    label: 'korean-ink-wash',
    suffix:
      ', Korean traditional ink wash painting, sumi-e and 수묵화 style, flowing brush strokes, hanji paper texture, mostly monochromatic black ink with subtle muted color accents, generous negative space, atmospheric mist, poetic minimalist composition, traditional East Asian aesthetic, no text, no watermark, no signature',
  },
  C: {
    label: 'dark-realism',
    suffix:
      ', detailed digital realism, dark fantasy concept art, photorealistic fabric and skin textures, dramatic chiaroscuro lighting, intricate worn cloak details, gritty atmosphere, Witcher 3 and Bloodborne concept art aesthetic, high detail, cinematic, no text, no watermark, no signature',
  },
} as const

const WANDERER_BASE =
  'A solitary wandering peddler resting beside a small canvas tent on a misty forest path at dusk. They wear a worn dark hooded cloak with half their face wrapped in coarse cloth, only the eyes visible. A weathered leather satchel sits at their side with small pouches and bottles. Ancient gnarled trees and low rolling fog frame the scene. Korean dark-fantasy mood, mysterious and weathered.'

async function main() {
  const arg = process.argv[2]
  if (arg === 'wanderer-3styles') {
    for (const k of ['A', 'B', 'C'] as const) {
      const s = STYLES[k]
      await generate({
        prompt: WANDERER_BASE + s.suffix,
        out: `/tmp/style-test/wanderer-dan-${k}-${s.label}.png`,
      })
    }
    return
  }
  console.error('usage: tsx scripts/generate-illust.ts wanderer-3styles')
  process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
