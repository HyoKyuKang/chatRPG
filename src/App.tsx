import { useEffect } from 'react'
import { StatBar } from './components/StatBar'
import { NodeView } from './components/NodeView'
import { RegionHeader } from './components/RegionHeader'
import { TitleScreen } from './components/TitleScreen'
import { useGame, data } from './store'
import { audio } from './lib/audio'
import { installAppLifecycle } from './lib/lifecycle'

function App() {
  const appView = useGame((s) => s.appView)
  const currentNodeId = useGame((s) => s.run.currentNodeId)
  const bgmEnabled = useGame((s) => s.meta.bgmEnabled)
  const bgmVolume = useGame((s) => s.meta.bgmVolume)

  useEffect(() => {
    audio.setVolume(bgmVolume)
  }, [bgmVolume])

  useEffect(() => {
    audio.setEnabled(bgmEnabled)
  }, [bgmEnabled])

  useEffect(() => {
    if (appView !== 'game') {
      void audio.setRegion(null)
      return
    }
    const node = data.nodes.get(currentNodeId)
    if (node) void audio.setRegion(node.region)
  }, [appView, currentNodeId])

  useEffect(() => {
    const unlock = () => {
      void audio.unlock()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    void installAppLifecycle()
  }, [])

  if (appView === 'title') return <TitleScreen />

  return (
    <div className="flex flex-col h-full max-w-md mx-auto bg-ink-900/40 shadow-card">
      <RegionHeader />
      <StatBar />
      <div className="flex-1 min-h-0">
        <NodeView />
      </div>
    </div>
  )
}

export default App
