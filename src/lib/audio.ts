// Audio singleton — V1.1 BGM system.
//
// Module-level singleton (NOT in zustand store — non-serializable, would break
// partialize). HTMLAudioElement + WebAudio GainNode for cross-fade. First user
// gesture unlocks AudioContext (WebView blocks until then).

import type { RegionId } from '../schemas'

const TRACKS: Record<RegionId, string> = {
  'forest-outskirts': '/audio/forest-outskirts.ogg',
  'forgotten-mountains': '/audio/forgotten-mountains.ogg',
  'ash-wastes': '/audio/ash-wastes.ogg',
  'dreaming-city': '/audio/dreaming-city.ogg',
  'dawn-spire': '/audio/dawn-spire.ogg',
}

const FADE_MS = 600

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let activeAudio: HTMLAudioElement | null = null
let activeGain: GainNode | null = null
let currentRegion: RegionId | null = null
let userVolume = 0.6
let enabled = true

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
