import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SAMPLE_RATE = 11025

function wav(samples: Float32Array): Buffer {
  const dataSize = samples.length * 2
  const out = Buffer.alloc(44 + dataSize)
  out.write('RIFF', 0)
  out.writeUInt32LE(36 + dataSize, 4)
  out.write('WAVE', 8)
  out.write('fmt ', 12)
  out.writeUInt32LE(16, 16)
  out.writeUInt16LE(1, 20)
  out.writeUInt16LE(1, 22)
  out.writeUInt32LE(SAMPLE_RATE, 24)
  out.writeUInt32LE(SAMPLE_RATE * 2, 28)
  out.writeUInt16LE(2, 32)
  out.writeUInt16LE(16, 34)
  out.write('data', 36)
  out.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    out.writeInt16LE(Math.round(v * 32767), 44 + i * 2)
  }
  return out
}

function tone(t: number, hz: number): number {
  return Math.sin(2 * Math.PI * hz * t)
}

function fade(i: number, n: number): number {
  const edge = Math.floor(SAMPLE_RATE * 0.6)
  if (i < edge) return i / edge
  if (i > n - edge) return (n - i) / edge
  return 1
}

function ambient(seconds: number, base: number, shift: number): Float32Array {
  const n = seconds * SAMPLE_RATE
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const slow = 0.5 + 0.5 * tone(t, 0.07 + shift)
    const pad =
      tone(t, base) * 0.18 +
      tone(t, base * 1.5 + shift * 20) * 0.08 +
      tone(t, base * 2.01) * 0.035
    const air = tone(t, 900 + 40 * tone(t, 0.03)) * 0.012
    samples[i] = (pad * slow + air) * fade(i, n)
  }
  return samples
}

function hit(seconds: number, freqs: number[], decay = 8): Float32Array {
  const n = Math.floor(seconds * SAMPLE_RATE)
  const samples = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const env = Math.exp(-decay * t)
    samples[i] =
      freqs.reduce((sum, f) => sum + tone(t, f), 0) *
      (0.18 / freqs.length) *
      env
  }
  return samples
}

async function main() {
  const audioDir = join('public', 'audio')
  const sfxDir = join(audioDir, 'sfx')
  await mkdir(sfxDir, { recursive: true })

  const bgm: Record<string, Float32Array> = {
    'forest-outskirts': ambient(12, 146.83, 0.01),
    'forgotten-mountains': ambient(12, 110, 0.025),
    'ash-wastes': ambient(12, 82.41, 0.015),
    'dreaming-city': ambient(12, 196, 0.04),
    'dawn-spire': ambient(12, 130.81, 0.02),
  }
  for (const [id, samples] of Object.entries(bgm)) {
    await writeFile(join(audioDir, `${id}.wav`), wav(samples))
  }

  const sfx: Record<string, Float32Array> = {
    'choice-tap': hit(0.16, [880, 1320], 22),
    'stat-loss': hit(0.42, [92, 138], 8),
    'stat-gain': hit(0.5, [523.25, 659.25, 880], 7),
    'meta-unlock': hit(0.75, [659.25, 987.77, 1318.51], 5),
    death: hit(1.1, [65.41, 98], 3.2),
    'ending-reveal': hit(1.2, [130.81, 196, 261.63], 3),
    'combat-engage': hit(0.35, [220, 440, 880], 10),
    'combat-victory': hit(0.7, [392, 587.33, 783.99], 5),
  }
  for (const [id, samples] of Object.entries(sfx)) {
    await writeFile(join(sfxDir, `${id}.wav`), wav(samples))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
