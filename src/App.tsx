import { StatBar } from './components/StatBar'
import { NodeView } from './components/NodeView'

function App() {
  return (
    <div className="flex flex-col h-full max-w-md mx-auto">
      <StatBar />
      <div className="flex-1 min-h-0">
        <NodeView />
      </div>
    </div>
  )
}

export default App
