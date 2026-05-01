import { StatBar } from './components/StatBar'
import { NodeView } from './components/NodeView'
import { RegionHeader } from './components/RegionHeader'

function App() {
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
