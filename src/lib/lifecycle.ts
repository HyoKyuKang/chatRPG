// Capacitor App lifecycle integration.
//
// On native (Android), wires App.addListener('appStateChange') to pause/resume
// audio when the app is backgrounded. Combat turn state is already in the
// zustand store and persisted via localStorage, so no extra timer to stop —
// the BGM is the only side-effect that needs explicit pause/resume.
// On web, App.addListener is a no-op (handlers never fire), which is fine.

import { App, type AppState } from '@capacitor/app'
import { audio } from './audio'

let installed = false

export async function installAppLifecycle(): Promise<void> {
  if (installed) return
  installed = true
  try {
    await App.addListener('appStateChange', (state: AppState) => {
      if (state.isActive) {
        audio.resume()
      } else {
        audio.pause()
      }
    })
  } catch {
    // Plugin not available (e.g. SSR or unusual env) — silently degrade.
  }
}
