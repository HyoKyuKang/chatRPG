// V2 HOUR 4 — 영웅 7명 portrait batch (DALL-E 3, 1024×1024, hand-painted style).
// Output PNG to /tmp/portraits/<id>.png. 별도 step (Python Pillow) 으로 webp 변환.

import { writeFile, mkdir } from 'node:fs/promises'

const API = 'https://api.openai.com/v1/images/generations'
const KEY = process.env.OPENAI_API_KEY
if (!KEY) {
  console.error('OPENAI_API_KEY is not set (eval the bashrc line first)')
  process.exit(1)
}

const STYLE_SUFFIX =
  ', hand-painted digital illustration, dark fantasy aesthetic, moody atmospheric lighting, painterly brushstrokes, muted earth tones with warm highlights, cinematic composition, Studio Ghibli meets Dark Souls mood, painterly mist, soft volumetric light, character portrait centered, no text, no watermark, no signature'

interface HeroPrompt {
  id: string
  base: string
}

const HEROES: HeroPrompt[] = [
  {
    id: 'astrid',
    base: 'Young female templar knight, mid-twenties, fair skin with korean features, light blonde hair tied back, holy white-and-gold plate armor with subtle templar engravings, gripping a longsword tip-down, expression earnest yet uncertain, faith-bound but vulnerable, warm hopeful eyes, dark misty forest behind',
  },
  {
    id: 'bayren-rosa',
    base: 'Elderly male wizard, late seventies, weathered korean face, long white hair and white beard, weary stern expression, dark layered traveling robes with worn leather satchel, faintly glowing rune script around his hands, gruff but knowing, ancient stone ruins behind',
  },
  {
    id: 'shadow-commander',
    base: 'Imposing armored male commander, helmet visor hiding his face entirely, black-purple plate armor with broken oath sigils, dark shadow tendrils curling at his shoulders, once-faithful templar fallen to despair, oppressive weight, ruined mountain fortress behind',
  },
  {
    id: 'corrupted-one',
    base: 'Former hero now corrupted, cracked porcelain-pale face like broken ceramic, dark whispers swirling around his head, ash-stained tattered tunic, eyes too bright with unnatural light, expression vacant and ecstatic, gray ash wastes behind',
  },
  {
    id: 'sleeping-king',
    base: 'Ancient dreaming king, regal middle-aged korean man, long dark hair flowing, ornate purple-and-gold robes with star embroidery, eyes closed peacefully, suspended motionless in soft dream-light, ethereal floating petals, dreaming city throne behind',
  },
  {
    id: 'mawang',
    base: 'Ancient demon king, former mage of immense age, long flowing black-and-gray robes, weary deeply-melancholic eyes that have seen too many cycles, neither hateful nor kind, tired authority, aged korean features, dark obsidian throne backdrop with pale starlight',
  },
  {
    id: 'gray-one',
    base: 'Mysterious cloaked figure standing in profile, face entirely hidden in shadow under a deep gray hood, simple gray traveling robes, silhouette only, void empty backdrop with faint white mist, quiet authority, no facial features visible at all',
  },
]

async function generate(hero: HeroPrompt) {
  const prompt = hero.base + STYLE_SUFFIX
  process.stdout.write(`→ ${hero.id} ... `)
  const start = Date.now()
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
      size: '1024x1024',
      quality: 'standard',
      style: 'vivid',
      response_format: 'b64_json',
    }),
  })
  if (!res.ok) {
    const txt = await res.text()
    console.log(`FAIL`)
    throw new Error(`DALL-E 3 ${res.status} for ${hero.id}: ${txt}`)
  }
  const data = (await res.json()) as { data: { b64_json: string }[] }
  const b64 = data.data[0]?.b64_json
  if (!b64) throw new Error(`no b64_json in response for ${hero.id}`)
  const buf = Buffer.from(b64, 'base64')
  const outPath = `/tmp/portraits/${hero.id}.png`
  await writeFile(outPath, buf)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`${(buf.length / 1024).toFixed(0)} KB · ${elapsed}s`)
}

async function generateWithRetry(hero: HeroPrompt, retries = 2): Promise<boolean> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await generate(hero)
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt < retries && /\b(429|5\d\d)\b/.test(msg)) {
        const wait = (attempt + 1) * 3
        console.log(`  retry ${attempt + 1}/${retries} after ${wait}s...`)
        await new Promise((r) => setTimeout(r, wait * 1000))
        continue
      }
      console.log(`  ✗ ${hero.id}: ${msg.split('\n')[0].slice(0, 120)}`)
      return false
    }
  }
  return false
}

async function main() {
  await mkdir('/tmp/portraits', { recursive: true })
  const filter = process.argv[2] // optional: single hero id
  const targets = filter
    ? HEROES.filter((h) => h.id === filter)
    : HEROES
  if (targets.length === 0) {
    console.error(`No hero matched "${filter}". Available: ${HEROES.map((h) => h.id).join(', ')}`)
    process.exit(1)
  }
  console.log(`Generating ${targets.length} portrait(s) (DALL-E 3 standard 1024×1024)...`)
  const ok: string[] = []
  const fail: string[] = []
  for (const hero of targets) {
    const success = await generateWithRetry(hero)
    if (success) ok.push(hero.id)
    else fail.push(hero.id)
  }
  console.log(`\n✓ Done. ${ok.length}/${targets.length} succeeded.`)
  if (fail.length > 0) {
    console.log(`  Failed: ${fail.join(', ')}`)
    console.log(`  Retry single: npx tsx scripts/gen-portraits.ts <hero-id>`)
  }
  console.log(`\nNext: python3 scripts/png-to-webp.py`)
}

main().catch((e: Error) => {
  console.error(`\nERROR: ${e.message}`)
  process.exit(1)
})
