import { data, useGame } from '../store'

export function StatBar() {
  const stats = useGame((s) => s.run.stats)
  const inventory = useGame((s) => s.run.inventory)
  const memoryShards = useGame((s) => s.meta.memoryShards)
  const completedRuns = useGame((s) => s.meta.completedRuns)

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 text-xs text-zinc-400 flex-wrap">
      <span className="text-rose-300">
        HP <span className="tabular-nums">{stats.hp}</span>
      </span>
      <span className="text-sky-300">
        MP <span className="tabular-nums">{stats.mana}</span>
      </span>
      <span className="text-zinc-700">|</span>
      {inventory.length === 0 ? (
        <span className="text-zinc-600">소지품 없음</span>
      ) : (
        inventory.map((id) => {
          const item = data.items.get(id)
          return (
            <span key={id} className="text-amber-200">
              {item?.name ?? id}
            </span>
          )
        })
      )}
      {(memoryShards > 0 || completedRuns > 0) && (
        <span className="ml-auto text-[10px] text-violet-300/70">
          {memoryShards > 0 && (
            <span className="mr-2">기억 {memoryShards}</span>
          )}
          {completedRuns > 0 && <span>출정 {completedRuns}</span>}
        </span>
      )}
    </div>
  )
}
