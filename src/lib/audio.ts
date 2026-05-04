// Audio singleton — V1.1 BGM system.
//
// Module-level singleton (NOT in zustand store — non-serializable, would break
// partialize). HTMLAudioElement + WebAudio GainNode for cross-fade. First user
// gesture unlocks AudioContext (WebView blocks until then).

import type { RegionId } from '../schemas'

const TRACKS: Record<RegionId, string> = {
  prologue: '/audio/forest-outskirts.wav',
  'forest-outskirts': '/audio/forest-outskirts.wav',
  'forgotten-mountains': '/audio/forgotten-mountains.wav',
  'ash-wastes': '/audio/ash-wastes.wav',
  'dreaming-city': '/audio/dreaming-city.wav',
  'dawn-spire': '/audio/dawn-spire.wav',
}

const FADE_MS = 600
const SFX_PATHS = {
  'choice-tap': '/audio/sfx/choice-tap.wav',
  'stat-loss': '/audio/sfx/stat-loss.wav',
  'stat-gain': '/audio/sfx/stat-gain.wav',
  'meta-unlock': '/audio/sfx/meta-unlock.wav',
  death: '/audio/sfx/death.wav',
  'ending-reveal': '/audio/sfx/ending-reveal.wav',
  'combat-engage': '/audio/sfx/combat-engage.wav',
  'combat-victory': '/audio/sfx/combat-victory.wav',
} as const

export type SfxId = keyof typeof SFX_PATHS

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let sfxGain: GainNode | null = null
let activeAudio: HTMLAudioElement | null = null
let activeGain: GainNode | null = null
let currentRegion: RegionId | null = null
let userVolume = 0.6
let sfxVolume = 0.65
let enabled = true
let sfxEnabled = true
const sfxBuffers = new Map<SfxId, AudioBuffer | null>()

function ensureCtx(): AudioContext | null {
  if (ctx) return ctx
  if (typeof window === 'undefined') return null
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctx) return null
  const c = new Ctx()
  ctx = c
  masterGain = c.createGain()
  masterGain.gain.value = userVolume
  masterGain.connect(c.destination)
  sfxGain = c.createGain()
  sfxGain.gain.value = sfxVolume
  sfxGain.connect(c.destination)
  return c
}

function fade(gain: GainNode, target: number): void {
  if (!ctx) return
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(target, now + FADE_MS / 1000)
}

export const audio = {
  async unlock(): Promise<void> {
    const c = ensureCtx()
    if (!c) return
    if (c.state === 'suspended') {
      try {
        await c.resume()
      } catch {
        // Will retry on next gesture
      }
    }
  },

  async setRegion(region: RegionId | null): Promise<void> {
    if (region === currentRegion) return
    const prev = currentRegion
    currentRegion = region

    const c = ensureCtx()
    if (!c || !masterGain) return

    const oldAudio = activeAudio
    const oldGain = activeGain
    if (oldAudio && oldGain) {
      fade(oldGain, 0)
      window.setTimeout(() => {
        try {
          oldAudio.pause()
        } catch {
          // ignore
        }
        try {
          oldGain.disconnect()
        } catch {
          // ignore
        }
      }, FADE_MS + 50)
    }

    if (!region || !enabled) {
      activeAudio = null
      activeGain = null
      return
    }

    const next = new Audio(TRACKS[region])
    next.loop = true
    next.preload = 'auto'
    const source = c.createMediaElementSource(next)
    const gain = c.createGain()
    gain.gain.value = 0
    source.connect(gain)
    gain.connect(masterGain)

    try {
      await next.play()
      fade(gain, 1)
      activeAudio = next
      activeGain = gain
    } catch {
      // Autoplay blocked or load failed — silently degrade
      currentRegion = prev
      try {
        source.disconnect()
      } catch {
        // ignore
      }
      try {
        gain.disconnect()
      } catch {
        // ignore
      }
    }
  },

  async preloadSfx(id: SfxId): Promise<void> {
    if (sfxBuffers.has(id)) return
    const c = ensureCtx()
    if (!c) return
    try {
      const res = await fetch(SFX_PATHS[id])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const arr = await res.arrayBuffer()
      const buffer = await c.decodeAudioData(arr)
      sfxBuffers.set(id, buffer)
    } catch {
      sfxBuffers.set(id, null)
    }
  },

  async playSfx(id: SfxId, volume = 1): Promise<void> {
    if (!sfxEnabled) return
    const c = ensureCtx()
    if (!c || !sfxGain) return
    if (c.state === 'suspended') {
      try {
        await c.resume()
      } catch {
        return
      }
    }
    await this.preloadSfx(id)
    const buffer = sfxBuffers.get(id)
    if (!buffer) return
    try {
      const source = c.createBufferSource()
      const gain = c.createGain()
      gain.gain.value = Math.max(0, Math.min(1, volume))
      source.buffer = buffer
      source.connect(gain)
      gain.connect(sfxGain)
      source.start()
      source.onended = () => {
        try {
          source.disconnect()
          gain.disconnect()
        } catch {
          // ignore
        }
      }
    } catch {
      // SFX is non-critical
    }
  },

  setVolume(v: number): void {
    userVolume = Math.max(0, Math.min(1, v))
    if (masterGain && ctx) {
      masterGain.gain.setValueAtTime(userVolume, ctx.currentTime)
    }
  },

  setEnabled(e: boolean): void {
    enabled = e
    if (!e && activeGain) {
      fade(activeGain, 0)
    } else if (e && currentRegion) {
      const region = currentRegion
      currentRegion = null
      void this.setRegion(region)
    }
  },

  setSfxVolume(v: number): void {
    sfxVolume = Math.max(0, Math.min(1, v))
    if (sfxGain && ctx) {
      sfxGain.gain.setValueAtTime(sfxVolume, ctx.currentTime)
    }
  },

  setSfxEnabled(e: boolean): void {
    sfxEnabled = e
  },

  pause(): void {
    if (activeAudio) {
      try {
        activeAudio.pause()
      } catch {
        // ignore
      }
    }
  },

  resume(): void {
    if (activeAudio && enabled) {
      activeAudio.play().catch(() => {
        // Autoplay still blocked
      })
    }
  },
}
