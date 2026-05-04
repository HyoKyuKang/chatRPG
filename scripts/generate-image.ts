// Generate a single image from a prompt using OpenAI image gen.
//
// Usage:
//   tsx scripts/generate-image.ts <region> <node-id> <prompt-file>
//
// Reads prompt from <prompt-file>, calls OpenAI, saves to
// public/scenes/<region>/<node-id>.png. Does NOT update node JSON — that's a
// separate step so user can review the image first.
//
// Env: OPENAI_API_KEY required.

import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const [, , region, nodeId, promptFile] = process.argv

if (!region || !nodeId || !promptFile) {
  console.error('Usage: tsx scripts/generate-image.ts <region> <node-id> <prompt-file>')
  process.exit(2)
}

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error('OPENAI_API_KEY not set')
  process.exit(2)
}

const prompt = (await readFile(promptFile, 'utf8')).trim()
if (!prompt) {
  console.error(`Prompt file empty: ${promptFile}`)
  process.exit(2)
}

console.log(`Generating image for ${region}/${nodeId} (prompt ${prompt.length} chars)...`)

// Try gpt-image-1 first (newer, better aspect support). Fall back to dall-e-3
// on org-verification errors.
async function callApi(model: 'gpt-image-1' | 'dall-e-3') {
  const body: Record<string, unknown> =
    model === 'gpt-image-1'
      ? { model, prompt, n: 1, size: '1536x1024' }
      : { model, prompt, n: 1, size: '1792x1024', response_format: 'b64_json', quality: 'hd' }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = (await res.json()) as {
    data?: { b64_json?: string; url?: string; revised_prompt?: string }[]
    error?: { code?: string; message?: string }
  }
  return { ok: res.ok, status: res.status, data }
}

let result = await callApi('gpt-image-1')
if (!result.ok) {
  const code = result.data?.error?.code
  const msg = result.data?.error?.message ?? '(no message)'
  console.warn(`gpt-image-1 failed (${result.status} ${code ?? ''}): ${msg}`)
  if (
    code === 'organization_must_be_verified' ||
    code === 'model_not_found' ||
    result.status === 403
  ) {
    console.log('Falling back to dall-e-3...')
    result = await callApi('dall-e-3')
  }
}
if (!result.ok) {
  console.error(`API call failed: ${result.status}`)
  console.error(JSON.stringify(result.data, null, 2))
  process.exit(1)
}

const item = result.data.data?.[0]
if (!item) {
  console.error('No image in response')
  process.exit(1)
}

let pngBytes: Buffer
if (item.b64_json) {
  pngBytes = Buffer.from(item.b64_json, 'base64')
} else if (item.url) {
  const imgRes = await fetch(item.url)
  pngBytes = Buffer.from(await imgRes.arrayBuffer())
} else {
  console.error('Response has neither b64_json nor url')
  process.exit(1)
}

const outDir = join(projectRoot, 'public', 'scenes', region)
await mkdir(outDir, { recursive: true })
const pngPath = join(outDir, `${nodeId}.png`)
const webpPath = join(outDir, `${nodeId}.webp`)
await writeFile(pngPath, pngBytes)

const pngSizeKb = (pngBytes.length / 1024).toFixed(0)
console.log(`PNG saved (${pngSizeKb} KB). Converting to webp...`)

// cwebp is in PATH (apt: webp). q=80 is the sweet spot for charcoal / etched
// illustration — keeps texture, brings file under 600 KB target from
// docs/visual-style.md.
const conv = spawnSync('cwebp', ['-q', '80', pngPath, '-o', webpPath], {
  stdio: 'inherit',
})
if (conv.status !== 0) {
  console.error('cwebp conversion failed. Keeping PNG.')
  if (item.revised_prompt) {
    console.log(`Revised prompt: ${item.revised_prompt.slice(0, 200)}...`)
  }
  console.log()
  console.log('Next: add to node JSON →')
  console.log(`  "image": "/scenes/${region}/${nodeId}.png"`)
  process.exit(0)
}

// Remove PNG, keep only webp
await unlink(pngPath)

const webpBytes = await readFile(webpPath)
const webpSizeKb = (webpBytes.length / 1024).toFixed(0)
console.log(`Saved: public/scenes/${region}/${nodeId}.webp (${webpSizeKb} KB)`)
if (item.revised_prompt) {
  console.log(`Revised prompt: ${item.revised_prompt.slice(0, 200)}...`)
}
console.log()
console.log('Next: add to node JSON →')
console.log(`  "image": "/scenes/${region}/${nodeId}.webp"`)
